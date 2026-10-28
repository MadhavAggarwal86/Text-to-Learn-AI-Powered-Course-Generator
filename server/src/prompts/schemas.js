import { z } from 'zod';
import { LIMITS } from '../models/constants.js';

// These schemas do double duty: they are sent to Gemini (as JSON Schema) to steer its
// structured output, and they validate whatever comes back. Rules JSON Schema cannot
// express (refinements) only run on our side.

const text = (max = 4000) => z.string().trim().min(1).max(max);
const title = z.string().trim().min(3).max(LIMITS.title);

// ---------------------------------------------------------------------------
// Course outline
// ---------------------------------------------------------------------------

export const courseOutlineSchema = z.object({
  title,
  description: z.string().trim().min(20).max(LIMITS.description),
  tags: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  modules: z
    .array(
      z.object({
        title,
        lessons: z.array(title).min(LIMITS.lessonsPerModule.min).max(LIMITS.lessonsPerModule.max),
      }),
    )
    .min(LIMITS.modulesPerCourse.min)
    .max(LIMITS.modulesPerCourse.max),
});

// ---------------------------------------------------------------------------
// Lesson content blocks (the format LessonRenderer understands)
// ---------------------------------------------------------------------------

export const LESSON_LIMITS = {
  objectives: { min: 2, max: 6 },
  keyTopics: { min: 2, max: 8 },
  resources: { min: 1, max: 5 },
  mcqs: { min: 3, max: 5 },
};

const headingBlock = z.object({ type: z.literal('heading'), text: text(LIMITS.title) });
const paragraphBlock = z.object({ type: z.literal('paragraph'), text: text() });
const codeBlock = z.object({
  type: z.literal('code'),
  language: z.string().trim().min(1).max(30),
  text: text(6000),
});
const videoBlock = z.object({ type: z.literal('video'), query: text(120) });
const mcqBlock = z
  .object({
    type: z.literal('mcq'),
    question: text(500),
    options: z.array(text(300)).min(2).max(6),
    answer: z.number().int().min(0),
    explanation: text(1000),
  })
  .refine((mcq) => mcq.answer < mcq.options.length, {
    message: 'answer must be the index of one of the options',
    path: ['answer'],
  });

export const contentBlockSchema = z.discriminatedUnion('type', [
  headingBlock,
  paragraphBlock,
  codeBlock,
  videoBlock,
  mcqBlock,
]);

const resourceSchema = z.object({
  title: text(200),
  url: z.url({ protocol: /^https?$/ }),
});

const countOf = (blocks, type) => blocks.filter((block) => block.type === type).length;

export const lessonContentSchema = z
  .object({
    title,
    objectives: z
      .array(text(300))
      .min(LESSON_LIMITS.objectives.min)
      .max(LESSON_LIMITS.objectives.max),
    keyTopics: z.array(text(100)).min(LESSON_LIMITS.keyTopics.min).max(LESSON_LIMITS.keyTopics.max),
    content: z.array(contentBlockSchema).min(4),
    resources: z
      .array(resourceSchema)
      .min(LESSON_LIMITS.resources.min)
      .max(LESSON_LIMITS.resources.max),
  })
  .superRefine((lesson, ctx) => {
    if (countOf(lesson.content, 'paragraph') === 0) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'needs at least one paragraph' });
    }
    if (countOf(lesson.content, 'video') !== 1) {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'needs exactly one video block' });
    }
    const mcqs = countOf(lesson.content, 'mcq');
    if (mcqs < LESSON_LIMITS.mcqs.min || mcqs > LESSON_LIMITS.mcqs.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['content'],
        message: `needs ${LESSON_LIMITS.mcqs.min}-${LESSON_LIMITS.mcqs.max} mcq blocks, got ${mcqs}`,
      });
    }
  });

/**
 * JSON Schema for Gemini's `responseJsonSchema`. Refinements are dropped, `$schema` is
 * removed and `oneOf` (from the discriminated union) becomes `anyOf`, which Gemini supports.
 */
export function toGeminiSchema(schema) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'any' });
  delete jsonSchema.$schema;
  return JSON.parse(JSON.stringify(jsonSchema).replaceAll('"oneOf":', '"anyOf":'));
}
