import mongoose from 'mongoose';
import { BLOCK_TYPES, LIMITS, schemaOptions } from './constants.js';

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true, match: /^https?:\/\/\S+$/i },
  },
  { _id: false, id: false },
);

const isValidBlock = (block) =>
  block !== null && typeof block === 'object' && BLOCK_TYPES.includes(block.type);

const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: LIMITS.title },
    order: { type: Number, required: true, min: 0 }, // 0-based position within the module
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    // Denormalised so ownership checks need one lookup instead of lesson → module → course.
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    // Empty until the lesson is first opened and generated (lazy enrichment).
    objectives: [{ type: String, trim: true }],
    keyTopics: [{ type: String, trim: true }],
    content: {
      type: [mongoose.Schema.Types.Mixed], // structured blocks: heading, paragraph, code, video, mcq
      default: [],
      validate: {
        validator: (blocks) => blocks.every(isValidBlock),
        message: `Every content block needs a type of: ${BLOCK_TYPES.join(', ')}`,
      },
    },
    resources: { type: [resourceSchema], default: [] },
    isEnriched: { type: Boolean, default: false },
  },
  schemaOptions,
);

// Runs on save()/validate(). An enriched lesson must actually have content.
lessonSchema.pre('validate', function () {
  if (this.isEnriched && this.content.length === 0) {
    this.invalidate('content', 'An enriched lesson must have at least one content block');
  }
});

export const Lesson = mongoose.model('Lesson', lessonSchema);
