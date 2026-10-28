import { z } from 'zod';
import { env } from '../config/env.js';
import { generateCoursePrompt } from '../prompts/coursePrompt.js';
import { generateLessonPrompt } from '../prompts/lessonPrompt.js';
import { courseOutlineSchema, lessonContentSchema, toGeminiSchema } from '../prompts/schemas.js';
import { ApiError } from '../utils/ApiError.js';
import { generateJSON, GeminiError } from './gemini.client.js';
import { verifyResources } from './linkCheck.service.js';

// Invalid output gets one corrective retry; a second invalid reply fails the request.
const MAX_INVALID_REPLIES = 2;
const BLOCKED_REASONS = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'];

const outlineJsonSchema = toGeminiSchema(courseOutlineSchema);
const lessonJsonSchema = toGeminiSchema(lessonContentSchema);

/** Stage 1: topic → { title, description, tags, modules: [{ title, lessons: [title] }] }. */
export async function generateCourseOutline({ topic, difficulty }) {
  const { system, user } = generateCoursePrompt({ topic, difficulty });
  const outline = await generateValidated({
    task: 'course outline',
    system,
    prompt: user,
    schema: courseOutlineSchema,
    jsonSchema: outlineJsonSchema,
    temperature: 0.5,
    maxOutputTokens: 4096,
  });

  return { ...outline, tags: [...new Set(outline.tags.map((tag) => tag.toLowerCase()))] };
}

/**
 * Stage 2: lesson titles → { title, objectives, keyTopics, content[], resources[] }.
 * Resource links are checked before returning, since models sometimes invent URLs.
 */
export async function generateLessonContent(input) {
  const { system, user } = generateLessonPrompt(input);
  const lesson = await generateValidated({
    task: 'lesson',
    system,
    prompt: user,
    schema: lessonContentSchema,
    jsonSchema: lessonJsonSchema,
    temperature: 0.7,
    maxOutputTokens: 16_384,
  });

  return { ...lesson, resources: await verifyResources(lesson.resources, input.lessonTitle) };
}

/**
 * Turns a model reply into validated data. Tolerates the usual LLM wrapping (```json fences,
 * a sentence before or after the object) but nothing else.
 */
export function parseAIJson(text, schema) {
  const unfenced = text.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end < start)
    return { success: false, error: 'reply contained no JSON object' };

  let json;
  try {
    json = JSON.parse(unfenced.slice(start, end + 1));
  } catch (err) {
    return { success: false, error: `reply was not valid JSON (${err.message})` };
  }

  const result = schema.safeParse(json);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: z.prettifyError(result.error).slice(0, 1500) };
}

function modelsToTry() {
  return [...new Set([env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL].filter(Boolean))];
}

function log(message) {
  if (env.NODE_ENV !== 'test') console.info(`[ai] ${message}`);
}

/**
 * Calls Gemini until it returns output that passes `schema`:
 *  - transient failures (timeout, 5xx, 429) move on to the fallback model;
 *  - invalid output is retried once on the same model, with the validation errors attached;
 *  - configuration errors and blocked content fail immediately.
 */
async function generateValidated({ task, system, prompt, schema, jsonSchema, ...options }) {
  const models = modelsToTry();
  let modelIndex = 0;
  let invalidReplies = 0;
  let feedback = '';

  while (modelIndex < models.length) {
    const model = models[modelIndex];
    let reply;
    try {
      reply = await generateJSON({
        model,
        system,
        prompt: feedback ? `${prompt}\n\n${feedback}` : prompt,
        jsonSchema,
        ...options,
      });
    } catch (err) {
      if (err instanceof GeminiError && err.transient) {
        log(
          `${task}: ${model} failed (${err.kind}), ${modelIndex + 1 < models.length ? 'trying fallback' : 'giving up'}`,
        );
        modelIndex += 1;
        continue;
      }
      if (err instanceof GeminiError && err.kind === 'config') {
        console.error(`[ai] configuration problem: ${err.message}`);
        throw new ApiError(503, 'The AI service is not configured correctly.');
      }
      throw new ApiError(502, `The AI service could not generate the ${task}.`);
    }

    if (BLOCKED_REASONS.includes(reply.finishReason)) {
      throw new ApiError(
        422,
        `The AI declined to generate this ${task}. Try rephrasing the topic.`,
      );
    }

    const parsed = parseAIJson(reply.text, schema);
    if (parsed.success) {
      log(
        `${task} via ${model} in ${reply.durationMs}ms (${reply.usage?.totalTokenCount ?? '?'} tokens)`,
      );
      return parsed.data;
    }

    invalidReplies += 1;
    log(
      `${task}: invalid reply from ${model} (finish ${reply.finishReason}): ${parsed.error.split('\n')[0]}`,
    );
    if (invalidReplies >= MAX_INVALID_REPLIES) {
      throw new ApiError(502, `The AI returned an invalid ${task}. Please try again.`);
    }
    feedback = `Your previous reply was rejected for these problems:\n${parsed.error}\nReply again with a complete, corrected JSON object only.`;
  }

  throw new ApiError(503, 'The AI service is busy right now. Please try again in a minute.');
}
