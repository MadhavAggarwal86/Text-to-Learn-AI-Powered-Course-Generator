import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  if (!env.MONGO_URI) {
    console.warn('MONGO_URI is not set: starting without a database connection.');
    return;
  }

  await mongoose.connect(env.MONGO_URI);
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
