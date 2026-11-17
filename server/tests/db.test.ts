import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initDatabase, getDatabase, closeDatabase } from '../src/lib/db.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Database Initialization & Schema', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('enforces foreign keys', () => {
    const row = db.prepare('PRAGMA foreign_keys;').get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
  });

  it('creates items and chunks tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('items', 'chunks');")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('items');
    expect(names).toContain('chunks');
  });

  it('reconciles orphaned processing items on startup', () => {
    // Insert an item in 'processing' status
    db.prepare(`
      INSERT INTO items (type, title, source_url, raw_content, status, chunk_count)
      VALUES ('note', 'My note', null, 'Some content', 'processing', 0)
    `).run();

    // Re-run initDatabase to simulate restart
    initDatabase(db);

    const item = db.prepare("SELECT * FROM items WHERE title = 'My note'").get() as any;
    expect(item.status).toBe('failed');
    expect(item.error_message).toBe('Interrupted: Server restarted during ingestion');
  });

  it('cascades chunk deletion when an item is deleted', () => {
    const itemResult = db.prepare(`
      INSERT INTO items (type, title, source_url, raw_content, status, chunk_count)
      VALUES ('note', 'Parent', null, 'Text', 'ready', 1)
    `).run();

    const itemId = itemResult.lastInsertRowid;
    const dummyBlob = Buffer.alloc(10);
    const chunkResult = db.prepare(`
      INSERT INTO chunks (item_id, chunk_index, content, embedding)
      VALUES (?, 0, 'Chunk text', ?)
    `).run(itemId, dummyBlob);

    const chunkId = chunkResult.lastInsertRowid;
    const chunkBefore = db.prepare('SELECT * FROM chunks WHERE id = ?').get(chunkId);
    expect(chunkBefore).toBeDefined();

    // Delete parent item
    db.prepare('DELETE FROM items WHERE id = ?').run(itemId);

    const chunkAfter = db.prepare('SELECT * FROM chunks WHERE id = ?').get(chunkId);
    expect(chunkAfter).toBeUndefined();
  });
});

describe('Database Singleton / File Init', () => {
  const testDbDir = path.join(os.tmpdir(), '.tmp-test-db-knowledge-inbox');
  const testDbPath = path.join(testDbDir, 'test.db');

  beforeEach(() => {
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  it('creates database directory and file if it does not exist and enables WAL mode', () => {
    const dbInstance = getDatabase(testDbPath);
    expect(fs.existsSync(testDbPath)).toBe(true);

    const row = dbInstance.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
    expect(row.journal_mode.toLowerCase()).toBe('wal');
  });
});
