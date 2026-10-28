import mongoose from 'mongoose';
import { LIMITS, schemaOptions } from './constants.js';

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: LIMITS.title },
    order: { type: Number, required: true, min: 0 }, // 0-based position within the course
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
  },
  schemaOptions,
);

// `Module` would shadow Node's global name, so the export is CourseModule.
export const CourseModule = mongoose.model('Module', moduleSchema);
