import mongoose from 'mongoose';

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

const videoSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: String,
    channelTitle: String,
    thumbnail: String,
  },
  { _id: false, id: false },
);

// YouTube search results keyed by query. Each search costs 100 quota units,
// so repeats are served from here; MongoDB's TTL index removes entries after 7 days.
const videoCacheSchema = new mongoose.Schema({
  query: { type: String, required: true, unique: true, trim: true, lowercase: true },
  results: { type: [videoSchema], default: [] },
  createdAt: { type: Date, default: Date.now, expires: CACHE_TTL_SECONDS },
});

export const VideoCache = mongoose.model('VideoCache', videoCacheSchema);
