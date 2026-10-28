import { pipeline } from 'node:stream/promises';
import { getAudioTranscript, getLessonAudio } from '../services/audio.service.js';
import { openAudioStream } from '../services/audioStore.js';
import { ApiError } from '../utils/ApiError.js';

const lessonNotFound = () => ApiError.notFound('Lesson not found');

/** GET /api/lessons/:id/audio?language=hinglish: the WAV, created on first request. */
export async function getAudio(req, res) {
  const { language } = req.validated.query;
  const file = await getLessonAudio(req.validated.params.id, req.user.sub, language);
  if (!file) throw lessonNotFound();

  res.set({
    'Content-Type': 'audio/wav',
    'Content-Length': String(file.length),
    'Content-Disposition': `inline; filename="${file.filename}"`,
    'Cache-Control': 'private, max-age=3600',
  });
  await pipeline(openAudioStream(file._id), res);
}

/** GET /api/lessons/:id/audio/transcript?language=hinglish: the spoken script. */
export async function getTranscript(req, res) {
  const { language } = req.validated.query;
  const transcript = await getAudioTranscript(req.validated.params.id, req.user.sub, language);
  if (!transcript) throw ApiError.notFound('No audio explanation has been created yet');
  res.json(transcript);
}
