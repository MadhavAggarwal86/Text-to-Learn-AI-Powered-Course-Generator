import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

const CONNECTED = 1;

/** Fails fast with 503 instead of letting Mongoose buffer queries for 10 seconds. */
export function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== CONNECTED) {
    return next(new ApiError(503, 'The database is not available right now.'));
  }
  next();
}
