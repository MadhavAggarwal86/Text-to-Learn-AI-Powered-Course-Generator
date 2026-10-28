import {
  getOrGenerateLesson,
  regenerateLesson,
  setLessonCompleted,
  submitQuiz,
} from '../services/lesson.service.js';
import { ApiError } from '../utils/ApiError.js';

const lessonNotFound = () => ApiError.notFound('Lesson not found');

/** GET /api/lessons/:id: generates the content on first open, then serves it from the DB. */
export async function getLesson(req, res) {
  const lesson = await getOrGenerateLesson(req.validated.params.id, req.user.sub);
  if (!lesson) throw lessonNotFound();
  res.json(lesson);
}

/** POST /api/lessons/:id/regenerate */
export async function postRegenerateLesson(req, res) {
  const lesson = await regenerateLesson(req.validated.params.id, req.user.sub);
  if (!lesson) throw lessonNotFound();
  res.json(lesson);
}

/** PUT /api/lessons/:id/progress { completed }: mark the lesson completed or not. */
export async function putProgress(req, res) {
  const lesson = await setLessonCompleted(
    req.validated.params.id,
    req.user.sub,
    req.validated.body.completed,
  );
  if (!lesson) throw lessonNotFound();
  res.json({ completedAt: lesson.completedAt, quizResult: lesson.quizResult });
}

/** POST /api/lessons/:id/quiz { answers }: grade an attempt and save the score. */
export async function postQuiz(req, res) {
  const result = await submitQuiz(
    req.validated.params.id,
    req.user.sub,
    req.validated.body.answers,
  );
  if (!result) throw lessonNotFound();
  res.json(result);
}
