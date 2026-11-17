import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../lib/db.js';

export const chunksRepo = {
  insertChunks(
    chunks: Array<{ itemId: number; chunkIndex: number; content: string; embedding: Buffer }>,
    dbInstance?: DatabaseSync
  ): void {
    if (chunks.length === 0) return;
    const db = dbInstance || getDatabase();

    db.exec('BEGIN TRANSACTION;');
    try {
      const stmt = db.prepare(
        `INSERT INTO chunks (item_id, chunk_index, content, embedding)
         VALUES (?, ?, ?, ?)`
      );
      for (const c of chunks) {
        stmt.run(c.itemId, c.chunkIndex, c.content, c.embedding);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  getReadyVectorIndex(dbInstance?: DatabaseSync): Array<{ id: number; embedding: Buffer }> {
    const db = dbInstance || getDatabase();
    // Stage 1: Vector scan query - only fetch id and embedding for chunks belonging to ready items
    const rows = db
      .prepare(
        `SELECT c.id, c.embedding
         FROM chunks c
         JOIN items i ON c.item_id = i.id
         WHERE i.status = 'ready'`
      )
      .all() as any[];

    return rows.map((r) => ({
      id: Number(r.id),
      embedding: Buffer.isBuffer(r.embedding) ? r.embedding : Buffer.from(r.embedding),
    }));
  },

  getChunksByIds(
    ids: number[],
    dbInstance?: DatabaseSync
  ): Array<{ id: number; itemId: number; title: string; sourceUrl: string | null; content: string }> {
    if (ids.length === 0) return [];
    const db = dbInstance || getDatabase();

    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT c.id, c.item_id, c.content, i.title, i.source_url
         FROM chunks c
         JOIN items i ON c.item_id = i.id
         WHERE c.id IN (${placeholders})`
      )
      .all(...ids) as any[];

    return rows.map((r) => ({
      id: Number(r.id),
      itemId: Number(r.item_id),
      title: r.title,
      sourceUrl: r.source_url,
      content: r.content,
    }));
  },
};
