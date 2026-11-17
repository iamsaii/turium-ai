# Goldfish Annotated Review Report

**Target:** `docs/designs/ai_knowledge_inbox.md` (`Lines 293–509` + `Lines 1–292`)  
**Status:** Resolved (12 fixes accepted and applied, 1 nit skipped)  
**Date:** 2026-11-17

## Prioritized Findings & AI Suggestions

### 1. Missing CSS Stylesheet Asset (`client/src/index.css`) [`egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** Lines 431–442 (`Section 3.4 & 3.6`)
* **Discrepancy Description:** `main.tsx` imports `./index.css` and Tailwind config is present, but `client/src/index.css` is omitted from the target files list, causing a build failure.
* **Rationale:** Essential build dependency.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Adding `client/src/index.css` with `@tailwind base; @tailwind components; @tailwind utilities;` resolves the build error.
* **Proposed Edit:**
  * Location: `Detailed Implementation Plan -> Section 3 (Frontend Client)`
  * Change: Add file item `3.4b client/src/index.css (Create)` with Tailwind directives.

---

### 2. Vitest Default Interactive Watch Mode Hang [`egm-implementation-readiness`] - Severity: Blocker
* **Affected Scope:** Lines 301, 321, 495–499 (`package.json scripts`)
* **Discrepancy Description:** `vitest` in standard terminal runs in interactive watch mode, hanging automated `npm test` runs.
* **Rationale:** Test runner must terminate after one execution.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Explicitly configuring `"test": "vitest run"` in `server/package.json` ensures predictable completion.
* **Proposed Edit:**
  * Location: `Detailed Implementation Plan -> Section 1.1 & 2.1`
  * Change: Specify `"test": "vitest run"` in `server/package.json` and `"test": "npm --prefix server test"` in root `package.json`.

---

### 3. Float32Array Memory Alignment Exception on Buffer Deserialization [`egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** Lines 146–147, Lines 340–342 (`server/src/lib/vector.ts`)
* **Discrepancy Description:** Node.js Buffer slab allocation does not guarantee `byteOffset % 4 === 0`, causing `new Float32Array(...)` to throw `RangeError`.
* **Rationale:** Runtime memory alignment safety is mandatory.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Slicing the buffer ensures an aligned ArrayBuffer backing.
* **Proposed Edit:**
  * Location: `Section 2.2` and `Section 2.6 (server/src/lib/vector.ts)`
  * Change: Mandate `buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)` before instantiating `Float32Array`.

---

### 4. Schema `NOT NULL` Constraint Violation on Async URL Ingestion [`egm-implementation-readiness`] - Severity: Blocker
* **Affected Scope:** Lines 120–131, 173–184, 336–338, 380–382
* **Discrepancy Description:** Inserting an item placeholder on `POST /api/ingest` before web content is extracted crashes SQLite due to `title TEXT NOT NULL` and `raw_content TEXT NOT NULL`.
* **Rationale:** Asynchronous ingestion requires non-null placeholder values on initial insert.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Defaulting `title` to `dto.title || dto.content` and `raw_content` to `""` on initial insert satisfies SQLite constraints without weakening schema semantics.
* **Proposed Edit:**
  * Location: `Section 2.1`, `Section 3 Schema`, and `Section 2.16`
  * Change: Add `DEFAULT ''` to `raw_content` and document initial insert values.

---

### 5. Missing Frontend State Lifting & Cross-Component Notification Contract [`egm-implementation-readiness`] - Severity: Blocker
* **Affected Scope:** Lines 455–466, 483–487 (`client/src/App.tsx`)
* **Discrepancy Description:** `IngestForm` and `ItemList` are described as isolated components without defining where `items` state lives or how adding an item triggers a list refresh.
* **Rationale:** Clear state ownership is necessary for clean implementation.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Define `App.tsx` as the single owner of `items` state, providing `onIngested` callback to `IngestForm` and `onDelete` to `ItemList`.
* **Proposed Edit:**
  * Location: `Section 3.10`, `Section 3.11`, and `Section 3.17`
  * Change: Explicitly document state lifting and prop contracts in `App.tsx`.

---

### 6. API Route Prefix Discrepancy [`egm-structural` / `egm-design`] - Severity: Blocker
* **Affected Scope:** Lines 58, 99–101, 120, 201–207
* **Discrepancy Description:** Mismatch between `/ingest` (diagram/CUJ) and `/api/ingest` (API table/server).
* **Rationale:** Inconsistent routing causes 404 errors.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Normalize all route references to use the `/api` prefix throughout.
* **Proposed Edit:**
  * Location: Diagram, CUJs, and Subsystem descriptions
  * Change: Update all endpoints to `/api/ingest`, `/api/items`, `/api/items/:id`, `/api/query`, `/api/health`.

---

