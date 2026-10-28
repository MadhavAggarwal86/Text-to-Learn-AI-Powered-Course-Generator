import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { DEV_USER_SUB } from '../src/middlewares/devUser.js';
import { Lesson } from '../src/models/index.js';
import { generateLessonContent } from '../src/services/ai.service.js';
import { createCourseTree } from '../src/services/course.service.js';
import { contentVersion } from '../src/services/lesson.service.js';
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
const OTHER_USER = 'auth0|someone-else';
// validLessonReply() has 3 questions; their correct options are 1, 1 and 1.
const ALL_RIGHT = [1, 1, 1];

async function seedCourse() {
  const course = await createCourseTree({
    outline: makeOutline(),
    creator: DEV_USER_SUB,
    prompt: 'React',
    difficulty: 'beginner',
  });
  const lessonId = course.modules[0].lessons[0].id;
  return { course, lessonId };
}

async function seedOpenedLesson() {
  const seeded = await seedCourse();
  await request(app).get(`/api/lessons/${seeded.lessonId}`); // generates the content
  return seeded;
}

const setCompleted = (id, completed) =>
  request(app).put(`/api/lessons/${id}/progress`).send({ completed });
const submitQuiz = (id, answers) => request(app).post(`/api/lessons/${id}/quiz`).send({ answers });

beforeEach(() => {
  generateLessonContent.mockReset().mockImplementation(async () => validLessonReply());
});

describe('PUT /api/lessons/:id/progress', () => {
  it('marks a lesson completed and back', async () => {
    const { lessonId } = await seedOpenedLesson();

    const done = await setCompleted(lessonId, true);
    expect(done.status).toBe(200);
    expect(new Date(done.body.completedAt).getTime()).toBeGreaterThan(Date.now() - 5000);

    const undone = await setCompleted(lessonId, false);
    expect(undone.body.completedAt).toBeNull();
  });

  it('shows completion in the course outline and the course list', async () => {
    const { course, lessonId } = await seedOpenedLesson();
    await setCompleted(lessonId, true);

    const outline = await request(app).get(`/api/courses/${course.id}`);
    expect(outline.body.modules[0].lessons[0].completedAt).toEqual(expect.any(String));
    expect(outline.body.modules[0].lessons[1].completedAt).toBeNull();

    const list = await request(app).get('/api/courses');
    expect(list.body[0]).toMatchObject({ lessonCount: 9, generatedCount: 1, completedCount: 1 });
  });

  it('refuses lessons that have not been generated yet', async () => {
    const { lessonId } = await seedCourse();

    expect((await setCompleted(lessonId, true)).status).toBe(409);
  });

  it("validates the body and refuses someone else's lesson", async () => {
    const { lessonId } = await seedOpenedLesson();

    expect((await setCompleted(lessonId, 'yes')).status).toBe(400);
    const other = await request(app)
      .put(`/api/lessons/${lessonId}/progress`)
      .set('x-dev-user', OTHER_USER)
      .send({ completed: true });
    expect(other.status).toBe(404);
  });
});

describe('POST /api/lessons/:id/quiz', () => {
  it('grades the attempt on the server and completes the lesson on a pass', async () => {
    const { lessonId } = await seedOpenedLesson();

    const res = await submitQuiz(lessonId, ALL_RIGHT);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      passed: true,
      quizResult: { correct: 3, total: 3, bestCorrect: 3, attempts: 1 },
      completedAt: expect.any(String),
    });
    expect(res.body.results).toEqual([
      { chosen: 1, answer: 1, correct: true },
      { chosen: 1, answer: 1, correct: true },
      { chosen: 1, answer: 1, correct: true },
    ]);
  });

  it('does not complete the lesson below 60%', async () => {
    const { lessonId } = await seedOpenedLesson();

    const res = await submitQuiz(lessonId, [0, 1, 0]); // 1 of 3

    expect(res.body).toMatchObject({ passed: false, completedAt: null });
    expect(res.body.quizResult).toMatchObject({ correct: 1, total: 3 });
  });

  it('keeps the latest score, the best score and the number of attempts', async () => {
    const { lessonId } = await seedOpenedLesson();

    await submitQuiz(lessonId, ALL_RIGHT);
    const second = await submitQuiz(lessonId, [0, 0, 1]);

    expect(second.body.quizResult).toMatchObject({ correct: 1, bestCorrect: 3, attempts: 2 });
    // A worse retry doesn't undo an earlier completion.
    expect(second.body.completedAt).toEqual(expect.any(String));
  });

  it.each([
    [[1, 1], /Expected 3 answers, got 2/],
    [[1, 1, 7], /Answer 3 is not one of the options/],
  ])('rejects %j with 400', async (answers, message) => {
    const { lessonId } = await seedOpenedLesson();

    const res = await submitQuiz(lessonId, answers);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(message);
  });

  it('rejects malformed answers', async () => {
    const { lessonId } = await seedOpenedLesson();

    expect((await submitQuiz(lessonId, ['b', 1, 1])).status).toBe(400);
    expect((await submitQuiz(lessonId, [])).status).toBe(400);
  });
});

describe('content version', () => {
  it('stays the same when progress is saved, so stored audio and the quiz stay valid', async () => {
    const { lessonId } = await seedOpenedLesson();
    const before = await Lesson.findById(lessonId);

    await setCompleted(lessonId, true);
    await submitQuiz(lessonId, ALL_RIGHT);
    const after = await Lesson.findById(lessonId);

    // updatedAt moves with every save (which is why it can't version the content)...
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    // ...while the content version doesn't.
    expect(contentVersion(after)).toBe(contentVersion(before));
  });

  it('changes on regenerate, which also clears the old quiz result', async () => {
    const { lessonId } = await seedOpenedLesson();
    await submitQuiz(lessonId, ALL_RIGHT);
    const before = await Lesson.findById(lessonId);

    await request(app).post(`/api/lessons/${lessonId}/regenerate`);
    const after = await Lesson.findById(lessonId);

    expect(contentVersion(after)).not.toBe(contentVersion(before));
    expect(after.quizResult).toBeNull();
    expect(after.completedAt).toEqual(before.completedAt); // learning the topic still counts
  });

  it('falls back to updatedAt for lessons generated before enrichedAt existed', () => {
    const updatedAt = new Date('2026-10-28T08:00:00Z');

    expect(contentVersion({ enrichedAt: null, updatedAt })).toBe(updatedAt.toISOString());
  });
});
