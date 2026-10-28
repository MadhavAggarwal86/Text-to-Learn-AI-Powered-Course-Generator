import { Router } from 'express';
import { z } from 'zod';
import {
  deleteCourse,
  generateCourse,
  getCourse,
  getMyCourses,
} from '../controllers/course.controller.js';
import { objectId, validate } from '../middlewares/validate.js';
import { DIFFICULTIES, LIMITS } from '../models/constants.js';

const generateBody = z.object({
  topic: z
    .string({ error: 'topic is required' })
    .trim()
    .min(LIMITS.topic.min, `topic must be at least ${LIMITS.topic.min} characters`)
    .max(LIMITS.topic.max, `topic must be at most ${LIMITS.topic.max} characters`),
  difficulty: z.enum(DIFFICULTIES).default('beginner'),
});

const idParams = z.object({ id: objectId });

export function createCourseRouter(limiters) {
  const router = Router();

  // Validate first so malformed requests don't use up the user's generation quota.
  router.post(
    '/generate',
    validate({ body: generateBody }),
    limiters.generateCourse,
    generateCourse,
  );
  router.get('/', getMyCourses);
  router.get('/:id', validate({ params: idParams }), getCourse);
  router.delete('/:id', validate({ params: idParams }), deleteCourse);

  return router;
}
