# Critic Review Report: AI Knowledge Inbox Feature Specification

**Target:** `/Users/sai/Developer/Personal/turium/docs/designs/ai_knowledge_inbox.md` (Lines 1–292)  
**Context Evaluated:** `/Users/sai/Developer/Personal/turium/concepts_brief.md`  
**Date:** 2026-11-17

---

## Reviewer Status

| Reviewer | Lens | Status |
|---|---|---|
| `egm-design` | Hostile System Architect | completed |
| `egm-structural` | Layout & Structural Auditor | completed |
| `egm-style` | Technical Copy Editor | completed |

---

## Prioritized Findings (Blockers -> Major -> Nits)

### 🔴 Blocker 1: API Route Prefix Inconsistency
* **Affected Scope:** Lines 58, 99–101, 120, 201–207
* **Discrepancy**: A routing mismatch exists between the Architecture Diagram / CUJ text and the API Specification table:
  - Architecture Diagram & Ingestion text: `POST /ingest`, `GET /items`, `DELETE /items/:id`, `POST /query`
  - REST API table & Express router mount: `POST /api/ingest`, `GET /api/items`, `DELETE /api/items/:id`, `POST /api/query`
* **Recommendation**: Standardize all endpoints throughout diagrams, text, and tables to consistently use `/api/*`.

### 🔴 Blocker 2: Foreign Key Violation & Process Crash on Concurrent Item Deletion
* **Affected Scope:** Lines 58–59, 131, 171, 187
* **Discrepancy**: If a user calls `DELETE /api/items/:id` while the background ingestion worker is awaiting URL fetch or Gemini API responses, SQLite purges the parent item. When the worker finishes and calls `insertChunks`, SQLite throws a foreign key constraint violation (`PRAGMA foreign_keys = ON`), causing an unhandled promise rejection that crashes the server.
* **Recommendation**:
  1. The worker must check if the parent item still exists before inserting chunks and handle foreign key / record-deleted errors gracefully.
  2. Maintain an in-memory `AbortController` map keyed by `itemId`. When `DELETE /api/items/:id` is received, call `.abort()` to cancel pending fetch and Gemini API calls immediately.

### 🔴 Blocker 3: Float32Array Memory Alignment Exception on Buffer Deserialization
* **Affected Scope:** Lines 146–147, 341
* **Discrepancy**: Instantiating `new Float32Array(buffer.buffer, buffer.byteOffset, 768)` on an unaligned Node.js Buffer slab offset (where `buffer.byteOffset % 4 !== 0`) throws a fatal runtime exception: `RangeError: start offset of Float32Array should be a multiple of 4`.
* **Recommendation**: Create an aligned buffer copy:
  ```typescript
  const aligned = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const vector = new Float32Array(aligned);
  ```

---

### 🟡 Major 4: Inadequate SSRF Defense (Redirects & Cloud Metadata)
* **Affected Scope:** Lines 123, 264–265
* **Discrepancy**: Standard `fetch` follows 301/302 redirects by default. A public URL can redirect to `http://169.254.169.254/` (cloud metadata) or local loopback. The IP blocklist also omits IPv6 loopback (`::1`) and metadata subnets (`169.254.0.0/16`).
* **Recommendation**: Configure `fetch` with `redirect: 'manual'`, resolve DNS before connecting, and expand the IP blocklist.

### 🟡 Major 5: Orphaned 'processing' State on Server Restart
* **Affected Scope:** Lines 38–40, 47, 121–122, 461
* **Discrepancy**: If the server crashes or restarts during ingestion, items remain in `'processing'` forever, creating an endless client polling loop.
* **Recommendation**: Add a boot-time reconciliation query:
  ```sql
  UPDATE items SET status = 'failed', error_message = 'Ingestion interrupted by server restart' WHERE status = 'processing';
  ```

### 🟡 Major 6: Chunking Edge Cases (Punctuation, Terminal Fragments, Overlap Count)
* **Affected Scope:** Lines 125–129
* **Discrepancy**:
  1. Splitting on `". "` misses `!` and `?` and fails on continuous prose without sentence boundaries.
  2. Merging small chunks into subsequent chunks fails if the *terminal* chunk is under 100 characters.
  3. Overlap added after 800-character segments pushes chunk length to 900 characters.
* **Recommendation**: Split on regex `/[.!?]\s+/`, fall back to character slicing at 800 chars, merge small terminal chunks into the *preceding* chunk, and ensure total length with overlap does not exceed 800 chars.

### 🟡 Major 7: Missing Empty Knowledge Base & Relevance Guard in RAG Query
* **Affected Scope:** Lines 50–54, 148–166, 206
* **Discrepancy**: Querying when 0 items exist or when similarity scores are negative/low still calls Gemini Flash, wasting tokens and risking hallucinations.
* **Recommendation**: Early-exit with a clean message if `readyChunks.length === 0`, and apply a minimum similarity threshold (e.g., $\ge 0.35$).

### 🟡 Major 8: Direct Prompt Interpolation Vulnerable to Prompt Injection
* **Affected Scope:** Lines 154–164
* **Discrepancy**: Concatenating raw text directly into system prompts allows untrusted web content to override assistant instructions.
* **Recommendation**: Wrap context in XML tags (`<context><source id="1" title="...">...</source></context>`) and instruct the model to treat content inside strictly as untrusted data.

### 🟡 Major 9: Over-Fetching Payload in `GET /api/items`
* **Affected Scope:** Lines 204, 361
* **Discrepancy**: Polling `GET /api/items` every 3 seconds transfers `raw_content` (up to 50KB per item) across all items repeatedly.
* **Recommendation**: Project only metadata columns in `GET /api/items`, excluding `raw_content`.

---

### 🟢 Nit 10: Heading Hierarchy Discrepancy
* **Affected Scope:** Lines 278–290
* **Discrepancy**: `### Additional Resources` and `### Future Improvements` are formatted as H3 nested under H2 `## Non-Functional Requirements`.
* **Recommendation**: Promote both to H2 (`## Additional Resources`, `## Future Improvements`).

### 🟢 Nit 11: Ambiguous Embedding SDK Method Signature
* **Affected Scope:** Line 130
* **Discrepancy**: Phrasing "Calls Gemini API embedContent (or batch embed)" is ambiguous.
* **Recommendation**: Explicitly specify `@google/genai` method `batchEmbedContents`.

### 🟢 Nit 12: Raw LaTeX Formula Delimiters
* **Affected Scope:** Lines 146–147, 269
* **Discrepancy**: Raw `$$\text{similarity}...$$` and `$\le 1,000$` do not render cleanly in standard GitHub markdown.
* **Recommendation**: Provide clean ASCII/Unicode equivalents.
