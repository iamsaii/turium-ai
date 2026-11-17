# AI Knowledge Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade single-user "AI Knowledge Inbox" web application where users save plain text notes or public web URLs, index them asynchronously via Gemini embeddings into SQLite, and query their aggregated knowledge base through a RAG pipeline with dual source citations.

**Architecture:** A TypeScript monorepo with an Express REST API backend and a React SPA frontend (Vite + Tailwind CSS). Background ingestion is non-blocking (`202 Accepted`), handling web extraction, sentence-bounded paragraph chunking, batch embeddings, and SQLite BLOB persistence; natural language queries use a two-stage vector retrieval pattern with Gemini 2.0 Flash generation and XML-isolated context prompting.

**Tech Stack:** TypeScript, Node.js, Express, better-sqlite3, Cheerio, Winston, @google/genai, React 18, Vite, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/designs/ai_knowledge_inbox.md`

## Global Constraints

*   **API Prefix**: All REST endpoints are mounted strictly under `/api/*` (`/api/ingest`, `/api/items`, `/api/items/:id`, `/api/query`, `/api/health`).
*   **Vector Geometry**: Embedding dimension is fixed at `768` floats (`text-embedding-004`). Serialized BLOBs occupy exactly `3,072` bytes (`768 * 4` bytes).
*   **Memory Alignment**: Node.js `Buffer` instances backing vectors must be sliced (`buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)`) before instantiating `Float32Array` to avoid unaligned memory access exceptions.
*   **Database Constraints**: Foreign keys are strictly enforced (`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`). Initial item insertion must supply a non-null placeholder `title` and default `raw_content` to `''`.
*   **SSRF Protection**: URL ingestion disallows non-HTTP protocols, enforces `redirect: 'manual'`, and rejects private/loopback IP blocks (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`).
*   **Test Runner Mode**: Vitest must execute in non-interactive run mode (`vitest run`).
*   **Zero Infrastructure**: Full persistence and search run on local SQLite with zero external database daemons or Docker dependencies.

## Review Focus

1.  **Unpunctuated or Dense Text Chunks Exceeding Size Ceiling**: If a segment has no sentence delimiters (`. `, `! `, `? `), the sentence regex will return no split points. A reasonable user expects chunk sizes to be strictly capped; the chunking service must fall back to hard character slicing at 800 characters with 100-character overlap.
2.  **Server Restart During Ingestion**: If the server restarts while items are being processed, they will remain in `'processing'` permanently. A reasonable user expects the system to recover; `db.ts` must execute an orphan reconciliation query on boot to mark pending items as `'failed'`.
3.  **Item Deletion While Ingestion Is In-Flight**: If a user clicks delete on an item currently awaiting web fetch or embeddings, the background worker will attempt to insert chunks for a deleted item. A reasonable user expects no crash; `ingestion.service.ts` must verify parent existence and catch foreign key errors gracefully.
4.  **Empty Knowledge Base or Low-Relevance Question**: If a user queries an empty database or asks an irrelevant question, calling Gemini Flash wastes tokens and invites hallucinations. A reasonable user expects an honest fallback; `query.service.ts` must exit early when ready chunk count is 0 or top similarity is $< 0.30$.
5.  **301/302 Open Redirect to Internal Metadata Service**: An external URL may redirect to `http://169.254.169.254/`. A reasonable user expects strict SSRF security; `extraction.service.ts` must enforce `redirect: 'manual'` on `fetch`.

---

### Task 1: Project Scaffolding & Monorepo Configuration

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Create: `client/src/index.css`
- Create: `client/index.html`

**Interfaces:**
- Consumes: None
- Produces: Root workspace script commands (`npm run dev`, `npm run build`, `npm test`)

- [ ] **Step 1: Write root configuration files**
  Create `.gitignore` excluding `node_modules/`, `dist/`, `data.db*`, `.env`, and coverage directories. Create `.env.example` with `PORT=3000`, `NODE_ENV=development`, and `GEMINI_API_KEY=your_key_here`. Create root `package.json`:
  ```json
  {
    "name": "turium-ai-knowledge-inbox",
    "private": true,
    "workspaces": ["server", "client"],
    "scripts": {
      "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
      "build": "npm run build --workspace=server && npm run build --workspace=client",
      "test": "npm --prefix server test"
    },
    "devDependencies": {
      "concurrently": "^9.1.0"
    }
  }
  ```

- [ ] **Step 2: Write server package and TypeScript configuration**
  Create `server/package.json` with scripts `"dev": "tsx watch src/index.ts"`, `"build": "tsc"`, `"test": "vitest run"` and dependencies `express`, `cors`, `dotenv`, `better-sqlite3`, `cheerio`, `winston`, `@google/genai`. Dev dependencies: `typescript`, `tsx`, `vitest`, `@types/express`, `@types/cors`, `@types/better-sqlite3`, `@types/node`. Create `server/tsconfig.json` targeting `ES2022`, module `NodeNext`, `moduleResolution: NodeNext`, and `strict: true`.

- [ ] **Step 3: Write client package, Vite, Tailwind and CSS configuration**
  Create `client/package.json` with `react`, `react-dom`, `lucide-react`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`. Create `client/vite.config.ts` with proxy forwarding `/api` to `http://localhost:3000`. Create `client/tailwind.config.js` scanning `./index.html` and `./src/**/*.{ts,tsx}`. Create `client/postcss.config.js`. Create `client/src/index.css`:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
  Create `client/index.html` mounting `#root` and linking `/src/main.tsx`.

