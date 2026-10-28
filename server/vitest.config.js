import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Starts one in-memory MongoDB for the whole run (see tests/globalSetup.js).
    globalSetup: ['./tests/globalSetup.js'],
    // The first run downloads a MongoDB binary (~100 MB), which can take a while.
    hookTimeout: 180_000,
    testTimeout: 20_000,
    // These win over server/.env (dotenv never overrides existing variables), so tests
    // never use the real Gemini key or depend on a developer's model choice.
    env: {
      GEMINI_API_KEY: '',
      GEMINI_MODEL: 'test-primary-model',
      GEMINI_FALLBACK_MODEL: 'test-fallback-model',
      // Most tests run as the dev user; tests/auth.test.js passes its own Auth0 config.
      AUTH0_ISSUER: '',
      AUTH0_AUDIENCE: '',
    },
  },
});
