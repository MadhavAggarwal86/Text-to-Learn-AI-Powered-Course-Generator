import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5050),
  CLIENT_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  // Required in production (checked below). Locally the API still starts without it,
  // but course routes answer 503; tests use an in-memory server.
  MONGO_URI: z.string().trim().optional().default(''),

  // Gemini. Without a key the server still runs; AI routes answer 503.
  GEMINI_API_KEY: z.string().trim().optional().default(''),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.5-flash-lite'),
  // Tried when the main model is overloaded or times out. Set to an empty value to disable.
  GEMINI_FALLBACK_MODEL: z.string().trim().default('gemini-3.1-flash-lite'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  // Text-to-speech for the Hinglish audio explanation (~20-35 s for 2 minutes of audio).
  GEMINI_TTS_MODEL: z.string().trim().min(1).default('gemini-3.8-flash-lite-tts'),
  GEMINI_TTS_FALLBACK_MODEL: z.string().trim().default('gemini-3.8-flash-tts'),
  GEMINI_TTS_VOICE: z.string().trim().min(1).default('Kore'),
  GEMINI_TTS_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),

  // Auth0. Required in production. Locally, leaving both empty runs the API as a single
  // dev user (see middlewares/auth.js) so it can be developed without an Auth0 tenant.
  AUTH0_ISSUER: z.union([z.url(), z.literal('')]).default(''), // e.g. https://tenant.auth0.com/
  AUTH0_AUDIENCE: z.string().trim().default(''), // the Auth0 API identifier

  // YouTube Data API v3. Optional: without it lessons show a "search on YouTube" link.
  YOUTUBE_API_KEY: z.string().trim().default(''),
});

const parsed = envSchema
  .refine((vars) => vars.NODE_ENV !== 'production' || vars.MONGO_URI, {
    message: 'MONGO_URI is required in production',
    path: ['MONGO_URI'],
  })
  .refine((vars) => Boolean(vars.AUTH0_ISSUER) === Boolean(vars.AUTH0_AUDIENCE), {
    message: 'Set both AUTH0_ISSUER and AUTH0_AUDIENCE, or neither',
    path: ['AUTH0_AUDIENCE'],
  })
  .refine((vars) => vars.NODE_ENV !== 'production' || vars.AUTH0_ISSUER, {
    message: 'Auth0 (AUTH0_ISSUER, AUTH0_AUDIENCE) is required in production',
    path: ['AUTH0_ISSUER'],
  })
  .safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