- [ ] **Step 4: Verify package setup and dependencies**
  Run: `npm install`
  Expected: Dependencies install cleanly across root, server, and client without peer resolution errors.

- [ ] **Step 5: Commit**
  ```bash
  git add package.json .gitignore .env.example server/ client/
  git commit -m "chore: scaffold monorepo structure for server and client"
  ```

---

### Task 2: Core Domain Models, Configuration & Logging

**Files:**
- Create: `server/src/config.ts`
- Create: `server/src/types/index.ts`
- Create: `server/src/lib/errors.ts`
- Create: `server/src/lib/logger.ts`

**Interfaces:**
- Consumes: Environment variables
- Produces: `Item`, `Chunk`, `IngestRequestDTO`, `SourceSnippet`, `QueryResponseDTO`, `AppError` hierarchy, structured Winston logger, runtime constants

- [ ] **Step 1: Write core domain models and DTO interfaces in `server/src/types/index.ts`**
  Define exact interfaces:
  ```typescript
  export interface Item {
    id: number;
    type: 'note' | 'url';
    title: string;
    sourceUrl?: string | null;
    rawContent: string;
    status: 'processing' | 'ready' | 'failed';
    errorMessage?: string | null;
    createdAt: string;
    chunkCount: number;
  }

  export interface Chunk {
    id: number;
    itemId: number;
    chunkIndex: number;
    content: string;
    embedding: Buffer;
  }

  export interface IngestRequestDTO {
    type: 'note' | 'url';
    content: string;
    title?: string;
  }

  export interface SourceSnippet {
    id: number;
    itemId: number;
    title: string;
    sourceUrl?: string | null;
    content: string;
    similarity: number;
  }

  export interface QueryResponseDTO {
    answer: string;
    sources: SourceSnippet[];
  }
  ```

- [ ] **Step 2: Write configuration constants in `server/src/config.ts`**
  Implement typed configuration reading from `process.env` with sensible defaults:
  - `PORT`: `parseInt(process.env.PORT || '3000', 10)`
  - `DATABASE_PATH`: `process.env.DATABASE_PATH || 'data.db'`
  - `GEMINI_API_KEY`: `process.env.GEMINI_API_KEY || ''`
  - `EMBEDDING_DIM`: `768`
  - `EMBEDDING_MODEL`: `'text-embedding-004'`
  - `CHAT_MODEL`: `'gemini-2.0-flash'`
  - `TOP_K`: `5`
  - `SIMILARITY_THRESHOLD`: `0.30`
  - `MAX_TEXT_SIZE_BYTES`: `50000`
  - `FETCH_TIMEOUT_MS`: `10000`
  - `CHUNK_MAX_CHARS`: `800`
  - `CHUNK_MIN_CHARS`: `100`
  - `CHUNK_OVERLAP_CHARS`: `100`

- [ ] **Step 3: Write custom error classes in `server/src/lib/errors.ts`**
  Create `AppError` with `statusCode` and `isOperational`. Subclasses: `BadRequestError` (400), `NotFoundError` (404), `RateLimitError` (429), `ExternalServiceError` (502).

- [ ] **Step 4: Write Winston JSON logger in `server/src/lib/logger.ts`**
  Create Winston logger instance outputting JSON with `timestamp`, `level`, `requestId`, `phase`, `durationMs`, and `message` to `stdout`.

