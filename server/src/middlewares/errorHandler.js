import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Express recognises error handlers by their four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const isServerError = statusCode >= 500;

  if (isServerError) console.error(err);

  res.status(statusCode).json({
    error: {
      message: isServerError && isProduction ? 'Internal server error' : err.message,
      ...(err.details && { details: err.details }),
      ...(!isProduction && isServerError && { stack: err.stack }),
    },
  });
}
