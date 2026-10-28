import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { DEV_USER_SUB } from '../src/middlewares/devUser.js';
import { Lesson } from '../src/models/index.js';
import { generateLessonContent } from '../src/services/ai.service.js';
import { createCourseTree } from '../src/services/course.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import { validLessonReply } from './helpers/aiFixtures.js';
import { useTestDB } from './helpers/db.js';
import { makeOutline } from './helpers/fixtures.js';

vi.mock('../src/services/ai.service.js', () => ({
  generateCourseOutline: vi.fn(),
  generateLessonContent: vi.fn(),
}));

useTestDB();

const app = createApp();
const OTHER_USER = 'auth0|someone-else';

async function seedCourse() {
  const course = await createCourseTree({
    outline: makeOutline({ moduleCount: 3, lessonsPerModule: 3 }),
    creator: DEV_USER_SUB,
    prompt: 'Machine learning',
    difficulty: 'advanced',
  });
  const module = course.modules[1];
  return { course, module, lessonId: module.lessons[0].id };
}

const getLesson = (id) => request(app).get(`/api/lessons/${id}`);

beforeEach(() => {
  generateLessonContent.mockReset();
  generateLessonContent.mockImplementation(async () => validLessonReply());
});

describe('GET /api/lessons/:id', () => {
  it('generates the content on first open and saves it', async () => {
    const { lessonId } = await seedCourse();

    const res = await getLesson(lessonId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: lessonId, title: 'Lesson 2.1', isEnriched: true });
    expect(res.body.content).toHaveLength(validLessonReply().content.length);
    expect(res.body.objectives).toEqual(validLessonReply().objectives);

    const saved = await Lesson.findById(lessonId);
    expect(saved.isEnriched).toBe(true);
    expect(saved.resources).toHaveLength(1);
  });

  it('gives the AI the course, module, difficulty and sibling lesson titles', async () => {
    const { lessonId } = await seedCourse();

    await getLesson(lessonId);

    expect(generateLessonContent).toHaveBeenCalledWith({
      courseTitle: 'Introduction to Machine Learning',
      moduleTitle: 'Module 2',
      lessonTitle: 'Lesson 2.1',
      difficulty: 'advanced',
      siblingLessons: ['Lesson 2.1', 'Lesson 2.2', 'Lesson 2.3'],
    });
  });

  it('serves later requests from the database without calling the AI again', async () => {
    const { lessonId } = await seedCourse();

    await getLesson(lessonId);
    const second = await getLesson(lessonId);

    expect(second.status).toBe(200);
    expect(second.body.isEnriched).toBe(true);
    expect(generateLessonContent).toHaveBeenCalledTimes(1);
  });

  it('generates only once when the same lesson is requested concurrently', async () => {
    const { lessonId } = await seedCourse();
    // Long enough that all three requests arrive while the first generation is still
    // running, even on a busy machine (a real generation takes several seconds).
    generateLessonContent.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(validLessonReply()), 500)),
    );

    const responses = await Promise.all([
      getLesson(lessonId),
      getLesson(lessonId),
      getLesson(lessonId),
    ]);

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(generateLessonContent).toHaveBeenCalledTimes(1);
  });

  it('keeps the lesson unenriched when generation fails, so the next open retries', async () => {
    const { lessonId } = await seedCourse();
    generateLessonContent.mockRejectedValueOnce(
      new ApiError(502, 'The AI returned an invalid lesson. Please try again.'),
    );

    const failed = await getLesson(lessonId);
    expect(failed.status).toBe(502);
    expect(failed.body.error.message).toMatch(/invalid lesson/);
    expect((await Lesson.findById(lessonId)).isEnriched).toBe(false);

    const retried = await getLesson(lessonId);
    expect(retried.status).toBe(200);
    expect(generateLessonContent).toHaveBeenCalledTimes(2);
  });

  it("answers 404 for someone else's lesson without generating it", async () => {
    const { lessonId } = await seedCourse();

    const res = await request(app).get(`/api/lessons/${lessonId}`).set('x-dev-user', OTHER_USER);

    expect(res.status).toBe(404);
    expect(generateLessonContent).not.toHaveBeenCalled();
  });

  it('answers 400 for a malformed id and 404 for an unknown one', async () => {
    expect((await getLesson('nope')).status).toBe(400);
    expect((await getLesson('000000000000000000000000')).status).toBe(404);
  });
});

describe('POST /api/lessons/:id/regenerate', () => {
  it('replaces the existing content', async () => {
    const { lessonId } = await seedCourse();
    await getLesson(lessonId);
    const fresh = validLessonReply();
    fresh.objectives = ['Explain the new version'];
    fresh.objectives.push('Apply the new version');
    generateLessonContent.mockResolvedValueOnce(fresh);

    const res = await request(app).post(`/api/lessons/${lessonId}/regenerate`);

    expect(res.status).toBe(200);
    expect(res.body.objectives).toEqual(['Explain the new version', 'Apply the new version']);
    expect(generateLessonContent).toHaveBeenCalledTimes(2);
  });

  it("refuses to regenerate someone else's lesson", async () => {
    const { lessonId } = await seedCourse();

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/regenerate`)
      .set('x-dev-user', OTHER_USER);

    expect(res.status).toBe(404);
  });
});
