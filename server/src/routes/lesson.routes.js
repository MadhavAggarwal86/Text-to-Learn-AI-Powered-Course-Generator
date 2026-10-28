import { Router } from 'express';
import { z } from 'zod';
import { getAudio, getTranscript } from '../controllers/audio.controller.js';
import { getLesson, postRegenerateLesson } from '../controllers/lesson.controller.js';
import { objectId, validate } from '../middlewares/validate.js';
import { AUDIO_LANGUAGES } from '../services/audio.service.js';

const idParams = z.object({ id: objectId });
const audioQuery = z.object({ language: z.enum(AUDIO_LANGUAGES).default('hinglish') });

export function createLessonRouter(limiters) {
  const router = Router();

  router.get('/:id', validate({ params: idParams }), getLesson);
  router.post(
    '/:id/regenerate',
    validate({ params: idParams }),
    limiters.regenerateLesson,
    postRegenerateLesson,
  );
  router.get(
    '/:id/audio',
    validate({ params: idParams, query: audioQuery }),
    limiters.audio,
    getAudio,
  );
  router.get(
    '/:id/audio/transcript',
    validate({ params: idParams, query: audioQuery }),
    getTranscript,
  );

  return router;
}
