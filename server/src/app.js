import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
import { authConfigFromEnv } from './middlewares/auth.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { createApiRouter } from './routes/index.js';

/**
 * `authConfig` defaults to Auth0 from the environment (null = local dev user); tests pass
 * their own to sign tokens locally.
 */
export function createApp({ authConfig = authConfigFromEnv() } = {}) {
  const app = express();

  // Render sits behind one proxy; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server requests (no Origin header) and listed origins.
        if (!origin || env.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.get('/', (req, res) => res.json({ name: 'Text-to-Learn API', health: '/api/health' }));
  app.use('/api', createApiRouter({ authConfig }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
