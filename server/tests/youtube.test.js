import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { VideoCache } from '../src/models/index.js';
import {
  decodeEntities,
  findVideos,
  normalizeQuery,
  resetQuotaBackoff,
} from '../src/services/youtube.service.js';
import { useTestDB } from './helpers/db.js';

useTestDB();

const item = (videoId, title) => ({
  id: { kind: 'youtube#video', videoId },
  snippet: {
    title,
    channelTitle: 'Tom &amp; Friends',
    thumbnails: {
      default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` },
      high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
    },
  },
});

const json = (status, body) => new Response(JSON.stringify(body), { status });
const searchResponse = () =>
  json(200, {
    items: [
      item('abc123', 'React Hooks &#39;in&#39; 10 minutes'),
      item('def456', 'useEffect &quot;explained&quot;'),
      { id: { kind: 'youtube#channel', channelId: 'not-a-video' }, snippet: {} },
    ],
  });
const quotaResponse = () =>
  json(403, { error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } });

let youtube;
beforeEach(() => {
  resetQuotaBackoff();
  youtube = vi.fn(async () => searchResponse());
  vi.stubGlobal('fetch', youtube);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('helpers', () => {
  it('normalises queries so equivalent searches share a cache entry', () => {
    expect(normalizeQuery('  React   Hooks\tTutorial ')).toBe('react hooks tutorial');
  });

  it('decodes the HTML entities YouTube puts in titles', () => {
    expect(decodeEntities('Tom &amp; Jerry &#39;s &quot;best&quot; &#x2764; &copy;')).toBe(
      'Tom & Jerry \'s "best" ❤ &copy;',
    );
  });
});

describe('findVideos', () => {
  it('searches YouTube for embeddable, safe videos and returns tidy results', async () => {
    const videos = await findVideos('React hooks tutorial');

    expect(videos).toEqual([
      {
        videoId: 'abc123',
        title: "React Hooks 'in' 10 minutes",
        channelTitle: 'Tom & Friends',
        thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      },
      {
        videoId: 'def456',
        title: 'useEffect "explained"',
        channelTitle: 'Tom & Friends',
        thumbnail: 'https://i.ytimg.com/vi/def456/hqdefault.jpg',
      },
    ]);

    const url = new URL(youtube.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/youtube/v3/search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: 'react hooks tutorial',
      type: 'video',
      videoEmbeddable: 'true',
      safeSearch: 'strict',
      maxResults: '3',
      key: 'test-youtube-key',
    });
  });

  it('serves repeated and equivalent queries from the cache', async () => {
    await findVideos('React hooks tutorial');
    const again = await findVideos('  react HOOKS   tutorial');

    expect(again).toHaveLength(2);
    expect(youtube).toHaveBeenCalledTimes(1);
    expect(await VideoCache.countDocuments()).toBe(1);
  });

  it('makes one API call for identical searches running at the same time', async () => {
    const results = await Promise.all([
      findVideos('photosynthesis'),
      findVideos('Photosynthesis'),
      findVideos('photosynthesis '),
    ]);

    expect(results.every((r) => r.length === 2)).toBe(true);
    expect(youtube).toHaveBeenCalledTimes(1);
  });

  it('caches an empty result too, so a query with no videos is not searched again', async () => {
    youtube.mockResolvedValue(json(200, { items: [] }));

    expect(await findVideos('very obscure topic')).toEqual([]);
    expect(await findVideos('very obscure topic')).toEqual([]);
    expect(youtube).toHaveBeenCalledTimes(1);
  });

  it('stops calling YouTube for a while once the daily quota is used up', async () => {
    youtube.mockResolvedValue(quotaResponse());

    await expect(findVideos('first')).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/daily limit/),
    });
    await expect(findVideos('second')).rejects.toMatchObject({ statusCode: 503 });
    expect(youtube).toHaveBeenCalledTimes(1);
  });

  it('still answers cached queries while the quota is used up', async () => {
    await findVideos('cached topic');
    youtube.mockResolvedValue(quotaResponse());
    await findVideos('new topic').catch(() => {});

    expect(await findVideos('cached topic')).toHaveLength(2);
  });

  it('reports other API failures and network errors as 502 without caching them', async () => {
    youtube.mockResolvedValueOnce(json(400, { error: { errors: [{ reason: 'badRequest' }] } }));
    await expect(findVideos('topic')).rejects.toMatchObject({ statusCode: 502 });

    youtube.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(findVideos('topic')).rejects.toMatchObject({ statusCode: 502 });

    expect(await VideoCache.countDocuments()).toBe(0);
  });

  it('answers 503 without calling YouTube when no API key is configured', async () => {
    const key = env.YOUTUBE_API_KEY;
    env.YOUTUBE_API_KEY = '';
    try {
      await expect(findVideos('topic')).rejects.toMatchObject({
        statusCode: 503,
        message: 'Video search is not configured.',
      });
      expect(youtube).not.toHaveBeenCalled();
    } finally {
      env.YOUTUBE_API_KEY = key;
    }
  });
});

describe('GET /api/youtube', () => {
  const app = createApp();

  it('returns videos for a query', async () => {
    const res = await request(app).get('/api/youtube').query({ query: 'React hooks tutorial' });

    expect(res.status).toBe(200);
    expect(res.body.videos.map((v) => v.videoId)).toEqual(['abc123', 'def456']);
    expect(res.headers['cache-control']).toBe('private, max-age=86400');
  });

  it.each([[{}], [{ query: 'a' }], [{ query: 'x'.repeat(121) }]])(
    'rejects %j with 400',
    async (params) => {
      const res = await request(app).get('/api/youtube').query(params);

      expect(res.status).toBe(400);
      expect(res.body.error.details.query).toHaveProperty('query');
      expect(youtube).not.toHaveBeenCalled();
    },
  );

  it('passes the daily-limit message through as 503', async () => {
    youtube.mockResolvedValue(quotaResponse());

    const res = await request(app).get('/api/youtube').query({ query: 'anything' });

    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/daily limit/);
  });
});
