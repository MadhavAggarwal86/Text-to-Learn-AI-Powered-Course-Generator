import { Router } from 'express';
import { z } from 'zod';
import { getLesson, postRegenerateLesson } from '../controllers/lesson.controller.js';
import { objectId, validate } from '../middlewares/validate.js';

const idParams = z.object({ id: objectId });

export function createLessonRouter(limiters) {
  const router = Router();

  router.get('/:id', validate({ params: idParams }), getLesson);
  router.post(
    '/:id/regenerate',
    validate({ params: idParams }),
    limiters.regenerateLesson,
    postRegenerateLesson,
  );

  return router;
}
