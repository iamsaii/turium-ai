import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbeddings, generateAnswer } from '../src/services/gemini.service.js';
import { RateLimitError } from '../src/lib/errors.js';
import type { SourceSnippet } from '../src/types/index.js';

const mockBatchEmbedContents = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockImplementation(({ model }: { model: string }) => {
        if (model.includes('embedding')) {
          return { batchEmbedContents: mockBatchEmbedContents };
        }
        return { generateContent: mockGenerateContent };
      }),
    })),
  };
});

describe('Gemini Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbeddings', () => {
    it('returns empty array if input array is empty without calling API', async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockBatchEmbedContents).not.toHaveBeenCalled();
    });

    it('calls batchEmbedContents and returns float arrays', async () => {
      mockBatchEmbedContents.mockResolvedValueOnce({
        embeddings: [
          { values: [0.1, 0.2, 0.3] },
          { values: [0.4, 0.5, 0.6] },
        ],
      });

      const vectors = await generateEmbeddings(['Hello', 'World']);
      expect(vectors).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      expect(mockBatchEmbedContents).toHaveBeenCalledTimes(1);
    });

    it('retries on rate limit (429) and throws RateLimitError after maximum retries', async () => {
      const error429 = new Error('Resource exhausted: quota exceeded (429)');
      (error429 as any).status = 429;

      mockBatchEmbedContents.mockRejectedValue(error429);

      await expect(generateEmbeddings(['Test text'], 10)).rejects.toThrow(RateLimitError);
      // Initial attempt + 3 retries = 4 attempts
      expect(mockBatchEmbedContents).toHaveBeenCalledTimes(4);
    });
  });

  describe('generateAnswer', () => {
    it('formats context snippets with XML source boundaries and citations requirement', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => 'The project launched in 2024 [Source 1].',
        },
      });

      const snippets: SourceSnippet[] = [
        {
          id: 'chunk-1',
          itemId: 'item-1',
          sourceTitle: 'Project Specs',
          sourceType: 'text',
          sourceUrl: undefined,
          text: 'The project was officially launched in October 2024.',
          similarity: 0.88,
        },
      ];

      const answer = await generateAnswer('When did the project launch?', snippets);
      expect(answer).toBe('The project launched in 2024 [Source 1].');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      const promptArg = mockGenerateContent.mock.calls[0][0];
      expect(promptArg).toContain('<context>');
      expect(promptArg).toContain('<source id="1" title="Project Specs"');
      expect(promptArg).toContain('The project was officially launched in October 2024.');
      expect(promptArg).toContain('</context>');
      expect(promptArg).toContain('When did the project launch?');
    });
  });
});
