import { DatabaseSync } from 'node:sqlite';
import { itemsRepo } from '../repositories/items.repository.js';
import { chunksRepo } from '../repositories/chunks.repository.js';
import { generateEmbeddings, generateAnswer } from './gemini.service.js';
import { deserializeVector, cosineSimilarity } from '../lib/vector.js';
import { TOP_K, SIMILARITY_THRESHOLD } from '../config.js';
import type { QueryResponseDTO, SourceSnippet } from '../types/index.js';

/**
 * Executes a two-stage RAG query:
 * 1. Stage 1: In-memory vector cosine similarity scan over ready chunks.
 * 2. Stage 2: Context hydration of top-K chunks and answer generation via Gemini.
 */
export async function executeQuery(
  question: string,
  dbInstance?: DatabaseSync
): Promise<QueryResponseDTO> {
  // Early check: Ensure knowledge base has ready items
  if (!itemsRepo.hasReadyItems(dbInstance)) {
    return {
      answer: 'Your knowledge base is empty. Please add notes or URLs first before asking questions.',
      sources: [],
    };
  }

  // 1. Embed user question
  const [queryVector] = await generateEmbeddings([question]);
  if (!queryVector) {
    return {
      answer: 'Failed to process question embedding.',
      sources: [],
    };
  }

  // 2. Stage 1: Vector scan
  const index = chunksRepo.getReadyVectorIndex(dbInstance);
  if (index.length === 0) {
    return {
      answer: 'No sufficiently relevant information was found in your saved items to answer this question.',
      sources: [],
    };
  }

  const scored = index.map((chunk) => {
    const chunkVector = deserializeVector(chunk.embedding);
    const sim = cosineSimilarity(queryVector, chunkVector);
    return { id: chunk.id, similarity: sim };
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  // Check relevance threshold
  if (scored.length === 0 || scored[0].similarity < SIMILARITY_THRESHOLD) {
    return {
      answer: 'No sufficiently relevant information was found in your saved items to answer this question.',
      sources: [],
    };
  }

  const topMatches = scored
    .slice(0, TOP_K)
    .filter((s) => s.similarity >= SIMILARITY_THRESHOLD);

  // 3. Stage 2: Hydrate context chunks
  const chunkDetails = chunksRepo.getChunksByIds(
    topMatches.map((m) => m.id),
    dbInstance
  );

  const sources: SourceSnippet[] = topMatches.map((match) => {
    const detail = chunkDetails.find((d) => d.id === match.id);
    return {
      id: match.id,
      itemId: detail ? detail.itemId : 0,
      title: detail ? detail.title : 'Unknown Source',
      sourceUrl: detail ? detail.sourceUrl : null,
      content: detail ? detail.content : '',
      similarity: match.similarity,
    };
  });

  // 4. Generate answer via LLM
  const answer = await generateAnswer(question, sources);

  return {
    answer,
    sources,
  };
}
