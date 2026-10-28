import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

/**
 * A failed Gemini call, classified so callers can decide what to do:
 *  - timeout / unavailable / rate_limited are transient: try another model or later.
 *  - config: bad key or unknown model; retrying will not help.
 *  - request: anything else the API rejected.
 */
export class GeminiError extends Error {
  constructor(message, { kind, status, cause } = {}) {
    super(message, { cause });
    this.name = 'GeminiError';
    this.kind = kind;
    this.status = status;
  }

  get transient() {
    return ['timeout', 'unavailable', 'rate_limited'].includes(this.kind);
  }
}

let client;

function getClient() {
  if (!env.GEMINI_API_KEY) {
    throw new GeminiError('GEMINI_API_KEY is not set', { kind: 'config' });
  }
  // The SDK retries up to 5 times with up to 60s waits by default; we retry ourselves
  // (with a fallback model) so a single request can never hang for minutes.
  client ??= new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  return client;
}

export function classifyError(err, { timedOut = false } = {}) {
  if (err instanceof GeminiError) return err;
  if (timedOut) return new GeminiError('Gemini request timed out', { kind: 'timeout', cause: err });

  const status = err?.status;
  const message = err?.message ?? String(err);
  if (status === 429) return new GeminiError(message, { kind: 'rate_limited', status, cause: err });
  if (status >= 500) return new GeminiError(message, { kind: 'unavailable', status, cause: err });
  if (
    [400, 401, 403, 404].includes(status) &&
    /api key|permission|not found|model/i.test(message)
  ) {
    return new GeminiError(message, { kind: 'config', status, cause: err });
  }
  if (status) return new GeminiError(message, { kind: 'request', status, cause: err });
  // No HTTP status: network failure (DNS, connection reset...). Worth another try.
  return new GeminiError(message, { kind: 'unavailable', cause: err });
}

/**
 * One structured-output call. Returns the raw text plus metadata; parsing and validation
 * are the caller's job so that invalid output can be retried with feedback.
 */
export async function generateJSON({
  model,
  system,
  prompt,
  jsonSchema,
  temperature,
  maxOutputTokens,
  timeoutMs = env.GEMINI_TIMEOUT_MS,
}) {
  const ai = getClient();
  const signal = AbortSignal.timeout(timeoutMs);
  const startedAt = Date.now();

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
        temperature,
        maxOutputTokens,
        abortSignal: signal,
      },
    });
  } catch (err) {
    throw classifyError(err, { timedOut: signal.aborted });
  }

  const candidate = response.candidates?.[0];
  return {
    model,
    text: response.text ?? '',
    finishReason: candidate?.finishReason ?? response.promptFeedback?.blockReason ?? 'UNKNOWN',
    durationMs: Date.now() - startedAt,
    usage: response.usageMetadata,
  };
}

/**
 * One text-to-speech call. Returns the audio bytes and their MIME type: some models send a
 * complete WAV file, others raw 16-bit PCM ("audio/L16;rate=24000"); utils/wav.js handles both.
 */
export async function generateSpeech({ model, text, voiceName, timeoutMs }) {
  const ai = getClient();
  const signal = AbortSignal.timeout(timeoutMs);

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        abortSignal: signal,
      },
    });
  } catch (err) {
    throw classifyError(err, { timedOut: signal.aborted });
  }

  const audio = response.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData,
  )?.inlineData;
  if (!audio?.data) {
    throw new GeminiError('Text-to-speech returned no audio', { kind: 'request' });
  }
  return { model, mimeType: audio.mimeType ?? '', data: Buffer.from(audio.data, 'base64') };
}
