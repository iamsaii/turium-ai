import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createIngestRouter } from './routes/ingest.routes.js';
import { createItemsRouter } from './routes/items.routes.js';
import { createQueryRouter } from './routes/query.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(db?: DatabaseSync): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '500kb' }));
  app.use(requestLogger);

  app.use('/api/health', createHealthRouter());
  app.use('/api/ingest', createIngestRouter(db));
  app.use('/api/items', createItemsRouter(db));
  app.use('/api/query', createQueryRouter(db));

  // Serve static client assets in production if client build exists
  const clientDistCandidates = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
  ];
  const clientDistPath = clientDistCandidates.find((dir) =>
    fs.existsSync(path.join(dir, 'index.html'))
  );

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
