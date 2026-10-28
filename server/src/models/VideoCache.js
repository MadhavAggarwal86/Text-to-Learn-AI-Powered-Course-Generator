import mongoose from 'mongoose';

export const VIDEO_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

const videoSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: String,
    channelTitle: String,
    thumbnail: String,
  },
  { _id: false, id: false },
);

// YouTube search results keyed by query. Each search costs 100 of the 10,000 daily quota
// units (~100 searches a day), so repeats are served from here for 30 days; MongoDB's TTL
// index then removes the entry so a fresh search can pick up newer videos.
const videoCacheSchema = new mongoose.Schema({
  query: { type: String, required: true, unique: true, trim: true, lowercase: true },
  results: { type: [videoSchema], default: [] },
  createdAt: { type: Date, default: Date.now, expires: VIDEO_CACHE_TTL_SECONDS },
});

export const VideoCache = mongoose.model('VideoCache', videoCacheSchema);
