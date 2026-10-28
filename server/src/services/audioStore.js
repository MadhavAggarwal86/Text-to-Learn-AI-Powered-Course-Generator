import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';

// Lesson audio files live in MongoDB GridFS (bucket "lessonAudio"): a 2-minute WAV is
// ~6 MB, too big for a normal document. Each file's metadata records which lesson and
// language it belongs to, the lesson version it was made from, and the spoken script.

const BUCKET_NAME = 'lessonAudio';

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });

/** The newest stored audio for a lesson + language, or null. */
export async function findAudioFile(lessonId, language) {
  const [file] = await bucket()
    .find({ 'metadata.lessonId': String(lessonId), 'metadata.language': language })
    .sort({ uploadDate: -1 })
    .limit(1)
    .toArray();
  return file ?? null;
}

/** Saves a WAV buffer and returns the stored file document. */
export async function saveAudioFile(buffer, metadata) {
  const filename = `${metadata.lessonId}.${metadata.language}.wav`;
  const upload = bucket().openUploadStream(filename, { metadata });
  await pipeline(Readable.from([buffer]), upload);
  return bucket().find({ _id: upload.id }).next();
}

export function openAudioStream(fileId) {
  return bucket().openDownloadStream(fileId);
}

/** Deletes stored audio matching a filter on metadata (e.g. older versions of a lesson). */
export async function deleteAudioFiles(filter) {
  const files = await bucket()
    .find(filter, { projection: { _id: 1 } })
    .toArray();
  await Promise.all(files.map((file) => bucket().delete(file._id)));
  return files.length;
}

/** Frees the audio of lessons that were deleted or regenerated. */
export function deleteLessonAudio(lessonIds) {
  return deleteAudioFiles({ 'metadata.lessonId': { $in: lessonIds.map(String) } });
}
