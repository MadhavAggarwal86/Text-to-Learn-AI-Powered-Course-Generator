import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { DEV_USER_SUB } from '../src/middlewares/devUser.js';
import { Course, CourseModule, Lesson } from '../src/models/index.js';
import { generateCourseOutline } from '../src/services/ai.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import { useTestDB } from './helpers/db.js';
import { makeOutline } from './helpers/fixtures.js';

vi.mock('../src/services/ai.service.js', () => ({
  generateCourseOutline: vi.fn(),
  generateLessonContent: vi.fn(),
}));

useTestDB();

const app = createApp();
const OTHER_USER = 'auth0|someone-else';

const generate = (body, agent = request(app)) => agent.post('/api/courses/generate').send(body);
const asOther = (req) => req.set('x-dev-user', OTHER_USER);

beforeEach(() => {
  generateCourseOutline.mockReset();
  generateCourseOutline.mockResolvedValue(makeOutline({ moduleCount: 3, lessonsPerModule: 4 }));
});

describe('POST /api/courses/generate', () => {
  it('generates and saves a course for the current user', async () => {
    const res = await generate({ topic: '  Machine learning  ', difficulty: 'intermediate' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Introduction to Machine Learning',
      prompt: 'Machine learning',
      difficulty: 'intermediate',
      creator: DEV_USER_SUB,
    });
    expect(res.body.modules).toHaveLength(3);
    expect(res.body.modules[0].lessons[0]).toMatchObject({
      title: 'Lesson 1.1',
      isEnriched: false,
    });
    expect(generateCourseOutline).toHaveBeenCalledWith({
      topic: 'Machine learning',
      difficulty: 'intermediate',
    });
    expect(await Lesson.countDocuments()).toBe(12);
  });

  it('defaults the difficulty to beginner', async () => {
    const res = await generate({ topic: 'Photosynthesis' });

    expect(res.body.difficulty).toBe('beginner');
  });

  it.each([
    [{}, 'topic'],
    [{ topic: 'ab' }, 'topic'],
    [{ topic: 'x'.repeat(201) }, 'topic'],
    [{ topic: 'Valid topic', difficulty: 'expert' }, 'difficulty'],
  ])('rejects %j with 400', async (body, field) => {
    const res = await generate(body);

    expect(res.status).toBe(400);
    expect(res.body.error.details.body).toHaveProperty(field);
    expect(generateCourseOutline).not.toHaveBeenCalled();
  });

  it('passes AI errors through with their status and saves nothing', async () => {
    generateCourseOutline.mockRejectedValueOnce(
      new ApiError(503, 'The AI service is busy right now. Please try again in a minute.'),
    );

    const res = await generate({ topic: 'Photosynthesis' });

    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/busy/);
    expect(await Course.countDocuments()).toBe(0);
  });

  it('allows 10 generations per hour per user, then answers 429', async () => {
    const freshApp = createApp(); // fresh rate-limit counters
    for (let i = 0; i < 10; i += 1) {
      expect((await generate({ topic: `Topic number ${i}` }, request(freshApp))).status).toBe(201);
    }

    const limited = await generate({ topic: 'One too many' }, request(freshApp));
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/10 courses per hour/);

    // The limit is per user: someone else can still generate.
    const other = await asOther(request(freshApp).post('/api/courses/generate')).send({
      topic: 'Photosynthesis',
    });
    expect(other.status).toBe(201);
  });

  it('does not count invalid requests against the limit', async () => {
    const freshApp = createApp();
    for (let i = 0; i < 12; i += 1) await generate({}, request(freshApp));

    expect((await generate({ topic: 'Photosynthesis' }, request(freshApp))).status).toBe(201);
  });
});

describe('GET /api/courses', () => {
  it("lists only the current user's courses, newest first, with lesson counts", async () => {
    const older = await generate({ topic: 'First topic' });
    const newer = await generate({ topic: 'Second topic' });
    await asOther(request(app).post('/api/courses/generate')).send({ topic: 'Not mine' });
    // Mark the first lesson of each of the 3 modules as generated.
    await Lesson.updateMany({ course: newer.body.id, order: 0 }, { isEnriched: true });

    const res = await request(app).get('/api/courses');

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual([newer.body.id, older.body.id]);
    expect(res.body[0]).toMatchObject({ moduleCount: 3, lessonCount: 12, generatedCount: 3 });
    expect(res.body[0]).not.toHaveProperty('modules');
  });

  it('returns an empty list for a new user', async () => {
    const res = await asOther(request(app).get('/api/courses'));

    expect(res.body).toEqual([]);
  });
});

describe('GET /api/courses/:id', () => {
  it('returns the course outline', async () => {
    const { body: created } = await generate({ topic: 'Photosynthesis' });

    const res = await request(app).get(`/api/courses/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.modules.map((m) => m.title)).toEqual(['Module 1', 'Module 2', 'Module 3']);
  });

  it('gzips the response for clients that accept it', async () => {
    const { body: created } = await generate({ topic: 'Photosynthesis' });

    const res = await request(app).get(`/api/courses/${created.id}`).set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body.modules).toHaveLength(3); // supertest decompresses transparently
  });

  it("answers 404 for someone else's course and for unknown ids", async () => {
    const { body: created } = await generate({ topic: 'Photosynthesis' });

    expect((await asOther(request(app).get(`/api/courses/${created.id}`))).status).toBe(404);
    expect((await request(app).get('/api/courses/000000000000000000000000')).status).toBe(404);
  });

  it('answers 400 for a malformed id', async () => {
    const res = await request(app).get('/api/courses/not-an-id');

    expect(res.status).toBe(400);
    expect(res.body.error.details.params).toHaveProperty('id');
  });
});

describe('DELETE /api/courses/:id', () => {
  it('deletes the course with its modules and lessons', async () => {
    const { body: created } = await generate({ topic: 'Photosynthesis' });

    const res = await request(app).delete(`/api/courses/${created.id}`);

    expect(res.status).toBe(204);
    expect(await Course.countDocuments()).toBe(0);
    expect(await CourseModule.countDocuments()).toBe(0);
    expect(await Lesson.countDocuments()).toBe(0);
  });

  it("refuses to delete someone else's course", async () => {
    const { body: created } = await generate({ topic: 'Photosynthesis' });

    const res = await asOther(request(app).delete(`/api/courses/${created.id}`));

    expect(res.status).toBe(404);
    expect(await Course.countDocuments()).toBe(1);
  });
});
