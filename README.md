# AI Knowledge Inbox

> A personal, local-first knowledge inbox and RAG question-answering system. Ingest notes and web URLs asynchronously, chunk and embed with Google Gemini, store vector embeddings in SQLite, and query your knowledge base with verifiable dual-source citations.

---

## Table of Contents
1. [Quickstart](#quickstart)
2. [Architecture Overview](#architecture-overview)
3. [Key Engineering Tradeoffs & Design Rationale](#key-engineering-tradeoffs--design-rationale)
   - [Async Ingestion Lifecycle](#1-async-ingestion-lifecycle-202-accepted--in-process-worker)
   - [Embedded Vector Storage & Two-Stage Retrieval](#2-embedded-vector-storage--two-stage-retrieval)
   - [Content Chunking Strategy](#3-content-chunking-strategy)
   - [Dual Citation Architecture](#4-dual-citation-architecture)
   - [Security & SSRF Hardening](#5-security--ssrf-hardening)
4. [API Reference](#api-reference)
5. [Testing & Verification](#testing--verification)
6. [Known Limitations](#known-limitations)
7. [What Breaks at Scale & Production Next Steps](#what-breaks-at-scale--production-next-steps)

---

## Quickstart

### Prerequisites
- **Node.js**: v22.0.0+ (Tested on Node v26.13.0)
- **npm**: v10+
- **Gemini API Key**: Free tier key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone & Install
```bash
git clone <repo-url>
cd turium
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` in the root (or `server/.env`) and add your Gemini API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
PORT=3000
DATABASE_PATH=data.db
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Servers
Start both backend (Express on port 3000) and frontend (Vite React on port 5173 with API proxying):
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    React + Tailwind UI                      │
 │    IngestForm (Tabs)    ItemList (Polling)    QueryPanel    │
 └──────────────┬───────────────────▲─────────────────┬────────┘
                │ HTTP POST         │ HTTP GET        │ HTTP POST
                ▼                   │                 ▼
 ┌──────────────────────────────────┴──────────────────────────┐
 │                     Express API Server                      │
 │   /api/ingest            /api/items           /api/query    │
 └──────┬─────────────────────────────────────────────┬────────┘
        │ 202 Accepted                                │ Stage 1 Vector Scan
        ▼                                             ▼ Stage 2 Context Fetch
 ┌──────────────────────┐                     ┌────────────────────────┐
 │ In-Process Worker    │                     │ SQLite (WAL Mode)      │
 │ Cheerio Extraction   │                     │ items Table            │
 │ Semantic Chunking    │ ──── Vectors ────►  │ chunks (BLOB Vectors) │
 └──────────┬───────────┘                     └────────────────────────┘
            │                                             ▲
            ▼                                             │
 ┌────────────────────────────────────────────────────────┴────┐
 │                   Gemini API / Embeddings                       │
 │ - gemini-embedding-2 (Batch embeddings with MRL, 768-dim)   │
 │ - gemini-3.8-flash (XML prompt injection defense RAG answer) │
 └─────────────────────────────────────────────────────────────┘
```

---

## Key Engineering Tradeoffs & Design Rationale

### 1. Async Ingestion Lifecycle (`202 Accepted` + In-Process Worker)
- **Rationale**: Web page extraction, DOM sanitization, text chunking, and batch embedding calls over the wire can take anywhere from 1.5s to 8s depending on network latency and Gemini rate limits. Blocking the client with a synchronous HTTP response leads to client timeouts and sluggish UX.
- **Implementation**: The server immediately creates an item in `status: 'processing'` and returns `202 Accepted`. An in-process asynchronous task extracts content, chunks text, generates embeddings with exponential backoff retry, writes chunks in a single transaction, and transitions the item to `ready` (or `failed` with descriptive error).
- **Restart Reconciliation**: If the server crashes or restarts mid-ingestion, `initDatabase()` automatically detects orphaned `processing` records and transitions them to `failed` (`"Interrupted: Server restarted during ingestion"`), preventing perpetual loading spinners in the UI.
- **Why Not Redis / BullMQ?**: For a single-user inbox, introducing Redis or RabbitMQ adds external infrastructure dependencies and ops complexity ("infra theater") without benefit. The in-process promise pattern delivers clean async decoupling with zero dependencies.

### 2. Embedded Vector Storage & Two-Stage Retrieval
- **Rationale**: External vector databases (Pinecone, Qdrant, Milvus) introduce network hops, recurring costs, and synchronization overhead for a single-user knowledge inbox of hundreds or thousands of documents.
- **Two-Stage SQLite Architecture**:
  - Chunks store 768-dimensional `Float32Array` embeddings directly as 3,072-byte SQLite `BLOB` columns (using `gemini-embedding-2` with MRL `outputDimensionality: 768`).
  - **Stage 1 (Lightweight Vector Scan)**: The query pipeline executes `SELECT id, embedding FROM chunks WHERE item_id IN (SELECT id FROM items WHERE status = 'ready')`. In-memory cosine similarity is computed across byte-aligned float buffers.
  - **Stage 2 (Context Hydration)**: Only the top-K chunks exceeding the similarity threshold (`>= 0.30`) are hydrated with full text and metadata: `SELECT id, item_id, content, title, source_url FROM chunks WHERE id IN (...)`.
  - **Memory Alignment**: Node.js buffer allocation from slab pools does not guarantee 4-byte alignment. Direct `new Float32Array(buf.buffer)` throws `RangeError: start offset must be a multiple of 4`. We always slice the underlying buffer before constructing typed float arrays, ensuring 100% memory alignment safety.
- **Native SQLite Driver**: Avoids native C++ compilation breakage in `better-sqlite3` on Node 26 by using Node.js's built-in `node:sqlite` (`DatabaseSync`).

### 3. Content Chunking Strategy
- **Paragraph Boundaries First**: Preserves coherent thoughts by splitting on `\n\n+`. Paragraphs between 100 and 800 characters remain intact.
- **Sentence Splitting**: Oversized paragraphs ($>800$ characters) split on sentence punctuation boundaries (`/(?<=[.!?])\s+/`).
- **Dense Text Fallback**: Unpunctuated dense code blocks or unbroken text fall back to sliding window slices of 700 characters with 100-character overlap.
- **Terminal Segment Merging**: Small trailing fragments ($<100$ characters) merge into preceding chunks if capacity allows, preventing fragmented embeddings.

### 4. Dual Citation Architecture
- **Problem**: Large language models frequently hallucinate citation brackets or misattribute quotes when asked to cite sources.
- **Dual Defense**:
  1. **Strict XML Prompt Boundaries**: Chunks are supplied to Gemini inside `<context><source id="X" title="...">...</source></context>` tags with explicit system instructions to treat context as untrusted data and cite solely via `[Source X]`.
  2. **Deterministic Source Snippets**: Below the synthesized answer, the UI mounts the exact chunk texts and metadata retrieved in Stage 2, alongside a deterministic similarity match percentage (`Math.round(similarity * 100)% match`). Users never have to blindly trust the LLM's citation accuracy.

### 5. Security & SSRF Hardening
- **Protocol Whitelisting**: Only `http:` and `https:` URLs are permitted; `file://`, `ftp://`, `gopher://`, and `javascript:` are rejected upfront with `400 Bad Request`.
- **SSRF Defense**: Rejects loopback and private IP ranges (`localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` cloud metadata, `::1`, `fe80::`).
- **Redirect Hijacking Protection**: Uses `redirect: 'manual'` during `fetch`. Any 301/302 redirects are rejected to prevent redirect-based SSRF into private internal subnets.
- **DOM Sanitization**: Cheerio removes all `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<noscript>`, and `<iframe>` elements before chunking.

---

## API Reference

All responses include an `X-Request-ID` HTTP header for tracing.

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check | None | `200 OK` `{ "status": "ok", "timestamp": "..." }` |
| `POST` | `/api/ingest` | Asynchronously ingest note or URL | `{ "type": "note" \| "url", "content": "...", "title"?: "..." }` | `202 Accepted` `{ "id": 1, "status": "processing", ... }` |
| `GET` | `/api/items` | List saved items (metadata only) | None | `200 OK` `Item[]` |
| `DELETE` | `/api/items/:id` | Delete item & cascade delete chunks | None | `200 OK` `{ "success": true }` |
| `POST` | `/api/query` | RAG search over ready items | `{ "question": "..." }` | `200 OK` `{ "answer": "...", "sources": SourceSnippet[] }` |

---

## Testing & Verification

The test suite contains **49 comprehensive unit and integration tests** covering vector math, SQLite foreign keys, cascade deletes, orphan reconciliation, SSRF filters, chunk boundaries, Gemini rate-limit retry, and Express endpoints.

### Run All Unit & Integration Tests
```bash
npm test
```

### Build Server & Client
```bash
npm run build
```

---

## Known Limitations

1. **Client-Side Rendered (CSR) SPAs**: Web pages rendered entirely via client-side JavaScript (e.g. heavy React/Vue apps with empty `<div id="root"></div>` in raw HTML) will yield limited text when fetched with standard HTTP requests.
2. **In-Process Background Tasks**: While the in-process worker handles hundreds of concurrent ingests cleanly, shutting down the Node process forcibly (`kill -9`) terminates active tasks mid-flight. (Handled gracefully via startup orphan reconciliation).

---

## What Breaks at Scale & Production Next Steps

If scaling this system to hundreds of thousands of users or millions of chunks:

1. **Vector Index Scalability**:
   - *Current*: Linear scan over $N$ chunks in memory takes $\sim 2\text{ms}$ for 1,000 chunks, but becomes a CPU bottleneck at $>100,000$ chunks.
   - *Scale Solution*: Integrate [`sqlite-vec`](https://github.com/asg017/sqlite-vec) with HNSW (Hierarchical Navigable Small World) vector indexing for logarithmic sub-millisecond approximate nearest neighbor searches.
2. **Distributed Worker Decoupling**:
   - *Current*: In-process async promises.
   - *Scale Solution*: Extract ingestion workers to Redis + BullMQ or AWS SQS with dedicated worker fleets, supporting autoscaling, distributed locks, and dead-letter queues (DLQ).
3. **Streaming LLM Responses**:
   - *Current*: Standard JSON request-response for answers.
   - *Scale Solution*: Implement Server-Sent Events (SSE) or WebSockets on `POST /api/query` to stream tokens in real-time as Gemini generates them.
4. **Headless Browser Crawler**:
   - *Current*: HTTP fetch with Cheerio.
   - *Scale Solution*: Route dynamic or JS-heavy URLs through a headless browser service (Playwright / Puppeteer) to extract client-rendered text.
