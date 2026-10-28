import { Router } from 'express';
import { z } from 'zod';
import { objectId, validate } from '../middlewares/validate.js';
import { getSharedCourse, getSharedLesson } from '../services/share.service.js';
import { findCachedVideos } from '../services/youtube.service.js';
import { ApiError } from '../utils/ApiError.js';

// No login: everything here is read-only and limited to what a course owner chose to share.

const shareIdParam = z.string().regex(/^[\w-]{16,64}$/, 'must be a valid share link');
const courseParams = z.object({ shareId: shareIdParam });
const lessonParams = z.object({ shareId: shareIdParam, lessonId: objectId });
const videoQuery = z.object({ query: z.string().trim().min(2).max(120) });

const notShared = () => ApiError.notFound('This course is not shared, or the link has expired');

export function createPublicRouter() {
  const router = Router();

  /** GET /api/public/courses/:shareId */
  router.get('/courses/:shareId', validate({ params: courseParams }), async (req, res) => {
    const course = await getSharedCourse(req.validated.params.shareId);
    if (!course) throw notShared();
    res.json(course);
  });

  /** GET /api/public/courses/:shareId/lessons/:lessonId */
  router.get(
    '/courses/:shareId/lessons/:lessonId',
    validate({ params: lessonParams }),
    async (req, res) => {
      const { shareId, lessonId } = req.validated.params;
      const result = await getSharedLesson(shareId, lessonId);
      if (!result) throw notShared();
      if (result.notGenerated) {
        throw ApiError.notFound("This lesson hasn't been written yet");
      }
      res.json(result.lesson);
    },
  );

  /** GET /api/public/videos?query=: previously found videos only (no YouTube call). */
  router.get('/videos', validate({ query: videoQuery }), async (req, res) => {
    res.json({ videos: await findCachedVideos(req.validated.query.query) });
  });

  return router;
}
