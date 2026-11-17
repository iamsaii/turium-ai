import { CHUNK_MAX_CHARS, CHUNK_MIN_CHARS, CHUNK_OVERLAP_CHARS } from '../config.js';

/**
 * Splits raw text into an array of chunks respecting paragraph boundaries,
 * sentence boundaries, and falling back to overlapping slices for dense text.
 */
export function chunkText(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return [];
  }

  // Split into paragraphs
  const rawParagraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (rawParagraphs.length === 0) {
    return [];
  }

  if (rawParagraphs.length === 1 && rawParagraphs[0].length <= CHUNK_MAX_CHARS) {
    return [rawParagraphs[0]];
  }

  // Process each paragraph
  const units: string[] = [];

  for (const para of rawParagraphs) {
    if (para.length <= CHUNK_MAX_CHARS) {
      units.push(para);
      continue;
    }

    // Split oversized paragraph by sentence boundaries
    const sentences = para
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let currentSentenceChunk = '';
    for (const sentence of sentences) {
      if (sentence.length > CHUNK_MAX_CHARS) {
        if (currentSentenceChunk) {
          units.push(currentSentenceChunk);
          currentSentenceChunk = '';
        }

        // Hard slicing fallback
        const step = Math.max(1, CHUNK_MAX_CHARS - CHUNK_OVERLAP_CHARS);
        let start = 0;
        while (start < sentence.length) {
          const end = Math.min(start + CHUNK_MAX_CHARS, sentence.length);
          const slice = sentence.slice(start, end).trim();
          if (slice.length > 0) {
            units.push(slice);
          }
          if (end === sentence.length) break;
          start += step;
        }
      } else {
        const candidate = currentSentenceChunk ? `${currentSentenceChunk} ${sentence}` : sentence;
        if (candidate.length <= CHUNK_MAX_CHARS) {
          currentSentenceChunk = candidate;
        } else {
          units.push(currentSentenceChunk);
          currentSentenceChunk = sentence;
        }
      }
    }

    if (currentSentenceChunk) {
      units.push(currentSentenceChunk);
    }
  }

  // Merge segments smaller than CHUNK_MIN_CHARS where appropriate
  const merged: string[] = [];
  for (let i = 0; i < units.length; i++) {
    const current = units[i];
    if (merged.length === 0) {
      merged.push(current);
      continue;
    }

    const prevIndex = merged.length - 1;
    const prev = merged[prevIndex];

    // If previous was small (< CHUNK_MIN_CHARS) and can merge with current
    if (prev.length < CHUNK_MIN_CHARS && prev.length + 2 + current.length <= CHUNK_MAX_CHARS) {
      merged[prevIndex] = `${prev}\n\n${current}`;
      continue;
    }

    // If current is small (< CHUNK_MIN_CHARS) and can merge with prev
    if (current.length < CHUNK_MIN_CHARS && prev.length + 2 + current.length <= CHUNK_MAX_CHARS) {
      merged[prevIndex] = `${prev}\n\n${current}`;
      continue;
    }

    merged.push(current);
  }

  return merged;
}
