# FlowForge — Next Steps

Three areas to address: remove `hasLLM` scaffolding, add auth middleware, implement stubbed endpoints.

---

## 1. Remove `hasLLM`

`hasLLM` exists because Flowise needs real LLM API keys + wired nodes to run predictions,
while the reimpl has a stub engine that always succeeds. Since the reimpl now has real
flow execution (Step 5a — Deepseek via LangChain), the stub path is the fallback, not
the primary path. The `hasLLM` flag gates 6 test blocks:

| File | Guard | What it skips |
|------|-------|---------------|
| `03_prediction_nonstream.test.ts` | `describe.skipIf(!hasLLM)` | Entire prediction suite |
| `04_prediction_stream_sse.test.ts` | `describe.skipIf(!hasLLM)` | Entire SSE suite |
| `08_concurrency.test.ts` | `it.skipIf(!hasLLM)` | 5 parallel predictions |
| `09_regression_quirks.test.ts` | `it.skipIf(!hasLLM)` | Large body test |
| `01_flowise_embed_smoke.test.ts` | `it.skipIf(!hasLLM)` | Embed prediction + streaming |

### Plan

1. Remove `hasLLM` export from `setup.ts`
2. Remove all `skipIf(!hasLLM)` guards — predictions always work on reimpl (stub fallback)
3. For Flowise target: predictions still fail without real LLM, but that's a target setup issue,
   not a test design issue. If Flowise has a wired chatflow, tests pass. If not, they fail.
   Use `HAS_LLM=1` env var explicitly when running against a configured Flowise instance.
4. Replace `hasLLM` import with a simpler `describe.skipIf(process.env.HAS_LLM !== '1' && config.targetName !== 'reimpl')` inline, OR just remove the skip entirely since reimpl always has stubs and Flowise tests should be run with proper setup.

**Simplest approach**: Keep `hasLLM` but change it to `process.env.HAS_LLM === '1'` only —
remove the `|| config.targetName === 'reimpl'` override. The reimpl prediction tests will
always run (stub engine), and Flowise tests will run when `HAS_LLM=1` is set.

Wait — that breaks reimpl. The reimpl always works, so `hasLLM` should be true for it.
The current logic (`HAS_LLM=1 || reimpl`) is actually correct. The question is: do we need
the flag at all?

**Answer**: No. The flag solves a Flowise test-runner problem (no LLM configured), not a
reimpl problem. Remove the flag, remove all `skipIf(!hasLLM)` guards. For Flowise, if
predictions fail, the test fails — which is correct.

### Tasks

- [ ] 1.1 Delete `hasLLM` from `setup.ts`
- [ ] 1.2 Remove `skipIf(!hasLLM)` from all 5 test files
- [ ] 1.3 Remove `hasLLM` imports from those files
- [ ] 1.4 Run reimpl compat tests — all should pass (stub engine)
- [ ] 1.5 Run Flowise compat tests — prediction tests will fail (expected, no real LLM configured)

---

## 2. Auth Middleware

The reimpl has auth endpoints (register, login, logout, resolve) but **no middleware** that
enforces authentication on protected routes. Every request succeeds regardless of cookies.
Flowise 3.0 returns 401 for all non-public endpoints without a valid session.

### Flowise auth rules

**Public** (no auth required):
- `GET /api/v1/ping`
- `GET /api/v1/settings`
- `GET /api/v1/account/basic-auth`
- `POST /api/v1/auth/resolve`
- `POST /api/v1/account/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/prediction/:id` (API key auth, not session)

**Protected** (require session cookie OR API key):
- Everything else

**401 shape**: `{ message: "Invalid or Missing token" }`

### Implementation plan

#### 2.1 Create auth middleware (`src/middleware/auth.ts`)

```ts
import { getSessionUserId, parseCookie, SESSION_COOKIE } from '../services/authService.js'

const PUBLIC_ROUTES = new Set([
  'GET /api/v1/ping',
  'GET /api/v1/settings',
  'GET /api/v1/account/basic-auth',
  'POST /api/v1/auth/resolve',
  'POST /api/v1/account/register',
  'POST /api/v1/auth/login',
])

// Prefixes that use API key auth instead of session
const API_KEY_PREFIXES = [
  'POST /api/v1/prediction/',
]

export function isPublicRoute(method: string, url: string): boolean {
  const key = `${method} ${url.split('?')[0]}`
  if (PUBLIC_ROUTES.has(key)) return true
  return API_KEY_PREFIXES.some(p => key.startsWith(p))
}

export function getAuthenticatedUserId(cookieHeader: string | undefined): string | undefined {
  const token = parseCookie(cookieHeader, SESSION_COOKIE)
  if (!token) return undefined
  return getSessionUserId(token)
}
```

