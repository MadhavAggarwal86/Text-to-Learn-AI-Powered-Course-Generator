import { createApp } from './src/app.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { env } from './src/config/env.js';

// Render's proxy keeps idle connections open for a while; if Node closed them first (its
// default is 5 s) a reused connection could fail with a 502. Stay open longer than the proxy.
const KEEP_ALIVE_TIMEOUT_MS = 65_000;
const SHUTDOWN_GRACE_MS = 10_000;

async function start() {
  await connectDB();

  const server = createApp().listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = KEEP_ALIVE_TIMEOUT_MS + 1000; // must exceed keepAliveTimeout

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    // Finish in-flight requests, but don't hang a deploy if one never ends.
    setTimeout(() => {
      console.error('Shutdown took too long, exiting');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();

    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// A bug that escapes every handler leaves the process in an unknown state: log it and exit
// so the host (Render) restarts a clean instance.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
