import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Settings a deployed build cannot work without. Missing Auth0 values would silently build
// the local "dev mode" app, and a missing API URL would send requests to Vercel itself.
const REQUIRED_FOR_DEPLOY = [
  'VITE_API_URL',
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_AUDIENCE',
];

export default defineConfig(({ mode }) => {
  // Vercel sets VERCEL=1 for its builds; CI and local builds don't need these values.
  if (process.env.VERCEL && mode === 'production') {
    const vars = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = REQUIRED_FOR_DEPLOY.filter((name) => !vars[name]);
    if (missing.length) {
      throw new Error(
        `Missing environment variables for the Vercel build: ${missing.join(', ')}. ` +
          'Add them in Vercel → Project Settings → Environment Variables.',
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // In dev, forward API calls to the local Express server so no CORS setup is needed.
      proxy: {
        '/api': 'http://localhost:5050',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
    },
  };
});
