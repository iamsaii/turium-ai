import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbeddings, generateAnswer } from '../src/services/gemini.service.js';
import { RateLimitError } from '../src/lib/errors.js';
import type { SourceSnippet } from '../src/types/index.js';

const mockEmbedContent = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        embedContent: mockEmbedContent,
        generateContent: mockGenerateContent,
      },
    })),
  };
});

describe('Gemini Service (@google/genai SDK)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbeddings', () => {
    it('returns empty array if input array is empty without calling API', async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('calls embedContent and returns float arrays', async () => {
      mockEmbedContent
        .mockResolvedValueOnce({
          embedding: { values: [0.1, 0.2, 0.3] },
        })
        .mockResolvedValueOnce({
          embedding: { values: [0.4, 0.5, 0.6] },
        });

      const vectors = await generateEmbeddings(['Hello', 'World']);
      expect(vectors).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    });

    it('retries on 503 unavailable and rate limit (429)', async () => {
      const error503 = new Error('This model is currently experiencing high demand');
      (error503 as any).status = 503;

      mockEmbedContent
        .mockRejectedValueOnce(error503)
        .mockResolvedValueOnce({
          embedding: { values: [0.7, 0.8, 0.9] },
        });

      const vectors = await generateEmbeddings(['Retry test'], 10);
      expect(vectors).toEqual([[0.7, 0.8, 0.9]]);
      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    });

    it('retries on rate limit (429) and throws RateLimitError after maximum retries', async () => {
      const error429 = new Error('Resource exhausted: quota exceeded (429)');
      (error429 as any).status = 429;

      mockEmbedContent.mockRejectedValue(error429);

      await expect(generateEmbeddings(['Test text'], 10)).rejects.toThrow(RateLimitError);
      // Initial attempt + 3 retries = 4 attempts
      expect(mockEmbedContent).toHaveBeenCalledTimes(4);
    });
  });

  describe('generateAnswer', () => {
    it('formats context snippets with XML source boundaries and citations requirement', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'The project launched in 2024 [Source 1].',
      });

      const snippets: SourceSnippet[] = [
        {
          id: 1,
          itemId: 1,
          title: 'Project Specs',
          sourceUrl: null,
          content: 'The project was officially launched in October 2024.',
          similarity: 0.88,
        },
      ];

      const answer = await generateAnswer('When did the project launch?', snippets);
      expect(answer).toBe('The project launched in 2024 [Source 1].');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      const params = mockGenerateContent.mock.calls[0][0];
      expect(params.contents).toContain('<context>');
      expect(params.contents).toContain('<source id="1" title="Project Specs"');
      expect(params.contents).toContain('The project was officially launched in October 2024.');
      expect(params.contents).toContain('</context>');
      expect(params.contents).toContain('When did the project launch?');
    });
  });
});
