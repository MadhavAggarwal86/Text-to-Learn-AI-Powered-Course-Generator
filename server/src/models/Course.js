import mongoose from 'mongoose';
import { DIFFICULTIES, LIMITS, schemaOptions } from './constants.js';

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: LIMITS.title },
    description: { type: String, trim: true, maxlength: LIMITS.description, default: '' },
    // The topic the user typed, kept so a course can be regenerated or audited later.
    prompt: {
      type: String,
      required: true,
      trim: true,
      minlength: LIMITS.topic.min,
      maxlength: LIMITS.topic.max,
    },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'beginner' },
    creator: { type: String, required: true }, // Auth0 `sub`
    modules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
    tags: [{ type: String, trim: true, lowercase: true }],
    // Set while the course is shared: the random id in its public link. Removed (not
    // nulled) when sharing stops, so the old link stops working.
    shareId: { type: String },
  },
  schemaOptions,
);

// "My courses, newest first" is the main listing query.
courseSchema.index({ creator: 1, createdAt: -1 });
// Public links look courses up by shareId. Partial: only shared courses are indexed, so the
// many unshared ones don't collide on a missing value.
courseSchema.index(
  { shareId: 1 },
  { unique: true, partialFilterExpression: { shareId: { $type: 'string' } } },
);

export const Course = mongoose.model('Course', courseSchema);