- [ ] **Step 5: Verify compilation**
  Run: `npm run build --workspace=server`
  Expected: PASS with 0 TypeScript errors.

- [ ] **Step 6: Commit**
  ```bash
  git add server/src/config.ts server/src/types/index.ts server/src/lib/errors.ts server/src/lib/logger.ts
  git commit -m "feat(server): define domain types, config constants, error classes, and logger"
  ```

---

### Task 3: Vector Math & Memory-Safe Serialization

**Files:**
- Create: `server/src/lib/vector.ts`
- Create: `server/tests/vector.test.ts`

**Interfaces:**
- Consumes: `EMBEDDING_DIM` from `server/src/config.ts`
- Produces: `serializeEmbedding(vec: number[]): Buffer`, `deserializeEmbedding(buf: Buffer): Float32Array`, `cosineSimilarity(a: Float32Array, b: Float32Array): number`

- [ ] **Step 1: Write the failing unit tests in `server/tests/vector.test.ts`**
  Write tests checking:
  1. `serializeEmbedding` produces a Buffer of exactly `3072` bytes for 768 numbers.
  2. `deserializeEmbedding` correctly decodes back into a `Float32Array` matching original float values within floating point tolerance.
  3. `deserializeEmbedding` handles unaligned byte offsets (`buffer.slice(...)`) without throwing `RangeError`.
  4. `cosineSimilarity` returns `1.0` for identical vectors, `0.0` for orthogonal vectors, and `-1.0` for opposing vectors.
  5. `cosineSimilarity` throws an error if vector dimensions do not match.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/lib/vector'"

- [ ] **Step 3: Implement vector functions in `server/src/lib/vector.ts`**
  Implement:
  ```typescript
  export function serializeEmbedding(vec: number[]): Buffer {
    if (vec.length !== 768) {
      throw new Error(`Invalid embedding dimension: expected 768, got ${vec.length}`);
    }
    const floatArray = new Float32Array(vec);
    return Buffer.from(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength);
  }

  export function deserializeEmbedding(buf: Buffer): Float32Array {
    if (buf.byteLength !== 3072) {
      throw new Error(`Invalid buffer length: expected 3072 bytes, got ${buf.byteLength}`);
    }
    const alignedBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Float32Array(alignedBuffer);
  }

  export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} !== ${b.length}`);
    }
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for all vector math and serialization test cases.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/lib/vector.ts server/tests/vector.test.ts
  git commit -m "feat(server): implement vector serialization and cosine similarity with memory alignment"
  ```

---

### Task 4: SQLite Database Manager & Startup Orphan Recovery

**Files:**
- Create: `server/src/lib/db.ts`
- Create: `server/tests/db.test.ts`

**Interfaces:**
- Consumes: `DATABASE_PATH` from `server/src/config.ts`, `logger`
- Produces: `getDatabase(dbPath?: string): Database`, `initDatabase(db: Database): void`

- [ ] **Step 1: Write the failing tests in `server/tests/db.test.ts`**
  Write tests against an in-memory or temporary SQLite database (`:memory:`):
  1. Verifies `items` and `chunks` tables exist after `initDatabase`.
  2. Verifies foreign keys are enforced (`PRAGMA foreign_keys` returns 1).
  3. Verifies WAL mode is enabled (`PRAGMA journal_mode`).
  4. Verifies startup reconciliation query: inserts an item with `status = 'processing'`, runs `initDatabase()`, and verifies status flips to `'failed'` with `error_message = 'Interrupted: Server restarted during ingestion'`.
  5. Verifies cascade delete: inserting an item and associated chunk, deleting the item, and confirming the chunk is purged.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/lib/db'"

- [ ] **Step 3: Implement database manager in `server/src/lib/db.ts`**
  Create database manager using `better-sqlite3`. Configure `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;`. Execute DDL for `items` (with `raw_content TEXT NOT NULL DEFAULT ''`) and `chunks` (with `ON DELETE CASCADE`), indexes on `item_id` and `status`. Run the startup orphan reconciliation update statement during initialization. Export singleton database getter.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for database schema initialization, cascade delete, and orphan recovery tests.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/lib/db.ts server/tests/db.test.ts
  git commit -m "feat(server): initialize SQLite schema, foreign keys, and startup orphan reconciliation"
  ```

---

