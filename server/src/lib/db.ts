import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DATABASE_PATH } from '../config.js';
import { logger } from './logger.js';

let dbInstance: DatabaseSync | null = null;

const SCHEMA_DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('note', 'url')),
  title TEXT NOT NULL,
  source_url TEXT,
  raw_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  chunk_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id);
`;

/**
 * Initializes schema and reconciles orphaned processing records.
 */
export function initDatabase(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA_DDL);

  // Startup reconciliation for interrupted processing jobs
  const result = db.prepare(`
    UPDATE items 
    SET status = 'failed', 
        error_message = 'Interrupted: Server restarted during ingestion'
    WHERE status = 'processing';
  `).run();

  if (result.changes && result.changes > 0) {
    logger.warn({
      message: 'Reconciled orphaned processing items on startup',
      recoveredCount: result.changes,
    });
  }
}

/**
 * Returns the singleton database instance, creating and initializing it if needed.
 */
export function getDatabase(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath || DATABASE_PATH;

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  initDatabase(db);

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

/**
 * Closes the active singleton database connection if open.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore if already closed
    }
    dbInstance = null;
  }
}
