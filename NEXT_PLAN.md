# FlowForge — Next Steps Plan

Picking up after Phases 1–7 of FLOWISE_PATTERNS_PLAN.md are complete.

**Current stats:** 335 unit tests (29 files), 95 compat tests (16 files),
3 node implementations out of 301 definitions.

---

## 1. Evaluation Tracer (§7.3 — unfinished)

**Problem:** When an evaluation item fails, there's no way to see *which node*
produced bad output or what intermediate values flowed through the graph.

**Goal:** Per-node execution tracing during evaluation runs, linked to the
evaluation run ID for post-mortem debugging.

### Data model

```typescript
interface NodeTraceEntry {
  nodeId: string
  nodeName: string
  nodeLabel: string
  input: unknown
  output: unknown
  latencyMs: number
  error?: string
}

interface EvaluationTrace {
  evaluationRunId: string
  datasetItemIndex: number
  input: string
  nodes: NodeTraceEntry[]
}
```

### Implementation

1. Create `apps/server/src/services/evaluationTracer.ts`
   - Class or function-based tracer that wraps `flowRunner.executeFlow()`
   - Intercepts each `initNode()` call to record input/output/timing
   - Collects a `NodeTraceEntry[]` per dataset item

2. Create `apps/server/src/storage/traceStore.ts`
   - In-memory store: `Map<evaluationRunId, EvaluationTrace[]>`
   - CRUD: `getTraces(runId)`, `getTrace(runId, itemIndex)`, `_reset()`

3. Wire into `evaluationRunner.ts`
   - When `runEvaluation()` is called, create tracer
   - Pass tracer into the predict function so each node execution is recorded
   - Store traces alongside results

4. Add route `GET /api/v1/evaluations/:id/traces`
   - Returns all traces for a run
   - Optional `?item=N` query param to get a single item's trace

5. Unit tests
   - Tracer records entries for a multi-node flow
   - Traces are stored and retrievable by run ID
   - Error in a node is captured in trace (not lost)

### Tasks

- [ ] 1.1 Create `traceStore.ts` with in-memory store
- [ ] 1.2 Create `evaluationTracer.ts` wrapping node execution
- [ ] 1.3 Wire tracer into `evaluationRunner.runEvaluation()`
- [ ] 1.4 Add `GET /api/v1/evaluations/:id/traces` route
- [ ] 1.5 Unit tests for tracer + trace store
- [ ] 1.6 Run `all-checks.sh` and commit

---

## 2. Evaluation Integration Test (§7.9 — unfinished)

**Problem:** Evaluation stores, runner, and routes have unit tests, but no
end-to-end test that exercises the full HTTP path:
create dataset → run evaluation → verify results.

**Goal:** Integration test in `server.integration.test.ts` (or new file) that
hits the actual Fastify routes without mocking.

### Test scenario

```
1. POST /api/v1/datasets          → create dataset with 3 items
2. POST /api/v1/datasets/:id/items → add 2 more items
3. GET  /api/v1/datasets/:id      → verify 5 items
4. POST /api/v1/evaluations       → run evaluation (uses stub predict)
5. GET  /api/v1/evaluations/:id   → verify status=completed, summary counts
6. DELETE /api/v1/evaluations/:id → cleanup
7. DELETE /api/v1/datasets/:id    → cleanup
```

### Tasks

- [ ] 2.1 Add evaluation integration tests to `server.integration.test.ts`
- [ ] 2.2 Run `all-checks.sh` and commit

---

## 3. Compat Tests for New Routes

**Problem:** Compat tests (apps/compat-tests) validate API parity against
Flowise. The following routes added in Phases 3-7 have zero compat coverage:

| Route group | Phase | Compat test |
|-------------|-------|-------------|
| `POST/GET/DELETE /marketplaces/custom` | 3 | ❌ |
| `GET/POST/DELETE /datasets` | 7 | ❌ |
| `GET/POST/DELETE /evaluations` | 7 | ❌ |

Marketplace read endpoints (`GET /marketplaces`) are already covered in
`13_documentstore_marketplace.test.ts`.

### Implementation

1. **`14_marketplace_custom.test.ts`** — Custom marketplace template CRUD
   - POST creates template, GET lists, DELETE removes
   - Validate response schemas match Flowise

2. **`15_datasets_evaluations.test.ts`** — Dataset + evaluation CRUD
   - Dataset CRUD lifecycle
   - Evaluation run lifecycle
   - Note: Flowise may not have these endpoints yet — mark as reimpl-only
     if needed (`TARGET_NAME === 'reimpl'`)

### Tasks

- [ ] 3.1 Add Zod schemas for datasets/evaluations to `schemas.ts`
- [ ] 3.2 Create `14_marketplace_custom.test.ts`
- [ ] 3.3 Create `15_datasets_evaluations.test.ts`
- [ ] 3.4 Run compat tests against reimpl, fix any issues
- [ ] 3.5 Run `all-checks.sh` and commit

---

## 4. Expand Node Implementations

**Problem:** Only 3 of 301 node definitions have `init` functions:
`chatDeepseek`, `bufferMemory`, `conversationChain`. This means only one
flow topology actually executes — everything else returns stub responses.

