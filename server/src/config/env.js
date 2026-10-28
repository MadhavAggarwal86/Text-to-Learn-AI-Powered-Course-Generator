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
});

const parsed = envSchema
  .refine((vars) => vars.NODE_ENV !== 'production' || vars.MONGO_URI, {
    message: 'MONGO_URI is required in production',
    path: ['MONGO_URI'],
  })
  .safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