### Task 5: Chunking Service (Paragraph Splitting, Regex Sentences & Fallback)

**Files:**
- Create: `server/src/services/chunking.service.ts`
- Create: `server/tests/chunking.test.ts`

**Interfaces:**
- Consumes: `CHUNK_MAX_CHARS` (800), `CHUNK_MIN_CHARS` (100), `CHUNK_OVERLAP_CHARS` (100) from `config.ts`
- Produces: `chunkText(rawText: string): string[]`

- [ ] **Step 1: Write the failing tests in `server/tests/chunking.test.ts`**
  Write unit tests checking:
  1. Short text ($<100$ chars) returns a single chunk without error.
  2. Paragraphs separated by `\n\n` remain distinct chunks when between 100 and 800 chars.
  3. Oversized paragraphs ($>800$ chars) are split on sentence boundaries (`/[.!?]\s+/`).
  4. Dense unpunctuated text ($>800$ chars with no sentence punctuation) falls back to hard character slicing at 800 characters with 100 character overlap.
  5. Small terminal chunk ($<100$ chars) merges into the preceding chunk.
  6. Empty or whitespace-only string returns an empty array `[]`.
  7. No chunk in the resulting array exceeds 800 characters.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/services/chunking.service'"

- [ ] **Step 3: Implement `chunkText` in `server/src/services/chunking.service.ts`**
  Implement the chunking algorithm:
  - Trim input; return `[]` if empty.
  - Split on `/\n\n+/`.
  - For segments $>800$ chars: split by `/(?<=[.!?])\s+/`.
  - If any sub-segment is still $>800$ chars, slice in chunks of 700 chars with 100 overlap.
  - Merge segments $<100$ chars with next segment (or previous if at end).
  - Add overlapping text window between consecutive segments while strictly ensuring `chunk.length <= CHUNK_MAX_CHARS`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for all chunking boundary and edge-case tests.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/services/chunking.service.ts server/tests/chunking.test.ts
  git commit -m "feat(server): implement paragraph and sentence chunking with dense text fallback"
  ```

---

### Task 6: Web Extraction Service with SSRF & Redirect Defense

**Files:**
- Create: `server/src/services/extraction.service.ts`
- Create: `server/tests/extraction.test.ts`

**Interfaces:**
- Consumes: `FETCH_TIMEOUT_MS` from `config.ts`, `BadRequestError`
- Produces: `extractUrlContent(url: string): Promise<{ title: string; bodyText: string }>`

- [ ] **Step 1: Write the failing tests in `server/tests/extraction.test.ts`**
  Write unit tests checking:
  1. Rejects non-http protocols (e.g., `file:///etc/passwd`, `ftp://...`) with `BadRequestError`.
  2. Rejects private/loopback hostnames (`localhost`, `127.0.0.1`, `::1`, `10.0.0.1`, `192.168.1.1`, `169.254.169.254`) with `BadRequestError`.
  3. Parses HTML mock containing scripts, styles, nav, and body text, returning clean text without script/nav tags and extracting `<title>`.
  4. Defaults title to the URL if `<title>` tag is missing.
  5. Throws if server returns non-200 HTTP code or redirect (301/302).

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/services/extraction.service'"

