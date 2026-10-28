import mongoose from 'mongoose';
import { schemaOptions } from './constants.js';

// Upserted from the Auth0 token on the first authenticated request (Phase 6).
const userSchema = new mongoose.Schema(
  {
    sub: { type: String, required: true, unique: true, trim: true }, // Auth0 user id
    email: { type: String, trim: true, lowercase: true },
    name: { type: String, trim: true },
    picture: { type: String, trim: true },
  },
  schemaOptions,
);

export const User = mongoose.model('User', userSchema);
