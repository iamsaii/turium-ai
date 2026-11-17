import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).id || (res.getHeader('X-Request-ID') as string);

  if (err instanceof AppError) {
    logger.warn({
      message: 'Operational application error',
      requestId,
      statusCode: err.statusCode,
      error: err.message,
    });
    res.status(err.statusCode).json({
      error: err.message,
      requestId,
    });
    return;
  }

  logger.error({
    message: 'Unhandled server exception',
    requestId,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    requestId,
  });
}
