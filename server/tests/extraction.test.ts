import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractUrlContent, validateUrlSafety } from '../src/services/extraction.service.js';
import { BadRequestError } from '../src/lib/errors.js';

describe('Web Extraction Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSRF Protection & URL Validation', () => {
    it('rejects unsupported protocols', () => {
      expect(() => validateUrlSafety('file:///etc/passwd')).toThrow(BadRequestError);
      expect(() => validateUrlSafety('ftp://example.com/resource')).toThrow(BadRequestError);
      expect(() => validateUrlSafety('javascript:alert(1)')).toThrow(BadRequestError);
    });

    it('rejects loopback and private IP hostnames', () => {
      const privateUrls = [
        'http://localhost/test',
        'http://localhost:3000/api',
        'http://127.0.0.1:8080',
        'http://127.0.1.1',
        'http://[::1]/secret',
        'http://0.0.0.0:8000',
        'http://10.0.0.1/admin',
        'http://192.168.1.1',
        'http://172.16.0.1',
        'http://172.31.255.255',
        'http://169.254.169.254/latest/meta-data/',
      ];

      for (const url of privateUrls) {
        expect(() => validateUrlSafety(url)).toThrow(BadRequestError);
      }
    });

    it('accepts valid public HTTP/HTTPS URLs', () => {
      expect(() => validateUrlSafety('https://example.com/article')).not.toThrow();
      expect(() => validateUrlSafety('http://en.wikipedia.org/wiki/Search')).not.toThrow();
    });
  });

  describe('Content Extraction', () => {
    it('extracts title and cleaned body text from HTML, stripping scripts and nav', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>My Sample Article</title>
            <style>body { font-size: 14px; }</style>
            <script>console.log("analytics")</script>
          </head>
          <body>
            <header><nav><a href="/">Home</a></nav></header>
            <main>
              <h1>Main Article Title</h1>
              <p>This is the first paragraph with important facts.</p>
              <p>This is the second paragraph with more context.</p>
            </main>
            <footer>Copyright 2026</footer>
          </body>
        </html>
      `;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      const result = await extractUrlContent('https://example.com/article');
      expect(result.title).toBe('My Sample Article');
      expect(result.bodyText).toContain('This is the first paragraph with important facts.');
      expect(result.bodyText).toContain('This is the second paragraph with more context.');
      expect(result.bodyText).not.toContain('analytics');
      expect(result.bodyText).not.toContain('Copyright 2026');
      expect(result.bodyText).not.toContain('font-size');
    });

    it('defaults title to the URL if title tag is absent or empty', async () => {
      const mockHtml = `<html><body><p>No title here, just text.</p></body></html>`;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      );

      const url = 'https://example.com/notitle';
      const result = await extractUrlContent(url);
      expect(result.title).toBe(url);
      expect(result.bodyText).toBe('No title here, just text.');
    });

    it('rejects redirects (301/302) with BadRequestError', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: 'http://localhost:3000/internal' },
        })
      );

      await expect(extractUrlContent('https://example.com/redirect')).rejects.toThrow(BadRequestError);
    });

    it('rejects HTTP error responses (e.g. 404, 500)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
        })
      );

      await expect(extractUrlContent('https://example.com/notfound')).rejects.toThrow(BadRequestError);
    });
  });
});
