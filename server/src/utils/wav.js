// Small WAV helpers for text-to-speech output. Gemini's newer TTS models return a complete
// WAV file; older ones return raw PCM samples (16-bit little-endian, mono, 24 kHz) that
// need the standard 44-byte RIFF header in front to be playable.

const HEADER_BYTES = 44;

export function isWav(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  );
}

/** Wraps raw PCM samples in a WAV (RIFF) header. */
export function pcmToWav(pcm, { sampleRate = 24_000, channels = 1, bitsPerSample = 16 } = {}) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(HEADER_BYTES);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4); // file size minus the first 8 bytes
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // audio format: PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** Sample rate from a MIME type like "audio/L16;codec=pcm;rate=24000" (default 24 kHz). */
export function sampleRateFromMime(mimeType = '') {
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : 24_000;
}

/** TTS output (WAV or raw PCM, by MIME type) → a playable WAV buffer. */
export function toWav(data, mimeType = '') {
  if (isWav(data)) return data;
  if (/^audio\/(l16|pcm)/i.test(mimeType)) {
    return pcmToWav(data, { sampleRate: sampleRateFromMime(mimeType) });
  }
  throw new Error(`Unsupported audio format: ${mimeType || 'unknown'}`);
}

/** Playback length in seconds, from a WAV's header (PCM only). */
export function wavDurationSeconds(wav) {
  const byteRate = wav.readUInt32LE(28);
  if (!byteRate) return 0;
  // Find the "data" chunk: some encoders add extra chunks before it.
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === 'data') return Math.min(size, wav.length - offset - 8) / byteRate;
    offset += 8 + size + (size % 2);
  }
  return 0;
}
