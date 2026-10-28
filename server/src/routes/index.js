import { Router } from 'express';
import { createAuthenticate, createSyncUser } from '../middlewares/auth.js';
import { createRateLimiters } from '../middlewares/rateLimit.js';
import { requireDb } from '../middlewares/requireDb.js';
import { createCourseRouter } from './course.routes.js';
import healthRoutes from './health.routes.js';
import { createLessonRouter } from './lesson.routes.js';
import { createUserRouter } from './user.routes.js';

/** `authConfig`: Auth0 settings, or null to run as the local dev user (see middlewares/auth.js). */
export function createApiRouter({ authConfig }) {
  const router = Router();
  const limiters = createRateLimiters();

  // Signed-in routes: identify the user, rate-limit per user, check the DB, then make sure
  // the user is saved. Attached per path (not with a bare router.use) so unknown /api URLs
  // still get a 404 rather than a 401/503.
  const signedIn = [
    ...createAuthenticate(authConfig),
    limiters.api,
    requireDb,
    ...createSyncUser(authConfig),
  ];

  router.use('/health', healthRoutes);
  router.use('/users', ...signedIn, createUserRouter());
  router.use('/courses', ...signedIn, createCourseRouter(limiters));
  router.use('/lessons', ...signedIn, createLessonRouter(limiters));

  return router;
}
