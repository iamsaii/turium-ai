import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { itemsRepo } from '../repositories/items.repository.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

export function createItemsRouter(db?: DatabaseSync): Router {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      const items = itemsRepo.getAllItemMetadata(db);
      res.status(200).json(items);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        throw new BadRequestError('Item ID must be an integer.');
      }

      const deleted = itemsRepo.deleteItemById(id, db);
      if (!deleted) {
        throw new NotFoundError(`Item with ID ${id} not found.`);
      }

      res.status(200).json({ success: true, message: 'Item deleted' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
