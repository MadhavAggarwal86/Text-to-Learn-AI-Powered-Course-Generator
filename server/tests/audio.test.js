import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { DEV_USER_SUB } from '../src/middlewares/devUser.js';
import { Lesson } from '../src/models/index.js';
import { hinglishScriptSchema } from '../src/prompts/schemas.js';
import { generateHinglishScript, generateLessonContent } from '../src/services/ai.service.js';
import { narrationSource } from '../src/services/audio.service.js';
import { createCourseTree, deleteCourseTree } from '../src/services/course.service.js';
import { generateSpeech, GeminiError } from '../src/services/gemini.client.js';
import {
  isWav,
  pcmToWav,
  sampleRateFromMime,
  toWav,
  wavDurationSeconds,
} from '../src/utils/wav.js';
import { validLessonReply } from './helpers/aiFixtures.js';
import { useTestDB } from './helpers/db.js';
import { makeOutline } from './helpers/fixtures.js';

vi.mock('../src/services/ai.service.js', () => ({
  generateCourseOutline: vi.fn(),
  generateLessonContent: vi.fn(),
  generateHinglishScript: vi.fn(),
}));
// Replace only the network call; GeminiError stays real.
vi.mock('../src/services/gemini.client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateSpeech: vi.fn(),
}));

useTestDB();

const app = createApp();
const SCRIPT = 'Namaste! Aaj hum useEffect ke baare mein seekhenge. '.repeat(20).trim();
// One second of silence at 24 kHz, 16-bit mono.
const PCM_ONE_SECOND = Buffer.alloc(48_000);
const WAV_ONE_SECOND = pcmToWav(PCM_ONE_SECOND);

/** supertest: collect a binary body into a Buffer. */
const binary = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

async function seedLesson({ enriched = true } = {}) {
  const course = await createCourseTree({
    outline: makeOutline(),
    creator: DEV_USER_SUB,
    prompt: 'React',
    difficulty: 'beginner',
  });
  const lessonId = course.modules[0].lessons[0].id;
  if (enriched) {
    // Like lazy generation: the content is saved but the outline's lesson title is kept.
    const content = validLessonReply();
    delete content.title;
    await Lesson.updateOne({ _id: lessonId }, { ...content, isEnriched: true });
  }
  return { course, lessonId };
}

const getAudio = (lessonId, query = {}) =>
  request(app).get(`/api/lessons/${lessonId}/audio`).query(query).buffer(true).parse(binary);

const audioFiles = () => mongoose.connection.db.collection('lessonAudio.files').find().toArray();

beforeEach(() => {
  generateHinglishScript.mockReset().mockResolvedValue(SCRIPT);
  generateSpeech.mockReset().mockResolvedValue({ mimeType: 'audio/wav', data: WAV_ONE_SECOND });
  generateLessonContent.mockReset().mockResolvedValue(validLessonReply());
});

describe('wav helpers', () => {
  it('writes a standard 44-byte PCM WAV header', () => {
    const wav = pcmToWav(Buffer.alloc(100), { sampleRate: 16_000 });

    expect(wav.length).toBe(144);
    expect(isWav(wav)).toBe(true);
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(16_000);
    expect(wav.readUInt32LE(28)).toBe(32_000); // byte rate
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.toString('ascii', 36, 40)).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(100);
  });

  it('passes WAV through and wraps raw PCM using the rate in its MIME type', () => {
    expect(toWav(WAV_ONE_SECOND, 'audio/wav')).toBe(WAV_ONE_SECOND);

    const wrapped = toWav(Buffer.alloc(32_000), 'audio/L16;codec=pcm;rate=16000');
    expect(isWav(wrapped)).toBe(true);
    expect(wavDurationSeconds(wrapped)).toBe(1);
    expect(() => toWav(Buffer.from('mp3?'), 'audio/mpeg')).toThrow(/Unsupported audio format/);
  });

  it('reads the sample rate from MIME types, defaulting to 24 kHz', () => {
    expect(sampleRateFromMime('audio/l16; rate=24000; channels=1')).toBe(24_000);
    expect(sampleRateFromMime('audio/L16')).toBe(24_000);
  });

  it('measures duration even when extra chunks come before the data', () => {
    const wav = pcmToWav(PCM_ONE_SECOND);
    const list = Buffer.concat([
      Buffer.from('LIST'),
      Buffer.from([4, 0, 0, 0]),
      Buffer.from('INFO'),
    ]);
    const withList = Buffer.concat([wav.subarray(0, 36), list, wav.subarray(36)]);

    expect(wavDurationSeconds(withList)).toBe(1);
  });
});

describe('narration source and script rules', () => {
  it('narrates headings and paragraphs only, without Markdown', () => {
    const source = narrationSource({
      content: [
        { type: 'heading', text: 'Why **effects**' },
        { type: 'paragraph', text: 'Use `useEffect` for:\n- fetching\n- timers' },
        { type: 'code', language: 'js', text: 'secret code' },
        { type: 'video', query: 'video query' },
        { type: 'mcq', question: 'quiz?', options: ['a', 'b'], answer: 0, explanation: 'x' },
      ],
    });

    expect(source).toBe('Why effects\n\nUse useEffect for:\nfetching\ntimers');
  });

  it('caps very long lessons at a word boundary', () => {
    const source = narrationSource(
      { content: [{ type: 'paragraph', text: 'word '.repeat(5000) }] },
      100,
    );

    expect(source.length).toBeLessThanOrEqual(102);
    expect(source.endsWith(' …')).toBe(true);
  });

  it.each([
    ['too short', 'Namaste doston.'],
    ['Devanagari', `${SCRIPT} नमस्ते`],
    ['Markdown', `${SCRIPT} **bold**`],
    ['a URL', `${SCRIPT} https://example.com`],
  ])('rejects a script that is %s', (_, script) => {
    expect(hinglishScriptSchema.safeParse({ script }).success).toBe(false);
  });

  it('accepts a plain Hinglish script', () => {
    expect(hinglishScriptSchema.safeParse({ script: SCRIPT }).success).toBe(true);
  });
});

