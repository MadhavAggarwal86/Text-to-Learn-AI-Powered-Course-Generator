import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { findVideos } from '../services/youtube.service.js';

const searchQuery = z.object({
  query: z
    .string({ error: 'query is required' })
    .trim()
    .min(2, 'query must be at least 2 characters')
    .max(120, 'query must be at most 120 characters'),
});

export function createVideoRouter(limiters) {
  const router = Router();

  /** GET /api/youtube?query=...: up to 3 embeddable videos for a lesson's video block. */
  router.get('/', validate({ query: searchQuery }), limiters.videoSearch, async (req, res) => {
    const videos = await findVideos(req.validated.query.query);
    // Same answer for 30 days server-side; let the browser reuse it for a day.
    res.set('Cache-Control', 'private, max-age=86400');
    res.json({ videos });
  });

  return router;
}
