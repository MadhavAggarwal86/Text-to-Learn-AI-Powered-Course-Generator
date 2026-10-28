import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  if (!env.MONGO_URI) {
    console.warn('MONGO_URI is not set: starting without a database connection.');
    return;
  }

  // Fail fast at startup if Atlas is unreachable (wrong URI, IP not allowed) instead of 30 s.
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export function dbStatus() {
  if (!env.MONGO_URI) return 'not configured';
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}