#### 2.2 Register as `onRequest` hook in `server.ts`

```ts
app.addHook('onRequest', async (request, reply) => {
  if (isPublicRoute(request.method, request.url)) return

  const userId = getAuthenticatedUserId(request.headers.cookie)
  if (!userId) {
    reply.status(401).send({ message: 'Invalid or Missing token' })
    return
  }
  // Attach to request for downstream use
  request.userId = userId
})
```

#### 2.3 Update `auth-setup.ts`

Remove the `if (testConfig.targetName !== 'reimpl')` guard — login against both targets.

#### 2.4 Handle `x-request-from: internal`

Flowise uses this header to distinguish UI requests from external API calls.
The `internal-prediction` endpoint checks for this header. Add check in middleware:
- If `x-request-from: internal` → validate session cookie
- If not → validate API key (for prediction endpoints)

#### 2.5 Update 401 response shape

Flowise returns `{ message: "Invalid or Missing token" }` (no `statusCode`, no `success`).
Match this exact shape.

### Tasks

- [ ] 2.1 Create `src/middleware/auth.ts` with public route list
- [ ] 2.2 Add `onRequest` hook in `server.ts`
- [ ] 2.3 Remove reimpl guard from `auth-setup.ts` — login to reimpl too
- [ ] 2.4 Add auth unit tests (public routes pass, protected routes 401)
- [ ] 2.5 Update compat tests if any assert on auth-free behavior
- [ ] 2.6 Run all tests

---

## 3. Implement Stubbed Endpoints

These endpoints return hardcoded static data. Implement real logic.

### 3.1 `POST /api/v1/export-import/import` — Actually import entities

**Currently**: Accepts body, returns `{ message: "Import completed" }`, does nothing.

**Should**: Parse the export JSON (same shape as export response), insert entities into stores:
- `ChatFlow` → `createChatflow()` for each
- `Tool` → `createTool()` for each
- `Variable` → `createVariable()` for each
- `DocumentStore` → `createDocumentStore()` for each
- `AssistantCustom` → `createAssistant()` for each

Skip: `ChatMessage`, `ChatMessageFeedback`, `Execution`, `DocumentStoreFileChunk` (no stores yet).

**Tasks**:
- [ ] 3.1.1 Parse import body, call create functions for each entity type
- [ ] 3.1.2 Handle ID conflicts (skip existing or overwrite — check Flowise behavior)
- [ ] 3.1.3 Add compat test: export → import → verify entities exist
- [ ] 3.1.4 Return proper response shape (check what Flowise returns)

### 3.2 `GET /api/v1/chatflows-streaming/:id` — Check if flow supports streaming

**Currently**: Returns `{ isStreaming: false }` for all valid flows.

