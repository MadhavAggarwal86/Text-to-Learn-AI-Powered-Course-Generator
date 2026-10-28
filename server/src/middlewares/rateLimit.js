import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

// Limits are per user (falling back to IP), so one person can't burn the shared
// Gemini quota. Each call creates fresh in-memory counters (one per app instance).

const HOUR = 60 * 60 * 1000;

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.sub ?? ipKeyGenerator(req.ip),
    handler: (req, res) => res.status(429).json({ error: { message } }),
  });
}

export function createRateLimiters() {
  return {
    // Every API call: generous, just stops runaway scripts.
    api: limiter({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      message: 'Too many requests. Please slow down.',
    }),
    // Each course generation is an AI call plus ~20 lessons generated later as they're opened.
    generateCourse: limiter({
      windowMs: HOUR,
      limit: 10,
      message: 'You can generate up to 10 courses per hour. Please try again later.',
    }),
    regenerateLesson: limiter({
      windowMs: HOUR,
      limit: 20,
      message: 'You can regenerate up to 20 lessons per hour. Please try again later.',
    }),
    // Opening a lesson makes one video request; most are cache hits, but each miss uses
    // 1% of the shared daily YouTube quota.
    // Creating an audio explanation is two AI calls (script + speech, ~30 s); replaying a
    // stored one is cheap but still counted.
    audio: limiter({
      windowMs: HOUR,
      limit: 30,
      message: 'You can play up to 30 audio explanations per hour. Please try again later.',
    }),
    videoSearch: limiter({
      windowMs: HOUR,
      limit: 60,
      message: 'Too many video searches. Please try again later.',
    }),
  };
}
