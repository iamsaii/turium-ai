import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initDatabase } from '../src/lib/db.js';
import { itemsRepo } from '../src/repositories/items.repository.js';
import { chunksRepo } from '../src/repositories/chunks.repository.js';
import { startIngestion, activeIngestionPromises } from '../src/services/ingestion.service.js';
import { executeQuery } from '../src/services/query.service.js';
import * as geminiService from '../src/services/gemini.service.js';
import * as extractionService from '../src/services/extraction.service.js';

describe('Ingestion & Query Services', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initDatabase(db);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  describe('Ingestion Service', () => {
    it('creates initial item with processing status and finishes background ingestion to ready', async () => {
      vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([
        new Array(768).fill(0.1),
      ]);

      const item = await startIngestion(
        {
          type: 'note',
          content: 'This is a test note that will be ingested and chunked.',
          title: 'Test Note',
        },
        db
      );

      expect(item.status).toBe('processing');
      expect(item.title).toBe('Test Note');

      // Await the background processing promise for this item
      await activeIngestionPromises.get(item.id);

      const readyItem = itemsRepo.getItemById(item.id, db);
      expect(readyItem?.status).toBe('ready');
      expect(readyItem?.chunkCount).toBe(1);

      const chunks = chunksRepo.getReadyVectorIndex(db);
      expect(chunks.length).toBe(1);
    });

    it('extracts URL content and saves chunks upon successful URL ingestion', async () => {
      vi.spyOn(extractionService, 'extractUrlContent').mockResolvedValueOnce({
        title: 'Extracted Web Page',
        bodyText: 'Paragraph of web page text extracted by cheerio.',
      });
      vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([
        new Array(768).fill(0.2),
      ]);

      const item = await startIngestion(
        {
          type: 'url',
          content: 'https://example.com/page',
        },
        db
      );

      expect(item.status).toBe('processing');

      await activeIngestionPromises.get(item.id);

      const readyItem = itemsRepo.getItemById(item.id, db);
      expect(readyItem?.status).toBe('ready');
      expect(readyItem?.title).toBe('Extracted Web Page');
      expect(readyItem?.sourceUrl).toBe('https://example.com/page');
      expect(readyItem?.chunkCount).toBe(1);
    });

    it('handles concurrent deletion gracefully if parent item is deleted mid-flight', async () => {
      let itemIdToDelete: number = 0;
      let finishExtraction!: () => void;
      const extractionGate = new Promise<void>((resolve) => {
        finishExtraction = resolve;
      });

      vi.spyOn(extractionService, 'extractUrlContent').mockImplementationOnce(async () => {
        // Hold extraction until startIngestion has returned the item id.
        await extractionGate;
        itemsRepo.deleteItemById(itemIdToDelete, db);
        return {
          title: 'Deleted Web Page',
          bodyText: 'Text that should not be saved.',
        };
      });
      vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([
        new Array(768).fill(0.1),
      ]);

      const item = await startIngestion(
        {
          type: 'url',
          content: 'https://example.com/deleted',
        },
        db
      );
      itemIdToDelete = item.id;
      finishExtraction();

      // Should complete without unhandled rejection
      await expect(activeIngestionPromises.get(item.id)).resolves.not.toThrow();

      expect(itemsRepo.getItemById(item.id, db)).toBeNull();
      expect(geminiService.generateEmbeddings).not.toHaveBeenCalled();
      const chunks = chunksRepo.getReadyVectorIndex(db);
      expect(chunks.length).toBe(0);
    });

    it('marks item as failed when extraction or embedding fails', async () => {
      vi.spyOn(extractionService, 'extractUrlContent').mockRejectedValueOnce(
        new Error('Network offline')
      );

      const item = await startIngestion(
        {
          type: 'url',
          content: 'https://example.com/fail',
        },
        db
      );

      await activeIngestionPromises.get(item.id);

      const failedItem = itemsRepo.getItemById(item.id, db);
      expect(failedItem?.status).toBe('failed');
      expect(failedItem?.errorMessage).toContain('Network offline');
    });
  });

  describe('Query Service (RAG Pipeline)', () => {
    it('returns empty knowledge base message when there are no ready items', async () => {
      const response = await executeQuery('What is the meaning of life?', db);
      expect(response.answer).toContain('Your knowledge base is empty');
      expect(response.sources).toEqual([]);
    });

    it('returns fallback message when similarity score is below threshold (< 0.30)', async () => {
      // Ingest an item and chunk
      const item = itemsRepo.createItem(
        { type: 'note', title: 'Cooking Guide', rawContent: 'Recipe for pasta.' },
        db
      );
      itemsRepo.updateItemReady(item.id, { title: 'Cooking Guide', rawContent: 'Recipe', chunkCount: 1 }, db);

      // Chunk has vector [1, 0, 0, ...]
      const chunkVec = new Array(768).fill(0);
      chunkVec[0] = 1.0;
      chunksRepo.insertChunks(
        [{
          itemId: item.id,
          chunkIndex: 0,
          content: 'Recipe for pasta.',
          embedding: Buffer.from(new Float32Array(chunkVec).buffer),
        }],
        db
      );

      // Query vector is orthogonal [0, 1, 0, ...] (similarity = 0.0)
      const queryVec = new Array(768).fill(0);
      queryVec[1] = 1.0;
      vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([queryVec]);

      const response = await executeQuery('How to fix a bicycle?', db);
      expect(response.answer).toContain('No sufficiently relevant information was found');
      expect(response.sources).toEqual([]);
    });

    it('retrieves relevant chunks and generates LLM answer with sources when match exceeds threshold', async () => {
      const item = itemsRepo.createItem(
        { type: 'note', title: 'Space Exploration', rawContent: 'Apollo 11 landed on the Moon in 1969.' },
        db
      );
      itemsRepo.updateItemReady(item.id, { title: 'Space Exploration', rawContent: 'Apollo 11 landed in 1969.', chunkCount: 1 }, db);

      const vec = new Array(768).fill(0.1);
      chunksRepo.insertChunks(
        [{
          itemId: item.id,
          chunkIndex: 0,
          content: 'Apollo 11 landed on the Moon in 1969.',
          embedding: Buffer.from(new Float32Array(vec).buffer),
        }],
        db
      );

      vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([vec]);
      vi.spyOn(geminiService, 'generateAnswer').mockResolvedValueOnce(
        'Apollo 11 landed on the Moon in 1969 [Source 1].'
      );

      const response = await executeQuery('When did Apollo 11 land on the Moon?', db);
      expect(response.answer).toBe('Apollo 11 landed on the Moon in 1969 [Source 1].');
      expect(response.sources.length).toBe(1);
      expect(response.sources[0].title).toBe('Space Exploration');
      expect(response.sources[0].content).toContain('Apollo 11 landed on the Moon');
      expect(response.sources[0].similarity).toBeGreaterThanOrEqual(0.99);
    });
  });
});
