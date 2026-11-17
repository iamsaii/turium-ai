import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { startIngestion } from '../services/ingestion.service.js';
import { BadRequestError } from '../lib/errors.js';
import { MAX_TEXT_SIZE_BYTES } from '../config.js';

export function createIngestRouter(db?: DatabaseSync): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { type, content, title } = req.body || {};

      if (!type || (type !== 'note' && type !== 'url')) {
        throw new BadRequestError("Invalid type. Must be either 'note' or 'url'.");
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new BadRequestError('Content must be a non-empty string.');
      }

      if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_SIZE_BYTES) {
        throw new BadRequestError(
          `Content exceeds maximum permitted size of ${MAX_TEXT_SIZE_BYTES} bytes.`
        );
      }

      if (title !== undefined && (typeof title !== 'string' || title.length > 200)) {
        throw new BadRequestError('Title must be a string up to 200 characters.');
      }

      const item = await startIngestion(
        {
          type,
          content: content.trim(),
          title: title?.trim(),
        },
        db
      );

      res.status(202).json(item);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
