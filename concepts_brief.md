# AI Knowledge Inbox — Concepts Brief

* **Author:** Sai
* **Date:** 2026-11-17

## Overview

A single-user, production-style web app that lets users save plain-text notes or URLs, ask questions over saved content, and get answers via a lightweight RAG pipeline. Built as an interview take-home assignment with a 6–12 hour timebox and 2–3 day calendar cap. The app uses React (Vite) + Tailwind CSS on the frontend, Node.js + Express + TypeScript + Winston on the backend, the Gemini API for embeddings and generation, and SQLite for persistence including embedding vectors stored as Float32Array BLOBs with brute-force cosine similarity in JS.

## Analysis

### Core Architecture & Workflow Decisions

- **Asynchronous Ingestion with In-Process Worker**: `POST /ingest` creates a record in `items` with `status: 'processing'` and returns `202 Accepted` immediately. A background task runs URL fetch, text extraction, paragraph-based chunking, batch embedding generation, and chunk storage, updating status to `ready` (or `failed` with error details).
- **SQLite Persistence & Cascade Deletion**: Zero external database dependencies. Adding `DELETE /items/:id` cascades to chunk records and vector BLOBs, allowing evaluators to clean up noisy ingestions.
- **Brute-Force Vector Search with Ready-Filter**: `POST /query` retrieves chunks only from items where `status = 'ready'`. Vector similarity is computed in-memory across Float32Array BLOBs using cosine similarity.
- **Dual Citation Strategy**: The generated response prompts Gemini Flash for inline citations, while the UI deterministically renders source snippets from retrieved chunks to safeguard against hallucinated citations.
- **Gemini Free-Tier Optimization**: Batch embedding calls mitigate RPM limits, and explicit 429 error handling protects server stability during ingestion.

### Goals vs. Non-Goals

* **In-Scope Goals:**
  - Save plain-text notes and fetch web page text server-side via `fetch` + `cheerio`.
  - Asynchronous background ingestion pipeline with `202 Accepted` and status lifecycle (`processing`, `ready`, `failed`).
  - Paragraph-based chunking (~800 char ceiling, ~100 char floor, ~100 char overlap).
  - Semantic retrieval using Gemini `text-embedding-004` (768-dim) and SQLite BLOB vector storage.
  - RAG answer generation with Gemini 2.0 Flash and dual source citation.
  - Complete REST API: `POST /ingest`, `GET /items`, `DELETE /items/:id`, `POST /query`.
  - Minimal, functional React + Tailwind UI with item status badges, delete buttons, and query/answer display.
  - Structured logging with Winston and clear error responses.
  - Architectural tradeoffs and scaling analysis documented in README.

* **Out-of-Scope Non-Goals:**
  - Multi-user authentication or session management.
  - Headless browser rendering (Puppeteer) for JS-rendered SPAs (documented limitation).
  - Heavyweight queue systems (Redis, BullMQ, Celery) or external vector DBs (Pinecone, ChromaDB).
  - Streaming LLM token delivery (Server-Sent Events / WebSockets).
  - File/PDF upload parsing.

## Alternatives Weighed

| Option | Decision | Reason |
|--------|----------|--------|
| Vue/Nuxt Stack | Rejected by author | Brief explicitly requests React; sticking to React avoids stack misalignment risk with evaluators. |
| Synchronous Ingestion | Rejected | Blocks HTTP connection during external fetches and embedding calls; async ingestion demonstrates the required "async" evaluation axis. |
| Heavyweight Job Queue (Redis/Bull) | Rejected | Violates the explicit warning against "overengineering infra"; in-process async tasks are sufficient for single-user. |
| OpenAI API | Rejected | Gemini API free tier prevents evaluator onboarding friction and avoids API billing requirements. |
| External Vector Database | Rejected | SQLite BLOB storage with cosine similarity in JS provides zero-dependency setup with predictable performance for small datasets. |
| LLM-Only Citation | Rejected | LLMs are prone to hallucinated citations; deterministic UI source snippet display acts as an accurate verification fallback. |

## Key Decisions & Staging for Next Steps

### Database Schema

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('note', 'url')),
  title TEXT NOT NULL,
  source_url TEXT,
  raw_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  chunk_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL, -- Float32Array serialized (768 * 4 = 3072 bytes)
  char_offset INTEGER,
  UNIQUE(item_id, chunk_index)
);

CREATE INDEX idx_chunks_item_id ON chunks(item_id);
```

### API Interface

- `POST /ingest` → `{ type: 'note' | 'url', content: string, title?: string }` returns `202 Accepted` `{ id: number, status: 'processing' }`
- `GET /items` → Returns all items with status, metadata, and chunk counts
- `DELETE /items/:id` → Deletes item and cascades to associated chunks
- `POST /query` → `{ question: string }` returns `{ answer: string, sources: Array<{ itemId: number, title: string, snippet: string, similarity: number }> }`

### Recommended Build Sequence

1. **Phase 1: Foundation (1.5 hrs)**: Monorepo setup (`client/` Vite + React + Tailwind, `server/` Express + TS + Winston), SQLite schema setup with `better-sqlite3`.
2. **Phase 2: Ingestion & Storage Pipeline (3 hrs)**: HTML extraction (`cheerio`), chunking logic, Gemini embedding client with batch support, async ingestion handler with status updates.
3. **Phase 3: Retrieval & Query Service (2 hrs)**: SQLite BLOB vector deserialization, cosine similarity function, Gemini Flash answer generation prompt, `POST /query` route.
4. **Phase 4: Frontend UI (2 hrs)**: Note/URL submission form, item list with status pills and delete buttons, query panel, answer view with deterministic source cards.
5. **Phase 5: Polish & Documentation (1.5 hrs)**: Structured logging verification, error boundary/toast messages, detailed README covering tradeoff rationale and scaling roadmap.
