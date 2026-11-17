import { PORT, DATABASE_PATH } from './config.js';
import { getDatabase, closeDatabase } from './lib/db.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const db = getDatabase();
const app = createApp(db);

const server = app.listen(PORT, () => {
  logger.info({
    message: `Server started successfully`,
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
  });
});

function handleShutdown(signal: string) {
  logger.info({ message: `Received ${signal}, closing server and database gracefully.` });
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export { app, server };
