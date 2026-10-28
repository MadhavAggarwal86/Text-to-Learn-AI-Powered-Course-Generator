import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Starts one in-memory MongoDB for the whole run (see tests/globalSetup.js).
    globalSetup: ['./tests/globalSetup.js'],
    // The first run downloads a MongoDB binary (~100 MB), which can take a while.
    hookTimeout: 180_000,
    testTimeout: 20_000,
  },
});