- [ ] **Step 3: Implement `extractUrlContent` in `server/src/services/extraction.service.ts`**
  Implement:
  - URL parse validation (`new URL(url)`). Check protocol is `http:` or `https:`.
  - Validate hostname against private IP / loopback patterns.
  - Fetch using standard `fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })`.
  - If status is 301, 302, 307, 308, throw `BadRequestError('Redirects are not permitted for security reasons')`.
  - Load response text into `cheerio.load(html)`.
  - Remove `$('script, style, nav, header, footer, noscript, iframe')`.
  - Extract `title = $('title').first().text().trim() || url`.
  - Extract body text, collapse whitespace: `$('body').text().replace(/\s+/g, ' ').trim()`.
  - Return `{ title, bodyText }`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for extraction and SSRF defense test cases.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/services/extraction.service.ts server/tests/extraction.test.ts
  git commit -m "feat(server): implement web extraction service with SSRF and redirect defense"
  ```

---

### Task 7: Gemini API Adapter (Batch Embedding & XML Context Prompting)

**Files:**
- Create: `server/src/services/gemini.service.ts`
- Create: `server/tests/gemini.test.ts`

**Interfaces:**
- Consumes: `@google/genai`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `CHAT_MODEL` from `config.ts`
- Produces: `generateEmbeddings(texts: string[]): Promise<number[][]>`, `generateAnswer(question: string, contextSnippets: SourceSnippet[]): Promise<string>`

- [ ] **Step 1: Write the failing tests in `server/tests/gemini.test.ts`**
  Mock `@google/genai` to test:
  1. `generateEmbeddings` calls `batchEmbedContents` with model `text-embedding-004` and returns float arrays.
  2. `generateEmbeddings` retries with exponential backoff on HTTP 429 rate limit responses, throwing `RateLimitError` after 3 failed retries.
  3. `generateAnswer` formats retrieved chunks inside `<context><source id="X" title="...">...</source></context>` tags.
  4. `generateAnswer` instructs the model to treat context as untrusted source data and cite sources via `[Source X]`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/services/gemini.service'"

- [ ] **Step 3: Implement `GeminiService` in `server/src/services/gemini.service.ts`**
  Implement wrapper around `@google/genai`. Implement exponential retry helper with jitter (1s, 2s, 4s). Implement `generateEmbeddings` using `batchEmbedContents`. Implement `generateAnswer` assembling prompt template with XML boundaries and system instructions, calling `ai.models.generateContent` targeting `gemini-2.0-flash`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for Gemini service embedding and prompt generation unit tests.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/services/gemini.service.ts server/tests/gemini.test.ts
  git commit -m "feat(server): implement Gemini client for batch embeddings and XML context generation"
  ```

---

### Task 8: Data Access Repositories (Items & Two-Stage Chunks)

**Files:**
- Create: `server/src/repositories/items.repository.ts`
- Create: `server/src/repositories/chunks.repository.ts`
- Create: `server/tests/repositories.test.ts`

**Interfaces:**
- Consumes: `getDatabase` from `db.ts`, types from `types/index.ts`
- Produces: `itemsRepo` (`createItem`, `getItemById`, `getAllItemMetadata`, `updateItemReady`, `updateItemFailed`, `deleteItemById`), `chunksRepo` (`insertChunks`, `getReadyVectorIndex`, `getChunksByIds`)

- [ ] **Step 1: Write the failing tests in `server/tests/repositories.test.ts`**
  Write tests against test SQLite database:
  1. `itemsRepo.createItem`: Inserts item with default `raw_content = ''` and initial `status = 'processing'`.
  2. `itemsRepo.getAllItemMetadata`: Returns list sorted by `created_at DESC` excluding `raw_content`.
  3. `itemsRepo.updateItemReady`: Updates title, `raw_content`, `status = 'ready'`, and `chunk_count`.
  4. `itemsRepo.updateItemFailed`: Updates `status = 'failed'` and `error_message`.
  5. `chunksRepo.insertChunks`: Inserts multiple chunks in a single transaction.
  6. `chunksRepo.getReadyVectorIndex`: Executes Stage 1 vector query, returning `{ id, embedding }` for items where `status = 'ready'`.
  7. `chunksRepo.getChunksByIds`: Executes Stage 2 query, fetching `{ id, itemId, content, title, sourceUrl }` for specified chunk IDs.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/repositories/items.repository'"

