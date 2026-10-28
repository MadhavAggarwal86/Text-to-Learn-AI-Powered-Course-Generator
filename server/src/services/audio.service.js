import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { toWav, wavDurationSeconds } from '../utils/wav.js';
import { generateHinglishScript } from './ai.service.js';
import { deleteAudioFiles, findAudioFile, saveAudioFile } from './audioStore.js';
import { generateSpeech, GeminiError } from './gemini.client.js';
import { contentVersion, findOwnedLesson } from './lesson.service.js';

// Audio explanations of lessons. Only Hinglish for now; the map is where Hindi or other
// languages would be added (each needs its own script prompt).
export const AUDIO_LANGUAGES = ['hinglish'];

const NARRATION_SOURCE_MAX_CHARS = 6000;

// Generation takes ~25-40 s, so concurrent requests for the same audio share one run.
const inFlight = new Map();

/**
 * The lesson's explanation as plain text for the script prompt: headings and paragraphs
 * only (code, quizzes and video queries aren't narrated), Markdown markers removed.
 */
export function narrationSource(lesson, maxChars = NARRATION_SOURCE_MAX_CHARS) {
  const text = lesson.content
    .filter((block) => block.type === 'heading' || block.type === 'paragraph')
    .map((block) => block.text.replace(/\*\*|`/g, '').replace(/^\s*[-*•]\s+/gm, ''))
    .join('\n\n');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, text.lastIndexOf(' ', maxChars))} …`;
}

/** Script → WAV, trying the fallback TTS model if the main one is busy or times out. */
async function synthesize(script) {
  const models = [
    ...new Set([env.GEMINI_TTS_MODEL, env.GEMINI_TTS_FALLBACK_MODEL].filter(Boolean)),
  ];

  for (const model of models) {
    try {
      const { data, mimeType } = await generateSpeech({
        model,
        text: script,
        voiceName: env.GEMINI_TTS_VOICE,
        timeoutMs: env.GEMINI_TTS_TIMEOUT_MS,
      });
      return toWav(data, mimeType);
    } catch (err) {
      if (err instanceof GeminiError && err.transient) {
        if (env.NODE_ENV !== 'test') console.info(`[audio] ${model} failed (${err.kind})`);
        continue;
      }
      if (err instanceof GeminiError && err.kind === 'config') {
        console.error(`[audio] configuration problem: ${err.message}`);
        throw new ApiError(503, 'The audio service is not configured correctly.');
      }
      console.error('[audio] text-to-speech failed', err);
      throw new ApiError(502, 'Could not create the audio explanation. Please try again.');
    }
  }
  throw new ApiError(503, 'The audio service is busy right now. Please try again in a minute.');
}

async function createAudio(lesson, language) {
  const script = await generateHinglishScript({
    lessonTitle: lesson.title,
    objectives: lesson.objectives,
    source: narrationSource(lesson),
  });
  const wav = await synthesize(script);

  const saved = await saveAudioFile(wav, {
    lessonId: String(lesson._id),
    language,
    lessonVersion: contentVersion(lesson),
    script,
    durationSec: Math.round(wavDurationSeconds(wav)),
    contentType: 'audio/wav',
  });
  // Drop any older version of this lesson's audio (~6 MB each on a 512 MB free tier).
  await deleteAudioFiles({
    'metadata.lessonId': String(lesson._id),
    'metadata.language': language,
    _id: { $ne: saved._id },
  });
  return saved;
}

const isCurrent = (file, lesson) => file?.metadata?.lessonVersion === contentVersion(lesson);

/**
 * The stored WAV for a lesson's audio explanation (a GridFS file document), creating it on
 * first request. Returns null if the lesson doesn't exist or belongs to someone else.
 */
export async function getLessonAudio(lessonId, creator, language) {
  const owned = await findOwnedLesson(lessonId, creator);
  if (!owned) return null;
  const { lesson } = owned;
  if (!lesson.isEnriched) {
    throw new ApiError(409, 'Open the lesson first: its content has not been generated yet.');
  }

  const existing = await findAudioFile(lesson._id, language);
  if (isCurrent(existing, lesson)) return existing;

  const key = `${lesson._id}:${language}`;
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      createAudio(lesson, language).finally(() => inFlight.delete(key)),
    );
  }
  return inFlight.get(key);
}

/** The spoken script of an already-created audio explanation, or null if there is none. */
export async function getAudioTranscript(lessonId, creator, language) {
  const owned = await findOwnedLesson(lessonId, creator);
  if (!owned) return null;

  const file = await findAudioFile(owned.lesson._id, language);
  if (!isCurrent(file, owned.lesson)) return null;
  const { script, durationSec } = file.metadata;
  return { language, script, durationSec };
}
