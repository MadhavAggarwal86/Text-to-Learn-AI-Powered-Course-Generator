import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { DEV_USER_SUB } from '../src/middlewares/devUser.js';
import { VideoCache } from '../src/models/index.js';
import { generateLessonContent } from '../src/services/ai.service.js';
import { createCourseTree } from '../src/services/course.service.js';
import { validLessonReply } from './helpers/aiFixtures.js';
import { useTestDB } from './helpers/db.js';
import { makeOutline } from './helpers/fixtures.js';

vi.mock('../src/services/ai.service.js', () => ({
  generateCourseOutline: vi.fn(),
  generateLessonContent: vi.fn(),
  generateHinglishScript: vi.fn(),
}));

useTestDB();

const app = createApp();
// The same app with Auth0 switched on: public routes must still need no token.
const appWithAuth = createApp({
  authConfig: {
    issuer: 'https://test-tenant.example.com/',
    audience: 'https://text-to-learn-api',
    secret: 'test-secret-that-is-at-least-32-bytes-long!',
    tokenSigningAlg: 'HS256',
  },
});

async function seedCourse() {
  const course = await createCourseTree({
    outline: makeOutline(),
    creator: DEV_USER_SUB,
    prompt: 'React',
    difficulty: 'beginner',
  });
  const [opened, notOpened] = course.modules[0].lessons.map((lesson) => lesson.id);
  await request(app).get(`/api/lessons/${opened}`); // the owner opens one lesson
  await request(app).put(`/api/lessons/${opened}/progress`).send({ completed: true });
  return { course, opened, notOpened };
}

const share = (courseId, shared, user) => {
  const req = request(app).put(`/api/courses/${courseId}/share`).send({ shared });
  return user ? req.set('x-dev-user', user) : req;
};

let fetchSpy;
beforeEach(() => {
  generateLessonContent.mockReset().mockImplementation(async () => validLessonReply());
  fetchSpy = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PUT /api/courses/:id/share', () => {
  it('creates an unguessable link, keeps it while shared, and revokes it', async () => {
    const { course } = await seedCourse();

    const first = await share(course.id, true);
    expect(first.status).toBe(200);
    expect(first.body.shareId).toMatch(/^[\w-]{22}$/);
    expect((await share(course.id, true)).body.shareId).toBe(first.body.shareId);

    expect((await share(course.id, false)).body).toEqual({ shareId: null });
    const again = await share(course.id, true);
    expect(again.body.shareId).not.toBe(first.body.shareId); // old link stays dead
  });

  it("refuses to share someone else's course", async () => {
    const { course } = await seedCourse();

    expect((await share(course.id, true, 'auth0|someone-else')).status).toBe(404);
  });

  it('includes the share id in the owner’s course data', async () => {
    const { course } = await seedCourse();
    const { body } = await share(course.id, true);

    const own = await request(app).get(`/api/courses/${course.id}`);
    expect(own.body.shareId).toBe(body.shareId);
  });
});

describe('GET /api/public/courses/:shareId', () => {
  it('shows a shared course to anyone, without a login', async () => {
    const { course } = await seedCourse();
    const { shareId } = (await share(course.id, true)).body;

    const res = await request(appWithAuth).get(`/api/public/courses/${shareId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: course.id, title: course.title, shareId });
    expect(res.body.modules).toHaveLength(3);
  });

  it("never exposes the owner's id or progress", async () => {
    const { course } = await seedCourse();
    const { shareId } = (await share(course.id, true)).body;

    const res = await request(app).get(`/api/public/courses/${shareId}`);
    const text = JSON.stringify(res.body);

    expect(text).not.toContain(DEV_USER_SUB);
    expect(res.body).not.toHaveProperty('creator');
    expect(res.body.modules[0].lessons[0]).toEqual({
      id: expect.any(String),
      title: 'Lesson 1.1',
      order: 0,
      isEnriched: true,
    });
  });

  it('answers 404 once sharing is turned off, and 400 for a malformed link', async () => {
    const { course } = await seedCourse();
    const { shareId } = (await share(course.id, true)).body;
    await share(course.id, false);

    expect((await request(app).get(`/api/public/courses/${shareId}`)).status).toBe(404);
    expect((await request(app).get('/api/public/courses/short')).status).toBe(400);
  });
});

describe('GET /api/public/courses/:shareId/lessons/:lessonId', () => {
  it('shows an opened lesson without the owner’s progress', async () => {
    const { course, opened } = await seedCourse();
    const { shareId } = (await share(course.id, true)).body;

    const res = await request(appWithAuth).get(`/api/public/courses/${shareId}/lessons/${opened}`);

    expect(res.status).toBe(200);
    expect(res.body.content.length).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty('completedAt');
    expect(res.body).not.toHaveProperty('quizResult');
  });

  it('never generates a lesson for a visitor', async () => {
    const { course, notOpened } = await seedCourse();
    const { shareId } = (await share(course.id, true)).body;
    generateLessonContent.mockClear();

    const res = await request(app).get(`/api/public/courses/${shareId}/lessons/${notOpened}`);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("This lesson hasn't been written yet");
    expect(generateLessonContent).not.toHaveBeenCalled();
  });

  it('only serves lessons that belong to the shared course', async () => {
    const shared = await seedCourse();
    const other = await seedCourse();
    const { shareId } = (await share(shared.course.id, true)).body;

    const res = await request(app).get(`/api/public/courses/${shareId}/lessons/${other.opened}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/public/videos', () => {
  it('serves previously found videos without ever calling YouTube', async () => {
    await VideoCache.create({ query: 'react hooks tutorial', results: [{ videoId: 'abc123' }] });

    const hit = await request(app)
      .get('/api/public/videos')
      .query({ query: 'React Hooks Tutorial' });
    const miss = await request(app).get('/api/public/videos').query({ query: 'never searched' });

    expect(hit.body.videos.map((v) => v.videoId)).toEqual(['abc123']);
    expect(miss.body.videos).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
