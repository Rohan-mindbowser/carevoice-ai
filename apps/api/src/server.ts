import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './observability/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'CareVoice AI API listening');
});

// Graceful shutdown (spec §15 groundwork): stop accepting connections, drain, then exit.
function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
  // Force-exit if connections fail to drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
