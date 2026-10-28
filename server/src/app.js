import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
import { authConfigFromEnv } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { createApiRouter } from './routes/index.js';
import { ApiError } from './utils/ApiError.js';

/**
 * `authConfig` defaults to Auth0 from the environment (null = local dev user); tests pass
 * their own to sign tokens locally.
 */
export function createApp({ authConfig = authConfigFromEnv() } = {}) {
  const app = express();

  // Render sits behind one proxy; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);

  // First, so every request is logged, including ones refused by CORS below.
  if (env.NODE_ENV !== 'test') app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server requests (no Origin header) and listed origins.
        if (!origin || env.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
        // A refused website, not a server fault: 403 rather than a logged 500.
        callback(new ApiError(403, `Origin not allowed: ${origin}`));
      },
      // Let browsers reuse the preflight answer for 10 minutes instead of asking every request.
      maxAge: 600,
    }),
  );
  // gzip JSON responses (course outlines and lessons shrink ~70%); WAV audio is skipped.
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (req, res) => res.json({ name: 'Text-to-Learn API', health: '/api/health' }));
  app.use('/api', createApiRouter({ authConfig }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
