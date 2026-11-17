import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../lib/db.js';
import type { Item } from '../types/index.js';

function mapRowToItem(r: any): Item {
  return {
    id: Number(r.id),
    type: r.type,
    title: r.title,
    sourceUrl: r.source_url,
    rawContent: r.raw_content,
    status: r.status,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    chunkCount: Number(r.chunk_count),
  };
}

export const itemsRepo = {
  createItem(
    data: { type: 'note' | 'url'; title: string; sourceUrl?: string | null; rawContent?: string },
    dbInstance?: DatabaseSync
  ): Item {
    const db = dbInstance || getDatabase();
    const result = db
      .prepare(
        `INSERT INTO items (type, title, source_url, raw_content, status, chunk_count)
         VALUES (?, ?, ?, ?, 'processing', 0)`
      )
      .run(data.type, data.title, data.sourceUrl || null, data.rawContent || '');

    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid) as any;
    return mapRowToItem(row);
  },

  getItemById(id: number, dbInstance?: DatabaseSync): Item | null {
    const db = dbInstance || getDatabase();
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any;
    return row ? mapRowToItem(row) : null;
  },

  getAllItemMetadata(dbInstance?: DatabaseSync): Omit<Item, 'rawContent'>[] {
    const db = dbInstance || getDatabase();
    const rows = db
      .prepare(
        `SELECT id, type, title, source_url, status, error_message, created_at, chunk_count
         FROM items
         ORDER BY created_at DESC`
      )
      .all() as any[];

    return rows.map((r) => ({
      id: Number(r.id),
      type: r.type,
      title: r.title,
      sourceUrl: r.source_url,
      status: r.status,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      chunkCount: Number(r.chunk_count),
    }));
  },

  updateItemReady(
    id: number,
    data: { title: string; rawContent: string; chunkCount: number },
    dbInstance?: DatabaseSync
  ): void {
    const db = dbInstance || getDatabase();
    db.prepare(
      `UPDATE items
       SET title = ?, raw_content = ?, chunk_count = ?, status = 'ready', error_message = null
       WHERE id = ?`
    ).run(data.title, data.rawContent, data.chunkCount, id);
  },

  updateItemFailed(id: number, errorMessage: string, dbInstance?: DatabaseSync): void {
    const db = dbInstance || getDatabase();
    db.prepare(
      `UPDATE items
       SET status = 'failed', error_message = ?
       WHERE id = ?`
    ).run(errorMessage, id);
  },

  deleteItemById(id: number, dbInstance?: DatabaseSync): boolean {
    const db = dbInstance || getDatabase();
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return (result.changes ?? 0) > 0;
  },
};