### 7. Startup Orphan Recovery Query [`egm-zoom-out`] - Severity: Major
* **Affected Scope:** Lines 122–132, 336–338, 404–406
* **Discrepancy Description:** Server restarts during ingestion leave items permanently in `status = 'processing'`, causing endless client polling.
* **Rationale:** Crash recovery is an essential operational guarantee.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Execute `UPDATE items SET status = 'failed', error_message = 'Interrupted: Server restarted during ingestion' WHERE status = 'processing'` on server startup in `db.ts`.
* **Proposed Edit:**
  * Location: `Section 2.1` and `Section 2.5 (server/src/lib/db.ts)`
  * Change: Add startup orphan reconciliation query.

---

### 8. Two-Stage Query Pattern for Vector Retrieval [`egm-zoom-out`] - Severity: Major
* **Affected Scope:** Lines 140–148, 363–366, 384–386
* **Discrepancy Description:** Loading full chunk text alongside 3KB vector BLOBs on every question query bloats memory.
* **Rationale:** Scanning only vector IDs and embeddings in Stage 1 and fetching text only for top 5 matches in Stage 2 is 95% lighter and completely stateless.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Document the two-stage query pattern in `query.service.ts` and `chunks.repository.ts`.
* **Proposed Edit:**
  * Location: `Section 2.2` and `Section 2.12 / 2.17`
  * Change: Specify Stage 1 (vector scan) and Stage 2 (context fetch) SQL queries.

---

### 9. Concurrency Race on Item Deletion [`egm-design`] - Severity: Major
* **Affected Scope:** Lines 130–132, 380–382
* **Discrepancy Description:** Deleting an item while ingestion is in-flight causes a foreign key constraint violation when `insertChunks` executes.
* **Rationale:** Unhandled promise rejections terminate Node processes.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Check parent item existence before inserting chunks and handle foreign key constraint errors gracefully.
* **Proposed Edit:**
  * Location: `Section 2.1` and `Section 2.16 (ingestion.service.ts)`
  * Change: Add parent existence verification and error handling.

---

### 10. SSRF Manual Redirect Protection & IP Filtering [`egm-design` / `egm-codebase-details`] - Severity: Major
* **Affected Scope:** Lines 264–265, 371–374
* **Discrepancy Description:** Node `fetch` follows 301/302 redirects by default, allowing public URLs to redirect to local or cloud metadata endpoints (`169.254.169.254`).
* **Rationale:** SSRF defense must cover redirects and loopback/metadata ranges.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Configure `fetch` with `redirect: 'manual'` and validate hostnames against loopback, private RFC 1918, and metadata IP subnets in `extraction.service.ts`.
* **Proposed Edit:**
  * Location: `Section Security & Privacy` and `Section 2.14`
  * Change: Document `redirect: 'manual'` and IP blocklist.

---

### 11. Sentence Chunking Fallback for Dense / Non-Prose Text [`egm-implementation-readiness`] - Severity: Major
* **Affected Scope:** Lines 125–129, 375–378
* **Discrepancy Description:** Text without sentence boundaries (`. `) fails to split, leaving oversized chunks.
* **Rationale:** Chunk size ceiling must be guaranteed regardless of input format.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Split on `/[.!?]\s+/`, merge small terminal chunks into the preceding chunk, and add a hard character slicing fallback at 800 chars.
* **Proposed Edit:**
  * Location: `Section 2.1` and `Section 2.15 (chunking.service.ts)`
  * Change: Document regex splitting, terminal chunk merging, and hard character fallback.

---

### 12. Shared DTO Definitions & Concurrency / Config Constants [`egm-codebase-details`] - Severity: Major
* **Affected Scope:** Lines 299–302, 327–334, 443–446
* **Discrepancy Description:** Shared DTO property names are inconsistent across frontend/backend, `concurrently` is missing from devDependencies, and model names are omitted from `config.ts`.
* **Rationale:** Eliminates implementation guesswork.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Pin exact `SourceSnippet` and `QueryResponseDTO` TypeScript interfaces, add `concurrently: "^9.1.0"` to root package, and pin model constants (`text-embedding-004`, `gemini-2.0-flash`).
* **Proposed Edit:**
  * Location: `Section 1.1`, `Section 2.3`, `Section 2.4`, `Section 3.7`
  * Change: Pin interfaces, devDependency, and model constants.

---

### 13. Heading Levels and Cleanup of Evaluation Jargon [`egm-structural` / `egm-style`] - Severity: Nit
* **Affected Scope:** Lines 223, 230, 236, 278–290
* **Discrepancy Description:** Nested H3 headings under H2 NFR, and explicit mentions of "interview brief" and "rubric".
* **Rationale:** Clean, professional technical document formatting.
* **AI Suggestion:** PROPOSE FIX
* **Justification:** Promote supplemental sections to H2 and reframe tradeoff rationales objectively.
* **Proposed Edit:**
  * Location: Document structural headings and Alternatives section
  * Change: Promote to `## Additional Resources` and `## Future Improvements`, and reframe prose cleanly.
