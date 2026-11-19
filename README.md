# AI Knowledge Inbox

> A local-first knowledge inbox and RAG question-answering system. Ingest notes and URLs asynchronously, chunk and embed with Google Gemini, store vectors in SQLite, and query with verifiable citations.

---

## Quickstart

### Prerequisites
- **Node.js** v22+ (tested on v26.13.0), **npm** v10+, and a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 1. Install
```bash
git clone https://github.com/iamsaii/turium-ai.git
cd turium-ai
npm install
cp .env.example .env   # then add your GEMINI_API_KEY
```

### 2. Configure
`.env` (root or `server/.env`):
```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=data.db
GEMINI_API_KEY=your_gemini_api_key_here
EMBEDDING_MODEL=gemini-embedding-2
CHAT_MODEL=gemini-3.5-flash-lite
EMBEDDING_DIM=768
```

### 3. Run
```bash
npm run dev
```
Starts Express on :3000 and Vite on :5173 (API proxied). Open **[http://localhost:5173](http://localhost:5173)**.

A lightweight client-side login gate guards the UI (not server auth). Credentials and session behavior: [LOGIN.md](./LOGIN.md).

---

## Architecture
- **UI → API**: React (ingest form, polling item list, query panel) calls Express `/api/ingest`, `/api/items`, `/api/query`.
- **Async ingestion**: `202 Accepted` + in-process worker → Cheerio extraction → paragraph-aware chunking → Gemini embeddings → SQLite (`node:sqlite`, WAL).
- **Query path**: two-stage retrieval (in-memory cosine scan over BLOB vectors, then hydration of top-K texts) → Gemini answer grounded in XML-bounded context.
- **Models**: `gemini-embedding-2` (768-dim) for embeddings; `gemini-3.5-flash-lite` for answers.

---

## Key Engineering Tradeoffs & Design Rationale

### 1. Async Ingestion (`202 Accepted` + In-Process Worker)
- Extraction, chunking, and per-chunk embedding calls take 1.5–8s; returning `202` with a `processing` item avoids client timeouts and sluggish UX. A worker emits `ready` or `failed` with a descriptive error.
- Startup reconciliation flips orphaned `processing` rows to `failed` after a crash, so the UI never spins forever. Redis/BullMQ was rejected as unnecessary infrastructure for a single-user inbox.

### 2. Embedded Vector Storage & Two-Stage Retrieval
- 768-dim `Float32Array` embeddings live as 3,072-byte SQLite BLOBs; external vector DBs would add network hops and cost for a local inbox.
- Stage 1 scans ready items' embeddings with in-memory cosine similarity; Stage 2 hydrates only top-K chunks above `0.30` with full text/metadata. Buffers are sliced before `Float32Array` construction to guarantee 4-byte alignment.
- `node:sqlite` (`DatabaseSync`) avoids native C++ compilation issues with `better-sqlite3` on Node 26.

### 3. Content Chunking Strategy
- Split on paragraph boundaries first (100–800 chars intact); oversized paragraphs split on sentence punctuation; dense/unpunctuated text falls back to 700-char windows with 100-char overlap; short trailing fragments merge into the prior chunk.
- Keeps embeddings semantically coherent without a token-level tokenizer dependency.

### 4. Dual Citation Architecture
- LLMs hallucinate citation brackets, so chunks are passed inside `<context><source id="X">…</source></context>` with instructions to treat context as untrusted and cite only via `[Source X]`.
- The UI also renders the exact retrieved chunk texts and deterministic similarity percentages, so users never rely on the model's citation accuracy alone.

### 5. Security & SSRF Hardening
- Only `http:`/`https:` URLs are accepted; loopback, private ranges, and cloud metadata IPs (`169.254.169.254`, `::1`, `fe80::`) are rejected with `400`.
- `redirect: 'manual'` blocks redirect-based SSRF; Cheerio strips `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<noscript>`, and `<iframe>` before chunking.

### 6. Debuggability & Observability
- Winston emits structured JSON logs (`LOG_LEVEL`, default `info`) with method, URL, status, and duration; every response carries `X-Request-ID` (client-supplied or generated) reused in logs and error bodies for end-to-end tracing.
- Typed `AppError` subclasses map to 400/404/429/502/500; clients get `{ "error", "requestId" }` without stack traces.

### 7. Code Quality & Separation of Concerns
- Layered server: routes validate/shape HTTP, `services/` own async work, `repositories/` own persistence, `lib/` owns DB, vector math, errors, and logging.
- Shared DTOs in `server/src/types/index.ts` are mirrored in `client/src/types.ts`; the React UI splits ingestion, listing, querying, answers, sources, errors, and login into focused components.
- Tests are organized by layer (vector math, chunking, DB, SSRF, Gemini retry, repositories, services, HTTP, client auth).

### 8. Gemini Models & Free-Tier Quotas
- Defaults: chat `gemini-3.5-flash-lite` (observed free tier 15 RPM / 250K TPM / 500 RPD) and embeddings `gemini-embedding-2` (100 RPM / 30K TPM / 1K RPD). The embedding quota is tighter during bulk ingestion because calls are per chunk.
- Quotas are per project and per model; check [AI Studio rate limits](https://aistudio.google.com/rate-limit). Both model IDs are env vars, so switching needs no code change.

---

## API Reference
All responses include `X-Request-ID`.

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check | None | `200` `{ "status": "ok", "timestamp": "..." }` |
| `POST` | `/api/ingest` | Async ingest note or URL | `{ "type": "note" \| "url", "content": "...", "title"?: "..." }` | `202` `{ "id": 1, "status": "processing", ... }` |
| `GET` | `/api/items` | List items (metadata only) | None | `200` `Item[]` |
| `DELETE` | `/api/items/:id` | Delete item + cascade chunks | None | `200` `{ "success": true }` |
| `POST` | `/api/query` | RAG search over ready items | `{ "question": "..." }` | `200` `{ "answer": "...", "sources": SourceSnippet[] }` |

---

## Testing & Verification
- **56 unit/integration tests** (50 server + 6 client) across vector math, SQLite constraints, cascade deletes, orphan reconciliation, SSRF filters, chunking, Gemini retry, endpoints, and client auth.

```bash
npm test          # all tests
npm run build     # server tsc + client tsc && vite build
```

---

## Known Limitations
1. Client-side-rendered pages yield little text with plain HTTP fetching.
2. `kill -9` terminates in-flight workers (startup reconciliation marks them `failed`).
3. Daily quota exhaustion returns `429` until reset at midnight Pacific — short retries can't help; override `CHAT_MODEL`/`EMBEDDING_MODEL` if another model has headroom.

---

## What Breaks at Scale & Production Next Steps
1. **Vector index**: linear scan is ~2ms at 1K chunks but a CPU bottleneck past 100K → `sqlite-vec` + HNSW for ANN search.
2. **Workers**: in-process promises → Redis/BullMQ or SQS with worker fleets, locks, and DLQs.
3. **Answers**: JSON request-response → SSE/WebSockets to stream tokens from Gemini.
4. **Crawling**: Cheerio + fetch → Playwright/Puppeteer for JS-heavy pages.