- [ ] **Step 3: Implement `items.repository.ts` and `chunks.repository.ts`**
  Implement prepared statements for `items` and `chunks` data access using `better-sqlite3`. Implement the two-stage retrieval methods in `chunks.repository.ts`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for repository CRUD and two-stage query tests.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/repositories/items.repository.ts server/src/repositories/chunks.repository.ts server/tests/repositories.test.ts
  git commit -m "feat(server): implement items repository and two-stage chunk retrieval repository"
  ```

---

### Task 9: Ingestion & Query Pipeline Services

**Files:**
- Create: `server/src/services/ingestion.service.ts`
- Create: `server/src/services/query.service.ts`
- Create: `server/tests/services.test.ts`

**Interfaces:**
- Consumes: `itemsRepo`, `chunksRepo`, `extractUrlContent`, `chunkText`, `GeminiService`, `vector`
- Produces: `startIngestion(dto: IngestRequestDTO): Promise<Item>`, `executeQuery(question: string): Promise<QueryResponseDTO>`

- [ ] **Step 1: Write the failing tests in `server/tests/services.test.ts`**
  Write tests checking:
  1. `startIngestion` for note creates item with `status: 'processing'` and completes background worker to `status: 'ready'`.
  2. `startIngestion` for URL calls extraction service, chunks content, generates embeddings, and saves chunks.
  3. `startIngestion` handles concurrent deletion: if parent item is deleted mid-flight, chunks insertion is aborted cleanly without unhandled rejection.
  4. `executeQuery` returns early message when ready items count is 0: "Your knowledge base is empty...".
  5. `executeQuery` returns fallback when top similarity $< 0.30$: "No sufficiently relevant information was found...".
  6. `executeQuery` embeds query, performs Stage 1 vector scan, fetches top 5 chunks via Stage 2, and returns LLM answer with source snippets.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/services/ingestion.service'"

- [ ] **Step 3: Implement `ingestion.service.ts` and `query.service.ts`**
  - In `ingestion.service.ts`: Implement `startIngestion`. Create initial item record. Fire unawaited background promise. Wrap background task with parent existence check (`itemsRepo.getItemById(itemId)`), extraction, chunking, Gemini embedding, transaction insertion, and status update. Catch errors, update item to `'failed'` with message.
  - In `query.service.ts`: Implement `executeQuery`. Check ready count early. Embed question. Fetch vector index from `chunksRepo.getReadyVectorIndex()`. Deserialize embeddings with byte-aligned slice and compute cosine similarities. Sort descending. Check threshold ($< 0.30$). Fetch top 5 chunk records via `chunksRepo.getChunksByIds`. Call `geminiService.generateAnswer`. Return `{ answer, sources }`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for ingestion pipeline and RAG query service tests.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/services/ingestion.service.ts server/src/services/query.service.ts server/tests/services.test.ts
  git commit -m "feat(server): implement async ingestion pipeline and two-stage RAG query service"
  ```

---

### Task 10: Express Middleware, Routers & API Test Suite

**Files:**
- Create: `server/src/middleware/request-logger.ts`
- Create: `server/src/middleware/error-handler.ts`
- Create: `server/src/routes/ingest.routes.ts`
- Create: `server/src/routes/items.routes.ts`
- Create: `server/src/routes/query.routes.ts`
- Create: `server/src/routes/health.routes.ts`
- Create: `server/src/index.ts`
- Create: `server/tests/api.test.ts`

**Interfaces:**
- Consumes: Services from Task 9, middleware, logger
- Produces: Running Express API server listening on `PORT` with routes mounted under `/api/*`

- [ ] **Step 1: Write integration tests in `server/tests/api.test.ts`**
  Write API tests testing HTTP endpoints:
  1. `GET /api/health` returns `200 OK` with `{ status: "ok" }`.
  2. `POST /api/ingest` validates body: missing content returns `400 Bad Request`.
  3. `POST /api/ingest` with valid note returns `202 Accepted` with initial item metadata.
  4. `GET /api/items` returns array of items.
  5. `DELETE /api/items/:id` deletes item and returns `200 OK`.
  6. `POST /api/query` with question returns `200 OK` with `{ answer, sources }`.
  7. Every response includes `X-Request-ID` header.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL with "Cannot find module '../src/index'"

