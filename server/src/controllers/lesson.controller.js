import { getOrGenerateLesson, regenerateLesson } from '../services/lesson.service.js';
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
