import { InvalidTokenError, UnauthorizedError } from 'express-oauth2-jwt-bearer';
import mongoose from 'mongoose';
import { isProduction } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Express recognises error handlers by their four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof mongoose.Error.CastError) {
    err = ApiError.badRequest(`Invalid ${err.path}`);
  }
  if (err instanceof UnauthorizedError) {
    // Keep the WWW-Authenticate header the JWT middleware attaches (RFC 6750).
    if (err.headers) res.set(err.headers);
    err = new ApiError(
      401,
      err instanceof InvalidTokenError
        ? 'Your session is invalid or has expired. Please log in again.'
        : 'Please log in to continue.',
    );
  }

  const statusCode = err.statusCode ?? err.status ?? 500;
  const isServerError = statusCode >= 500;
  // ApiErrors carry messages written for users ("The AI service is busy..."); anything
  // else is unexpected and its message may leak internals, so hide it in production.
  const isExpected = err instanceof ApiError;

  if (isServerError && isExpected) {
    console.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`);
  } else if (isServerError) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message: isServerError && isProduction && !isExpected ? 'Internal server error' : err.message,
      ...(err.details && { details: err.details }),
      ...(!isProduction && isServerError && !isExpected && { stack: err.stack }),
    },
  });
}