- [ ] **Step 3: Implement middleware, routes and Express server**
  - Implement `request-logger.ts`: injects `X-Request-ID` via `node:crypto.randomUUID()`, logs start/end duration.
  - Implement `error-handler.ts`: converts exceptions to `{ error, details, requestId }`.
  - Implement route handlers under `server/src/routes/`.
  - Implement `server/src/index.ts`: initializes database, configures CORS, JSON parser (500KB limit), mounts `/api/ingest`, `/api/items`, `/api/query`, `/api/health`, attaches error handler, and starts server on `PORT`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS for all unit and integration API tests.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/middleware/ server/src/routes/ server/src/index.ts server/tests/api.test.ts
  git commit -m "feat(server): wire Express routes, request logging, error middleware, and API tests"
  ```

---

### Task 11: Frontend API Client & Domain Types

**Files:**
- Create: `client/src/types.ts`
- Create: `client/src/api/client.ts`

**Interfaces:**
- Consumes: Server API endpoints `/api/*`
- Produces: Typed API client methods (`ingestItem`, `fetchItems`, `deleteItem`, `submitQuery`) and UI domain types

- [ ] **Step 1: Define frontend types in `client/src/types.ts`**
  Mirror backend types: `Item`, `SourceSnippet`, `QueryResponseDTO`, `IngestRequestDTO`. Define UI state types for form tabs (`'note' | 'url'`) and polling state.

- [ ] **Step 2: Implement API client in `client/src/api/client.ts`**
  Implement typed fetch functions handling JSON responses and error extraction:
  - `ingestItem(dto: IngestRequestDTO): Promise<Item>` (`POST /api/ingest`)
  - `fetchItems(): Promise<Item[]>` (`GET /api/items`)
  - `deleteItem(id: number): Promise<void>` (`DELETE /api/items/${id}`)
  - `submitQuery(question: string): Promise<QueryResponseDTO>` (`POST /api/query`)
  - `checkHealth(): Promise<{ status: string }>` (`GET /api/health`)

- [ ] **Step 3: Verify client compilation**
  Run: `npm run build --workspace=client`
  Expected: PASS with 0 TypeScript errors.

- [ ] **Step 4: Commit**
  ```bash
  git add client/src/types.ts client/src/api/client.ts
  git commit -m "feat(client): implement typed API client and domain interfaces"
  ```

---

### Task 12: Ingestion & Items List Components

**Files:**
- Create: `client/src/components/Header.tsx`
- Create: `client/src/components/IngestForm.tsx`
- Create: `client/src/components/ItemCard.tsx`
- Create: `client/src/components/ItemList.tsx`

**Interfaces:**
- Consumes: `Item`, `IngestRequestDTO` from `client/src/types.ts`, `apiClient`
- Produces: Header bar, Note/URL tabbed form with validation, item list with status pills and delete buttons

- [ ] **Step 1: Implement `Header.tsx`**
  Render clean application banner with "AI Knowledge Inbox", subtitle, and active items count badge using Lucide icons (`Inbox`, `Sparkles`).

- [ ] **Step 2: Implement `IngestForm.tsx`**
  Accept `onIngested: () => void`. Tabbed switch between "Note" and "URL". Input validation (URL format, empty content). Submits to `ingestItem`, clears form on success, invokes `onIngested()`, and displays error messages if submission fails.

- [ ] **Step 3: Implement `ItemCard.tsx`**
  Render single card with type icon (globe for URL, file-text for note), title, source URL link, chunk count, timestamp, and status badge (`processing` in amber with spinner, `ready` in green, `failed` in red with error tooltip). Includes delete button calling `onDelete(item.id)`.

- [ ] **Step 4: Implement `ItemList.tsx`**
  Accept `items: Item[]`, `onDelete: (id: number) => Promise<void>`, `refreshItems: () => Promise<void>`. Manage polling: if any item is `'processing'`, poll `refreshItems()` every 3 seconds, capped at 30 iterations (90s). Show manual refresh button and empty state when items list is empty.

- [ ] **Step 5: Verify client compilation**
  Run: `npm run build --workspace=client`
  Expected: PASS with 0 TypeScript errors.

- [ ] **Step 6: Commit**
  ```bash
  git add client/src/components/Header.tsx client/src/components/IngestForm.tsx client/src/components/ItemCard.tsx client/src/components/ItemList.tsx
  git commit -m "feat(client): implement ingestion form and item list components with polling lifecycle"
  ```

---

### Task 13: Query Interface & Dual Citation Display Components

**Files:**
- Create: `client/src/components/QueryPanel.tsx`
- Create: `client/src/components/AnswerDisplay.tsx`
- Create: `client/src/components/SourceSnippet.tsx`
- Create: `client/src/components/ErrorBanner.tsx`

**Interfaces:**
- Consumes: `SourceSnippet`, `QueryResponseDTO`, `apiClient`
- Produces: Query panel, synthesized answer view with citation markers, deterministic source cards with similarity match percentage

- [ ] **Step 1: Implement `ErrorBanner.tsx`**
  Dismissable alert banner for network errors or API rate limit warnings.

- [ ] **Step 2: Implement `QueryPanel.tsx`**
  Accept `onSubmitQuery: (question: string) => Promise<void>`, `isLoading: boolean`. Render question textarea, submit button with loading spinner, and suggested starter questions.

- [ ] **Step 3: Implement `SourceSnippet.tsx`**
  Render individual source card displaying source title, similarity score as percentage badge (`${Math.round(snippet.similarity * 100)}% match`), source URL if present, and excerpt content.

- [ ] **Step 4: Implement `AnswerDisplay.tsx`**
  Accept `answer: string`, `sources: SourceSnippet[]`, `isLoading: boolean`. When loading, display skeleton placeholders. When answer is present, render answer text formatting `[Source X]` citations as highlighted badges, and mount the grid of `SourceSnippet` cards directly below the answer.

- [ ] **Step 5: Verify client compilation**
  Run: `npm run build --workspace=client`
  Expected: PASS with 0 TypeScript errors.

- [ ] **Step 6: Commit**
  ```bash
  git add client/src/components/QueryPanel.tsx client/src/components/AnswerDisplay.tsx client/src/components/SourceSnippet.tsx client/src/components/ErrorBanner.tsx
  git commit -m "feat(client): implement query panel and dual citation source snippet display"
  ```

---

### Task 14: Root Application State Lifting & Layout Assembly

**Files:**
- Create: `client/src/App.tsx`
- Create: `client/src/main.tsx`

**Interfaces:**
- Consumes: All UI components from Tasks 12 & 13, `apiClient`
- Produces: Main responsive 2-column layout and central state management

- [ ] **Step 1: Implement `client/src/App.tsx`**
  - Owns top-level state: `items: Item[]`, `isLoadingItems: boolean`, `queryResult: QueryResponseDTO | null`, `isQuerying: boolean`, `error: string | null`.
  - Implements `refreshItems = async () => { ... }` fetching from `apiClient.fetchItems()`.
  - Implements `handleDelete = async (id: number) => { ... }` deleting item and updating state.
  - Implements `handleQuery = async (question: string) => { ... }` calling `apiClient.submitQuery()`.
  - Mounts responsive 2-column desktop layout:
    - Top: `<Header />`
    - Main container:
      - Left column: `<IngestForm onIngested={refreshItems} />` and `<ItemList items={items} onDelete={handleDelete} refreshItems={refreshItems} />`
      - Right column: `<QueryPanel onSubmitQuery={handleQuery} isLoading={isQuerying} />`, `<AnswerDisplay answer={queryResult?.answer} sources={queryResult?.sources || []} isLoading={isQuerying} />`
    - Top alert: `<ErrorBanner message={error} onDismiss={() => setError(null)} />`

- [ ] **Step 2: Implement `client/src/main.tsx`**
  Mount React DOM strictly:
  ```typescript
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from './App';
  import './index.css';

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  ```

- [ ] **Step 3: Verify client build and type-checking**
  Run: `npm run build --workspace=client`
  Expected: PASS with 0 errors and production bundle generated in `client/dist`.

- [ ] **Step 4: Commit**
  ```bash
  git add client/src/App.tsx client/src/main.tsx
  git commit -m "feat(client): assemble root application view with lifted state and responsive 2-column layout"
  ```

---

### Task 15: End-to-End Verification & Evaluator Documentation

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: Full monorepo implementation
- Produces: Evaluator documentation and verified end-to-end smoke test

- [ ] **Step 1: Write comprehensive `README.md`**
  Document:
  1. **Quick Start**:
     ```bash
     git clone <repo>
     cd turium
     npm install
     cp .env.example .env # add GEMINI_API_KEY
     npm run dev
     ```
  2. **Architecture Overview**: System block diagram showing Express, SQLite, React, and Gemini pipeline.
  3. **Design Decisions & Tradeoffs**:
     - *Async Ingestion*: Why `202 Accepted` + in-process worker was chosen over synchronous blocking or Redis.
     - *Storage & Retrieval*: Why SQLite vector BLOBs + two-stage retrieval was selected over external vector databases.
     - *Chunking*: Why paragraph boundaries with sentence splitting and dense text fallback was used.
     - *Dual Citation*: How deterministic source snippets protect against LLM citation hallucination.
  4. **API Reference**: Table of `/api/*` endpoints with request and response examples.
  5. **Known Limitations**: JS-rendered SPAs returning empty initial HTML via server fetch.
  6. **What Breaks at Scale & Production Next Steps**: HNSW indexing (`sqlite-vec`), Redis/BullMQ worker scaling, token streaming via SSE.

- [ ] **Step 2: Execute full test suite**
  Run: `npm test`
  Expected: PASS for all unit and integration test suites.

- [ ] **Step 3: Execute full monorepo build**
  Run: `npm run build`
  Expected: PASS for both server (`tsc`) and client (`vite build`) with 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add README.md
  git commit -m "docs: write comprehensive evaluator guide, architecture documentation, and tradeoffs"
  ```
