import { describe, it, expect } from 'vitest';
import { chunkText } from '../src/services/chunking.service.js';

describe('Chunking Service', () => {
  it('returns an empty array for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  \t ')).toEqual([]);
  });

  it('returns a single chunk for short text under 100 characters', () => {
    const text = 'Quick note: meeting rescheduled to 3 PM tomorrow.';
    const chunks = chunkText(text);
    expect(chunks).toEqual([text]);
  });

  it('keeps distinct paragraphs as chunks when each is between 100 and 800 characters', () => {
    const p1 = 'A'.repeat(250) + '.';
    const p2 = 'B'.repeat(300) + '.';
    const text = `${p1}\n\n${p2}`;
    const chunks = chunkText(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(p1);
    expect(chunks[1]).toBe(p2);
  });

  it('splits oversized paragraphs (>800 chars) on sentence boundaries', () => {
    const sentence1 = 'First sentence is quite informative. ';
    const sentence2 = 'Second sentence continues with more details. ';
    const longSentence = 'A'.repeat(500) + '. ';
    const longSentence2 = 'B'.repeat(500) + '. ';
    const text = `${longSentence}${longSentence2}`;

    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(800);
    });
  });

  it('falls back to hard slicing for dense unpunctuated text (>800 chars)', () => {
    const denseText = 'x'.repeat(1800);
    const chunks = chunkText(denseText);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(800);
      expect(chunk.length).toBeGreaterThanOrEqual(100);
    });
  });

  it('merges small terminal chunk (<100 chars) into the preceding chunk if capacity allows', () => {
    const p1 = 'First main section of text with sufficient length. '.repeat(5); // ~260 chars
    const p2 = 'Tiny footer note.'; // 17 chars
    const text = `${p1}\n\n${p2}`;
    const chunks = chunkText(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('Tiny footer note.');
  });

  it('ensures no chunk in output exceeds 800 characters across diverse texts', () => {
    const diverse = [
      'Normal paragraph without much hassle. '.repeat(10),
      'Another paragraph.\n\n'.repeat(4),
      'Unbroken'.repeat(120),
    ].join('\n\n');

    const chunks = chunkText(diverse);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(800);
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});