describe('GET /api/lessons/:id/audio', () => {
  it('creates the Hinglish explanation, stores it and returns a WAV', async () => {
    const { lessonId } = await seedLesson();

    const res = await getAudio(lessonId);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('audio/wav');
    expect(isWav(res.body)).toBe(true);
    expect(res.body.length).toBe(WAV_ONE_SECOND.length);
    expect(generateHinglishScript).toHaveBeenCalledWith({
      lessonTitle: 'Lesson 1.1',
      objectives: validLessonReply().objectives,
      source: expect.stringContaining('What is supervised learning?'),
    });
    expect(generateSpeech).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-tts-model', text: SCRIPT, voiceName: 'Kore' }),
    );

    const [file] = await audioFiles();
    expect(file.metadata).toMatchObject({ lessonId, language: 'hinglish', durationSec: 1 });
  });

  it('serves the stored audio on later requests without calling the AI', async () => {
    const { lessonId } = await seedLesson();

    await getAudio(lessonId);
    const again = await getAudio(lessonId);

    expect(again.status).toBe(200);
    expect(isWav(again.body)).toBe(true);
    expect(generateHinglishScript).toHaveBeenCalledTimes(1);
    expect(generateSpeech).toHaveBeenCalledTimes(1);
  });

  it('creates the audio once when it is requested several times at once', async () => {
    const { lessonId } = await seedLesson();

    const responses = await Promise.all([
      getAudio(lessonId),
      getAudio(lessonId),
      getAudio(lessonId),
    ]);

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(generateSpeech).toHaveBeenCalledTimes(1);
    expect(await audioFiles()).toHaveLength(1);
  });

  it('wraps raw PCM from older TTS models into a playable WAV', async () => {
    generateSpeech.mockResolvedValueOnce({
      mimeType: 'audio/L16;codec=pcm;rate=24000',
      data: PCM_ONE_SECOND,
    });
    const { lessonId } = await seedLesson();

    const res = await getAudio(lessonId);

    expect(isWav(res.body)).toBe(true);
    expect(res.body.length).toBe(PCM_ONE_SECOND.length + 44);
  });

  it('falls back to the second TTS model when the first is busy', async () => {
    generateSpeech.mockRejectedValueOnce(new GeminiError('busy', { kind: 'unavailable' }));
    const { lessonId } = await seedLesson();

    expect((await getAudio(lessonId)).status).toBe(200);
    expect(generateSpeech.mock.calls.map(([args]) => args.model)).toEqual([
      'test-tts-model',
      'test-tts-fallback',
    ]);
  });

  it('answers 503 and stores nothing when every TTS model is busy', async () => {
    generateSpeech.mockRejectedValue(new GeminiError('busy', { kind: 'timeout' }));
    const { lessonId } = await seedLesson();

    const res = await request(app).get(`/api/lessons/${lessonId}/audio`);

    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/audio service is busy/);
    expect(await audioFiles()).toHaveLength(0);
  });

  it('asks for the lesson to be opened first if it has no content yet', async () => {
    const { lessonId } = await seedLesson({ enriched: false });

    const res = await request(app).get(`/api/lessons/${lessonId}/audio`);

    expect(res.status).toBe(409);
    expect(generateHinglishScript).not.toHaveBeenCalled();
  });

  it("answers 404 for someone else's lesson and 400 for an unknown language", async () => {
    const { lessonId } = await seedLesson();

    const other = await request(app)
      .get(`/api/lessons/${lessonId}/audio`)
      .set('x-dev-user', 'auth0|someone-else');
    const badLanguage = await request(app)
      .get(`/api/lessons/${lessonId}/audio`)
      .query({ language: 'klingon' });

    expect(other.status).toBe(404);
    expect(badLanguage.status).toBe(400);
    expect(generateSpeech).not.toHaveBeenCalled();
  });
});

describe('GET /api/lessons/:id/audio/transcript', () => {
  it('returns the spoken script once the audio exists, and 404 before', async () => {
    const { lessonId } = await seedLesson();
    const transcriptUrl = `/api/lessons/${lessonId}/audio/transcript`;

    expect((await request(app).get(transcriptUrl)).status).toBe(404);

    await getAudio(lessonId);
    const res = await request(app).get(transcriptUrl);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ language: 'hinglish', script: SCRIPT, durationSec: 1 });
  });
});

describe('cleaning up stored audio', () => {
  it('deletes the old audio when the lesson is regenerated, then creates fresh audio', async () => {
    const { lessonId } = await seedLesson();
    await getAudio(lessonId);

    await request(app).post(`/api/lessons/${lessonId}/regenerate`);
    expect(await audioFiles()).toHaveLength(0);

    await getAudio(lessonId);
    expect(generateSpeech).toHaveBeenCalledTimes(2);
    expect(await audioFiles()).toHaveLength(1);
  });

  it('deletes all of a course’s audio (files and chunks) with the course', async () => {
    const { course, lessonId } = await seedLesson();
    await getAudio(lessonId);

    await deleteCourseTree(course.id);

    expect(await audioFiles()).toHaveLength(0);
    expect(await mongoose.connection.db.collection('lessonAudio.chunks').countDocuments()).toBe(0);
  });
});