**Goal:** Implement the most commonly used nodes to enable real flow execution
for the most popular marketplace templates.

### Priority nodes (by marketplace template usage)

| Node | Category | Why |
|------|----------|-----|
| `chatOpenAI` | Chat Models | Most popular LLM node |
| `openAIEmbeddings` | Embeddings | Required for RAG flows |
| `recursiveCharacterTextSplitter` | Text Splitters | Required for document loading |
| `cheerioWebScraper` | Document Loaders | Popular web data source |
| `pdfFile` | Document Loaders | Popular file data source |
| `memoryVectorStore` (in-memory) | Vector Stores | Simplest vector store for dev |
| `retrievalQAChain` | Chains | Basic RAG chain |
| `conversationalRetrievalQAChain` | Chains | RAG + memory |
| `openAIFunctionAgent` | Agents | Popular agent pattern |
| `toolAgent` | Agents | Flexible tool-calling agent |
| `calculator` | Tools | Simple tool, good for testing |
| `customTool` | Tools | User-defined function tool |

### Implementation pattern (per node)

Each node is one file under `apps/server/src/services/nodes/`:

```
services/nodes/chatOpenAI.ts
  export async function initChatOpenAI(nodeData, credentialData) → ChatOpenAI
```

Then register in `nodesPool.ts` → `NODE_IMPLEMENTATIONS` map.

### Tasks

- [ ] 4.1 Implement `chatOpenAI` node
- [ ] 4.2 Implement `openAIEmbeddings` node
- [ ] 4.3 Implement `recursiveCharacterTextSplitter` node
- [ ] 4.4 Implement `memoryVectorStore` node (in-memory FAISS or simple)
- [ ] 4.5 Implement `retrievalQAChain` node
- [ ] 4.6 Implement `calculator` + `customTool` tool nodes
- [ ] 4.7 Register all in `nodesPool.ts`
- [ ] 4.8 Unit tests for each node's init function
- [ ] 4.9 E2E test: build a simple RAG flow → predict → get real answer
- [ ] 4.10 Run `all-checks.sh` and commit

---

## 5. Persistent Storage

**Problem:** All 11 stores are in-memory (`Map<string, T>`). Server restart
loses everything. This blocks real usage and multi-instance deployment.

**Goal:** SQLite-backed persistence with the same API surface, so routes and
services don't change.

### Architecture

```
storage/
  inMemoryStore.ts        ← existing generic store (keep as fallback)
  sqliteStore.ts          ← NEW: generic SQLite-backed store
  migrations/
    001_init.sql          ← create tables for all entity types
  chatflowStore.ts        ← switch: env STORAGE=sqlite → sqliteStore
  credentialStore.ts      ← switch
  datasetStore.ts         ← switch
  evaluationStore.ts      ← switch
  ...
```

### Design decisions

- Use `better-sqlite3` (synchronous, zero-config, single-file DB)
- Store JSON blobs for complex fields (flowData, results, items)
- Migration runner on startup
- `STORAGE=memory|sqlite` env var (default: `memory` for tests, `sqlite` for prod)
- Credential encryption stays as-is (AES before storage)

### Tables

| Table | Key columns |
|-------|-------------|
| `chatflows` | id, name, flowData (JSON), deployed, createdDate, updatedDate |
| `credentials` | id, name, credentialName, encryptedData, createdDate, updatedDate |
| `datasets` | id, name, description, items (JSON), createdDate, updatedDate |
| `evaluation_runs` | id, datasetId, chatflowId, status, results (JSON), summary (JSON) |
| `variables` | id, name, value, type |
| `api_keys` | id, keyName, apiKey, apiSecret |
| `tools` | id, name, description, schema, func |
| `assistants` | id, name, description, credential, model |
| `document_stores` | id, name, description, status, vectorStoreConfig (JSON) |
| `custom_templates` | id, templateName, flowData (JSON), description, type |

### Tasks

- [ ] 5.1 Add `better-sqlite3` dependency
- [ ] 5.2 Create migration runner + `001_init.sql`
- [ ] 5.3 Create `sqliteStore.ts` generic CRUD implementation
- [ ] 5.4 Create `STORAGE` env toggle in each store module
- [ ] 5.5 Migrate `inMemoryStore` (chatflows) to dual-backend
- [ ] 5.6 Migrate remaining stores one by one
- [ ] 5.7 Unit tests with SQLite backend
- [ ] 5.8 Integration tests: restart server → data survives
- [ ] 5.9 Run `all-checks.sh` and commit

---

## Implementation Order

| # | Item | Effort | Depends On |
|---|------|--------|------------|
| **1** | Evaluation Tracer | Low-Med | — |
| **2** | Evaluation Integration Test | Low | — |
| **3** | Compat Tests for New Routes | Low | — |
| **4** | Expand Node Implementations | High | — |
| **5** | Persistent Storage (SQLite) | Med-High | — |

Items 1-3 are quick wins that harden what we already have.
Item 4 is the biggest bang-for-buck for actually running real flows.
Item 5 is required before any production deployment.
