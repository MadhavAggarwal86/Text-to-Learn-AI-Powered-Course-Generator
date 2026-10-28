import { env } from '../config/env.js';
import { VideoCache } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

// Finds embeddable YouTube videos for a lesson's AI-written search query.
//
// The YouTube Data API allows 10,000 quota units a day and every search costs 100, so only
// ~100 uncached searches a day are possible. To stay well under that:
//  - results are cached in MongoDB per normalised query for 30 days (models/VideoCache.js);
//  - identical searches running at the same moment share one API call;
//  - once the daily quota runs out, no further calls are made for an hour.

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const MAX_RESULTS = 3;
const REQUEST_TIMEOUT_MS = 8000;
const QUOTA_BACKOFF_MS = 60 * 60 * 1000;

const inFlight = new Map();
let quotaExhaustedUntil = 0;

/** Lower-case, single-spaced: "React  Hooks " and "react hooks" share one cache entry. */
export const normalizeQuery = (query) => query.trim().replace(/\s+/g, ' ').toLowerCase();

// YouTube returns titles HTML-escaped ("Tom &amp; Jerry", "It&#39;s").
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(text = '') {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function toVideo(item) {
  const { snippet } = item;
  return {
    videoId: item.id.videoId,
    title: decodeEntities(snippet.title),
    channelTitle: decodeEntities(snippet.channelTitle),
    thumbnail: (snippet.thumbnails.high ?? snippet.thumbnails.medium ?? snippet.thumbnails.default)
      ?.url,
  };
}

async function searchYouTube(query) {
  const url = new URL(SEARCH_URL);
  const params = {
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    safeSearch: 'strict',
    relevanceLanguage: 'en',
    maxResults: String(MAX_RESULTS),
    q: query,
    key: env.YOUTUBE_API_KEY,
  };
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new ApiError(502, 'Could not reach YouTube. Please try again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      quotaExhaustedUntil = Date.now() + QUOTA_BACKOFF_MS;
      throw new ApiError(503, 'Video search has reached its daily limit. Please try again later.');
    }
    console.error(`[youtube] search failed: HTTP ${res.status} ${reason ?? ''}`);
    throw new ApiError(502, 'Video search failed. Please try again.');
  }

  const body = await res.json();
  return (body.items ?? []).filter((item) => item.id?.videoId).map(toVideo);
}

async function searchAndCache(query) {
  const results = await searchYouTube(query);
  // Upsert: if another server instance cached the same query meanwhile, just refresh it.
  await VideoCache.updateOne(
    { query },
    { $set: { results, createdAt: new Date() } },
    { upsert: true },
  );
  return results;
}

/** Up to 3 embeddable videos for a search query, from the cache when possible. */
export async function findVideos(rawQuery) {
  const query = normalizeQuery(rawQuery);

  const cached = await VideoCache.findOne({ query }).lean();
  if (cached) return cached.results;

  if (!env.YOUTUBE_API_KEY) {
    throw new ApiError(503, 'Video search is not configured.');
  }
  if (Date.now() < quotaExhaustedUntil) {
    throw new ApiError(503, 'Video search has reached its daily limit. Please try again later.');
  }

  if (!inFlight.has(query)) {
    inFlight.set(
      query,
      searchAndCache(query).finally(() => inFlight.delete(query)),
    );
  }
  return inFlight.get(query);
}

/** Test helper: forget the quota back-off. */
export function resetQuotaBackoff() {
  quotaExhaustedUntil = 0;
}
