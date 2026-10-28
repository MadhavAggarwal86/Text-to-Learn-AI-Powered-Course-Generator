import { Router } from 'express';
import { devUser } from '../middlewares/devUser.js';
import { createRateLimiters } from '../middlewares/rateLimit.js';
import { requireDb } from '../middlewares/requireDb.js';
import { createCourseRouter } from './course.routes.js';
import healthRoutes from './health.routes.js';
import { createLessonRouter } from './lesson.routes.js';

export function createApiRouter() {
  const router = Router();
  const limiters = createRateLimiters();

  // Course and lesson routes need a user and the database. Attached per path (not with a
  // bare router.use) so unknown /api URLs still get a 404 rather than a 503.
  const appRoute = [devUser, limiters.api, requireDb];

  router.use('/health', healthRoutes);
  router.use('/courses', ...appRoute, createCourseRouter(limiters));
  router.use('/lessons', ...appRoute, createLessonRouter(limiters));

  return router;
}
