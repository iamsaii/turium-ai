import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { executeQuery } from '../services/query.service.js';
import { BadRequestError } from '../lib/errors.js';

export function createQueryRouter(db?: DatabaseSync): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { question } = req.body || {};

      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        throw new BadRequestError('Question must be a non-empty string.');
      }

      if (question.length > 1000) {
        throw new BadRequestError('Question cannot exceed 1000 characters.');
      }

      const result = await executeQuery(question.trim(), db);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
