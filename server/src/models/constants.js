// Shared by the models now and by the AI prompt/validation schemas in Phase 2.

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export const BLOCK_TYPES = ['heading', 'paragraph', 'code', 'video', 'mcq'];

export const LIMITS = {
  topic: { min: 3, max: 200 },
  title: 200,
  description: 2000,
  modulesPerCourse: { min: 3, max: 6 },
  lessonsPerModule: { min: 3, max: 5 },
};

/** Common schema options: timestamps, and JSON output with `id` instead of `_id`/`__v`. */
export const schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
      delete ret._id;
      return ret;
    },
  },
};