**Should**: Parse `flowData`, find ending node, check if its node type supports streaming
(e.g., LLM/chain nodes support streaming, tool nodes don't).

**Tasks**:
- [ ] 3.2.1 Add `supportsStreaming` flag to node registry entries
- [ ] 3.2.2 Look up ending node type in registry, return `{ isStreaming: supportsStreaming }`
- [ ] 3.2.3 Add unit test with a streaming-capable flow and a non-streaming flow
- [ ] 3.2.4 Add compat test (create chatflow with ConversationChain → expect `isStreaming: true`)

### 3.3 `GET /api/v1/chatflows-uploads/:id` — Check upload capabilities

**Currently**: Returns all-false upload config.

**Should**: Parse `flowData`, check if any node has `speechToText`, image upload, or file
upload capabilities. Inspect node `inputs` for `speechToText`, `allowImageUploads`, etc.

**Tasks**:
- [ ] 3.3.1 Define which nodes enable which upload types (from flowise-components)
- [ ] 3.3.2 Parse flowData, scan nodes, build upload config
- [ ] 3.3.3 Add unit test

### 3.4 `GET /api/v1/auth/permissions/:name` — Real permission checks

**Currently**: Always returns `{ authorized: true }`.

**Should**: Check if the logged-in user has the named permission. For single-tenant open-source
mode, all permissions are granted. This is already correct for our use case — keep as-is
but add a comment that multi-tenant would need real RBAC.

**Status**: ✅ Already correct for single-tenant. No change needed.

### 3.5 `GET /api/v1/internal-chatmessage/:id` — Chat message history

**Currently**: Returns `[]`.

**Should**: Return chat messages for the given chatflow ID. Requires a chat message store.

**Tasks**:
- [ ] 3.5.1 Create `src/storage/chatMessageStore.ts` — in-memory store
- [ ] 3.5.2 Save messages during prediction (in `predictionService.ts`)
- [ ] 3.5.3 Return saved messages from the endpoint
- [ ] 3.5.4 Support `?feedback=true` query param (Flowise filters by feedback status)
- [ ] 3.5.5 Add unit test

### 3.6 `GET /api/v1/upsert-history/:id` — Document store upsert history

**Currently**: Returns `[]`.

**Should**: Track upsert operations on document stores and return history. Requires upsert
history store. Lower priority — document processing isn't implemented.

**Tasks**:
- [ ] 3.6.1 Create upsert history store
- [ ] 3.6.2 Record upserts when document store operations happen
- [ ] 3.6.3 Return history from endpoint

### 3.7 `GET /api/v1/executions` — Execution history

**Currently**: Returns `[]` (or `{ data: [], total: 0 }` with pagination).

**Should**: Track flow executions and return history. Requires execution store.

**Tasks**:
- [ ] 3.7.1 Create `src/storage/executionStore.ts` — in-memory store
- [ ] 3.7.2 Record executions during prediction (start time, end time, status, chatflow ID)
- [ ] 3.7.3 Return paginated execution list
- [ ] 3.7.4 Add compat test: run prediction → check executions list has entry

### 3.8 `GET /api/v1/components-credentials-icon/:name` — Credential icons

**Currently**: Always returns 404.

**Should**: Serve placeholder SVG (same approach as node icons). Or serve real icons if we
ship flowise-components assets.

**Tasks**:
- [ ] 3.8.1 Apply same placeholder SVG pattern as node-icon endpoint
- [ ] 3.8.2 Update compat test to verify 200 for known credential types

### 3.9 `GET /api/v1/marketplaces/custom` — Custom templates

**Currently**: Returns `[]`.

**Should**: Return user-created templates. Requires a template store.

**Tasks**:
- [ ] 3.9.1 Create `src/storage/templateStore.ts`
- [ ] 3.9.2 Add CRUD endpoints for custom templates
- [ ] 3.9.3 Return from `marketplaces/custom`

### 3.10 `GET /api/v1/chatflows/has-changed/:id` — Change detection

**Currently**: Returns `{ hasChanged: false }`.

**Should**: Track last-saved state vs. current state. Flowise uses a
`lastSavedFlowDataHash` comparison. Implementing this requires hashing flowData
on save and comparing on check.

**Tasks**:
- [ ] 3.10.1 Hash flowData on chatflow create/update, store hash
- [ ] 3.10.2 Compare current hash on `has-changed` request
- [ ] 3.10.3 Add unit test

---

## Priority Order

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| 1 | **2. Auth middleware** | High — behavioral parity for all endpoints | Medium |
| 2 | **1. Remove hasLLM** | Medium — simplifies test infrastructure | Low |
| 3 | **3.1 Import** | Medium — export/import round-trip | Medium |
| 4 | **3.5 Chat messages** | Medium — chat history in UI | Medium |
| 5 | **3.7 Executions** | Medium — execution history in UI | Medium |
| 6 | **3.2 Streaming check** | Low — UI streaming toggle | Low |
| 7 | **3.8 Credential icons** | Low — visual only | Low |
| 8 | **3.3 Upload capabilities** | Low — upload UI toggles | Low |
| 9 | **3.10 Change detection** | Low — unsaved changes warning | Low |
| 10 | **3.9 Custom templates** | Low — template marketplace | Low |
| 11 | **3.6 Upsert history** | Low — document store history | Low |
