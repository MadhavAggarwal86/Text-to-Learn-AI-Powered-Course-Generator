import { Router } from 'express';
import { z } from 'zod';
import { getAudio, getTranscript } from '../controllers/audio.controller.js';
import {
  getLesson,
  postQuiz,
  postRegenerateLesson,
  putProgress,
} from '../controllers/lesson.controller.js';
import { objectId, validate } from '../middlewares/validate.js';
import { AUDIO_LANGUAGES } from '../services/audio.service.js';

const idParams = z.object({ id: objectId });
const audioQuery = z.object({ language: z.enum(AUDIO_LANGUAGES).default('hinglish') });
const progressBody = z.object({
  completed: z.boolean({ error: 'completed must be true or false' }),
});
// One chosen option index per question, in order (lessons have 3-5 questions).
const quizBody = z.object({ answers: z.array(z.number().int().min(0)).min(1).max(10) });

export function createLessonRouter(limiters) {
  const router = Router();

  router.get('/:id', validate({ params: idParams }), getLesson);
  router.post(
    '/:id/regenerate',
    validate({ params: idParams }),
    limiters.regenerateLesson,
    postRegenerateLesson,
  );
  router.put('/:id/progress', validate({ params: idParams, body: progressBody }), putProgress);
  router.post('/:id/quiz', validate({ params: idParams, body: quizBody }), postQuiz);
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
