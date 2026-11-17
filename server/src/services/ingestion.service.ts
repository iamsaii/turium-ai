import { DatabaseSync } from 'node:sqlite';
import { itemsRepo } from '../repositories/items.repository.js';
import { chunksRepo } from '../repositories/chunks.repository.js';
import { extractUrlContent } from './extraction.service.js';
import { chunkText } from './chunking.service.js';
import { generateEmbeddings } from './gemini.service.js';
import { serializeVector } from '../lib/vector.js';
import { logger } from '../lib/logger.js';
import type { IngestRequestDTO, Item } from '../types/index.js';

export const activeIngestionPromises = new Map<number, Promise<void>>();

/**
 * Initiates an ingestion job, persisting an initial processing record and firing
 * the asynchronous background extraction/chunking/embedding pipeline.
 */
export async function startIngestion(
  dto: IngestRequestDTO,
  dbInstance?: DatabaseSync
): Promise<Item> {
  const isUrl = dto.type === 'url';
  let initialTitle = dto.title;
  if (!initialTitle) {
    initialTitle = isUrl
      ? dto.content
      : dto.content.slice(0, 50).trim() || 'Untitled Note';
  }

  const item = itemsRepo.createItem(
    {
      type: dto.type,
      title: initialTitle,
      sourceUrl: isUrl ? dto.content : null,
      rawContent: isUrl ? '' : dto.content,
    },
    dbInstance
  );

  const backgroundTask = processIngestion(item.id, dto, initialTitle, dbInstance);
  activeIngestionPromises.set(item.id, backgroundTask);
  backgroundTask.finally(() => {
    activeIngestionPromises.delete(item.id);
  });

  return item;
}

async function processIngestion(
  itemId: number,
  dto: IngestRequestDTO,
  currentTitle: string,
  dbInstance?: DatabaseSync
): Promise<void> {
  try {
    // 1. Verify item still exists before proceeding
    let parent = itemsRepo.getItemById(itemId, dbInstance);
    if (!parent) return;

    let bodyText = '';
    let finalTitle = currentTitle;

    // 2. Extract or read raw content
    if (dto.type === 'url') {
      const extracted = await extractUrlContent(dto.content);

      parent = itemsRepo.getItemById(itemId, dbInstance);
      if (!parent) return;

      if (!dto.title) {
        finalTitle = extracted.title;
      }
      bodyText = extracted.bodyText;
    } else {
      bodyText = dto.content;
    }

    // 3. Chunk text
    const chunks = chunkText(bodyText);

    parent = itemsRepo.getItemById(itemId, dbInstance);
    if (!parent) return;

    if (chunks.length === 0) {
      itemsRepo.updateItemReady(
        itemId,
        {
          title: finalTitle,
          rawContent: bodyText,
          chunkCount: 0,
        },
        dbInstance
      );
      return;
    }

    // 4. Generate batch embeddings
    const vectors = await generateEmbeddings(chunks);

    parent = itemsRepo.getItemById(itemId, dbInstance);
    if (!parent) return;

    // 5. Serialize and store chunks transactionally
    const chunksToInsert = chunks.map((content, idx) => ({
      itemId,
      chunkIndex: idx,
      content,
      embedding: serializeVector(vectors[idx]),
    }));

    chunksRepo.insertChunks(chunksToInsert, dbInstance);

    // 6. Mark item ready
    itemsRepo.updateItemReady(
      itemId,
      {
        title: finalTitle,
        rawContent: bodyText,
        chunkCount: chunks.length,
      },
      dbInstance
    );

    logger.info({
      message: 'Ingestion completed successfully',
      itemId,
      type: dto.type,
      chunksCount: chunks.length,
    });
  } catch (err: any) {
    logger.error({
      message: 'Ingestion failed',
      itemId,
      error: err?.message,
    });

    const parent = itemsRepo.getItemById(itemId, dbInstance);
    if (parent) {
      itemsRepo.updateItemFailed(itemId, err?.message || 'Ingestion failed', dbInstance);
    }
  }
}
