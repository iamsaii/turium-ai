import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { Socket } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { initDatabase } from '../src/lib/db.js';
import * as geminiService from '../src/services/gemini.service.js';

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  url: string;
  body?: any;
  headers?: Record<string, string>;
}

interface ResponseResult {
  status: number;
  headers: Record<string, any>;
  body: any;
}

function dispatch(app: Express, options: RequestOptions): Promise<ResponseResult> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    const res = new http.ServerResponse(req);

    const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : '';
    req.method = options.method;
    req.url = options.url;
    req.headers = {
      'content-type': 'application/json',
      ...(options.headers || {}),
    };
    if (bodyStr) {
      req.headers['content-length'] = Buffer.byteLength(bodyStr, 'utf8').toString();
    }

    let output = '';
    res.write = (chunk: any) => {
      output += chunk;
      return true;
    };
    res.end = (chunk: any) => {
      if (chunk) output += chunk;
      let parsed = null;
      try {
        parsed = output ? JSON.parse(output) : null;
      } catch {
        parsed = output;
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsed,
      });
      return res;
    };

    app(req, res, reject);

    if (bodyStr) {
      req.push(bodyStr);
    }
    req.push(null);
  });
}

describe('API Integration Test Suite', () => {
  let app: Express;
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initDatabase(db);
    app = createApp(db);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  it('GET /api/health returns 200 with status ok and X-Request-ID header', async () => {
    const res = await dispatch(app, { method: 'GET', url: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/ingest returns 400 when body is invalid', async () => {
    const res = await dispatch(app, {
      method: 'POST',
      url: '/api/ingest',
      body: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('POST /api/ingest returns 202 Accepted and initial item metadata for note', async () => {
    vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([
      new Array(768).fill(0.1),
    ]);

    const res = await dispatch(app, {
      method: 'POST',
      url: '/api/ingest',
      body: {
        type: 'note',
        content: 'Integrate React frontend with Express API.',
        title: 'Project Integration',
      },
    });

    expect(res.status).toBe(202);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Project Integration');
    expect(res.body.status).toBe('processing');
  });

  it('GET /api/items returns list of items excluding rawContent', async () => {
    vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([
      new Array(768).fill(0.1),
    ]);

    await dispatch(app, {
      method: 'POST',
      url: '/api/ingest',
      body: {
        type: 'note',
        content: 'Item for list test',
      },
    });

    const res = await dispatch(app, { method: 'GET', url: '/api/items' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].rawContent).toBeUndefined();
  });

  it('POST /api/query returns 200 with answer and sources', async () => {
    const res = await dispatch(app, {
      method: 'POST',
      url: '/api/query',
      body: { question: 'How do we integrate frontend?' },
    });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(Array.isArray(res.body.sources)).toBe(true);
  });

  it('DELETE /api/items/:id deletes an item and returns 200', async () => {
    vi.spyOn(geminiService, 'generateEmbeddings').mockResolvedValueOnce([
      new Array(768).fill(0.1),
    ]);

    const ingestRes = await dispatch(app, {
      method: 'POST',
      url: '/api/ingest',
      body: {
        type: 'note',
        content: 'Temporary item for delete test',
      },
    });
    const itemId = ingestRes.body.id;

    const deleteRes = await dispatch(app, {
      method: 'DELETE',
      url: `/api/items/${itemId}`,
    });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Deleting again should return 404
    const notFoundRes = await dispatch(app, {
      method: 'DELETE',
      url: `/api/items/${itemId}`,
    });
    expect(notFoundRes.status).toBe(404);
  });
});
