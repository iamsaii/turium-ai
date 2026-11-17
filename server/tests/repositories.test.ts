import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initDatabase } from '../src/lib/db.js';
import { itemsRepo } from '../src/repositories/items.repository.js';
import { chunksRepo } from '../src/repositories/chunks.repository.js';

describe('Data Access Repositories', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Items Repository', () => {
    it('creates an item with default status processing and raw_content empty', () => {
      const item = itemsRepo.createItem(
        {
          type: 'note',
          title: 'My initial note',
          rawContent: '',
        },
        db
      );

      expect(item.id).toBeTypeOf('number');
      expect(item.title).toBe('My initial note');
      expect(item.type).toBe('note');
      expect(item.status).toBe('processing');
      expect(item.rawContent).toBe('');
      expect(item.chunkCount).toBe(0);
    });

    it('fetches an item by ID', () => {
      const created = itemsRepo.createItem(
        {
          type: 'url',
          title: 'Example Domain',
          sourceUrl: 'https://example.com',
          rawContent: '',
        },
        db
      );

      const found = itemsRepo.getItemById(created.id, db);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.sourceUrl).toBe('https://example.com');
    });

    it('returns all item metadata excluding raw_content sorted by created_at DESC', () => {
      itemsRepo.createItem({ type: 'note', title: 'Note 1', rawContent: 'Hidden secret' }, db);
      itemsRepo.createItem({ type: 'note', title: 'Note 2', rawContent: 'Another secret' }, db);

      const all = itemsRepo.getAllItemMetadata(db);
      expect(all.length).toBe(2);
      expect((all[0] as any).raw_content).toBeUndefined();
      expect((all[0] as any).rawContent).toBeUndefined();
      expect(all[0].title).toBe('Note 2'); // Latest created
    });

    it('updates item to ready with updated title, rawContent, and chunkCount', () => {
      const created = itemsRepo.createItem({ type: 'note', title: 'Pending', rawContent: '' }, db);

      itemsRepo.updateItemReady(
        created.id,
        {
          title: 'Final Title',
          rawContent: 'Full extracted text',
          chunkCount: 3,
        },
        db
      );

      const updated = itemsRepo.getItemById(created.id, db);
      expect(updated?.status).toBe('ready');
      expect(updated?.title).toBe('Final Title');
      expect(updated?.rawContent).toBe('Full extracted text');
      expect(updated?.chunkCount).toBe(3);
    });

    it('updates item to failed with error message', () => {
      const created = itemsRepo.createItem({ type: 'url', title: 'Broken', rawContent: '' }, db);

      itemsRepo.updateItemFailed(created.id, 'Connection timed out', db);

      const updated = itemsRepo.getItemById(created.id, db);
      expect(updated?.status).toBe('failed');
      expect(updated?.errorMessage).toBe('Connection timed out');
    });

    it('deletes an item by ID and returns true if deleted', () => {
      const created = itemsRepo.createItem({ type: 'note', title: 'To Delete', rawContent: '' }, db);

      const deleted = itemsRepo.deleteItemById(created.id, db);
      expect(deleted).toBe(true);

      const notFound = itemsRepo.getItemById(created.id, db);
      expect(notFound).toBeNull();

      const deleteAgain = itemsRepo.deleteItemById(created.id, db);
      expect(deleteAgain).toBe(false);
    });
  });

  describe('Chunks Repository (Two-Stage Query)', () => {
    it('inserts chunks transactionally and retrieves ready vector index (Stage 1)', () => {
      const item1 = itemsRepo.createItem({ type: 'note', title: 'Ready Item', rawContent: 'Text' }, db);
      const item2 = itemsRepo.createItem({ type: 'note', title: 'Processing Item', rawContent: 'Text' }, db);

      // Item 1 is marked ready
      itemsRepo.updateItemReady(item1.id, { title: 'Ready Item', rawContent: 'Text', chunkCount: 2 }, db);

      const buf1 = Buffer.alloc(10, 1);
      const buf2 = Buffer.alloc(10, 2);
      const buf3 = Buffer.alloc(10, 3);

      chunksRepo.insertChunks(
        [
          { itemId: item1.id, chunkIndex: 0, content: 'Ready Chunk 1', embedding: buf1 },
          { itemId: item1.id, chunkIndex: 1, content: 'Ready Chunk 2', embedding: buf2 },
          { itemId: item2.id, chunkIndex: 0, content: 'Unready Chunk', embedding: buf3 },
        ],
        db
      );

      // Stage 1: Vector scan only returns chunks for READY items
      const vectorIndex = chunksRepo.getReadyVectorIndex(db);
      expect(vectorIndex.length).toBe(2);
      expect(vectorIndex.map((c) => c.embedding.equals(buf3))).not.toContain(true);

      // Stage 2: Hydrate full context by chunk IDs
      const stage2 = chunksRepo.getChunksByIds([vectorIndex[0].id, vectorIndex[1].id], db);
      expect(stage2.length).toBe(2);
      expect(stage2[0].title).toBe('Ready Item');
      expect(stage2[0].content).toContain('Ready Chunk');
    });
  });
});
