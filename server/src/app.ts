import express, { Express } from 'express';
import cors from 'cors';
import type { DatabaseSync } from 'node:sqlite';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createIngestRouter } from './routes/ingest.routes.js';
import { createItemsRouter } from './routes/items.routes.js';
import { createQueryRouter } from './routes/query.routes.js';

export function createApp(db?: DatabaseSync): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '500kb' }));
  app.use(requestLogger);

  app.use('/api/health', createHealthRouter());
  app.use('/api/ingest', createIngestRouter(db));
  app.use('/api/items', createItemsRouter(db));
  app.use('/api/query', createQueryRouter(db));

  app.use(errorHandler);

  return app;
}
