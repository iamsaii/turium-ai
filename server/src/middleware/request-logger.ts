import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      message: 'HTTP Request',
      requestId,
      method,
      url,
      statusCode: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}
