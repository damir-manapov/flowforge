# FlowForge Implementation Plan

API endpoints discovered via mitmproxy traffic recording against Flowise UI.
Steps 1–7 were built against Flowise 1.8.4. Steps 8–11 cover breaking changes
and new functionality introduced in **Flowise 3.0** (captured from 3.0.13).

**Scope**: ~65 endpoints across 12 steps. Steps 1–7 done (except Step 5). Step 5a in progress. Steps 8–11 not started.

Each step follows the same cycle:

1. **Stub** — return `[]` or static data so the UI doesn't break
2. **Tests** — write compat tests for the endpoint contract
3. **Verify against Flowise** — run tests against the original backend to confirm they pass
4. **Implement** — build the real handler in FlowForge
5. **Verify against FlowForge** — run the same tests against our backend until green

Step 1 only executes cycle steps 1–3 (stub + tests + verify on Flowise). Later steps upgrade those stubs to real implementations (cycle steps 4–5).

Existing test scripts (in `apps/compat-tests/package.json`):

- `pnpm test:official` — runs against Flowise on `localhost:3001`
- `pnpm test:reimpl` — runs against FlowForge on `localhost:3000`
- `pnpm test:record` — records golden snapshots from Flowise

All tests are HTTP-only (no internal imports). Same test suite runs against both backends.

## Status Legend

- ✅ Done
- 🚧 Stub only (returns `[]` or static data, no persistence)
- 🔲 Not started

---

## Step 1: Boot Stubs (UI loads without errors)

Return `[]` / static data for every boot-time endpoint. No persistence, no business logic.

| Status | Endpoint | Stub Response |
|---|---|---|
| ✅ | `GET /api/v1/ping` | `"pong"` |
| ✅ | `GET /api/v1/chatflows` | real impl |
| 🚧 | `GET /api/v1/nodes` | static JSON (extracted from Flowise 1.8.4) |
| 🚧 | `GET /api/v1/node-icon/:name` | 404 (icons not served yet) |
| ✅ | `GET /api/v1/credentials` | Full CRUD (Step 3) |
| ✅ | `GET /api/v1/components-credentials` | Static catalog (Step 3) |
| ✅ | `GET /api/v1/apikey` | Full CRUD (Step 4) |
| ✅ | `GET /api/v1/tools` | Full CRUD (Step 6) |
| ✅ | `GET /api/v1/assistants` | Full CRUD (Step 6) |
| ✅ | `GET /api/v1/variables` | Full CRUD (Step 4) |
| ✅ | `GET /api/v1/document-store/stores` | Full CRUD (Step 7) |
| ✅ | `GET /api/v1/marketplaces/templates` | 55 static templates (Step 7) |

**Goal**: UI loads fully, no console errors, flow editor palette populated.

---

## Step 2: Chatflow CRUD

Full persistence for chatflows — create, update, delete.

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/chatflows` | Already implemented |
| ✅ | `GET /api/v1/chatflows/:id` | Already implemented |
| ✅ | `POST /api/v1/chatflows` | Already implemented |
| ✅ | `PUT /api/v1/chatflows/:id` | Already implemented |
| ✅ | `DELETE /api/v1/chatflows/:id` | Already implemented |
| 🚧 | `GET /api/v1/chatflows-streaming/:id` | Stub: always returns `{ isStreaming: false }` |
| � | `GET /api/v1/chatflows-uploads/:id` | Stub: upload config (see below) |

### chatflows-streaming (3.0 observation)

In 3.0, `chatflows-streaming` returns real values derived from the flow: `{ isStreaming: true }`
when a streaming-capable chain is present. Our stub always returns `false`.

### chatflows-uploads (new in 3.0)

```json
{
  "isSpeechToTextEnabled": false,
  "isImageUploadAllowed": false,
  "isRAGFileUploadAllowed": false,
  "imgUploadSizeAndTypes": [],
  "fileUploadSizeAndTypes": []
}
```

Determines what the chat panel's input area shows (mic button, file attach button, etc.).

**Goal**: Create, edit, save, delete flows via the UI.

---

## Step 3: Credentials CRUD

Full persistence for credentials with encryption.

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/credentials` | List with encryption |
| ✅ | `POST /api/v1/credentials` | Create with AES encryption |
| ✅ | `PUT /api/v1/credentials/:id` | Update |
| ✅ | `DELETE /api/v1/credentials/:id` | Delete (Flowise DeleteResult shape) |
| ✅ | `GET /api/v1/components-credentials` | Static JSON catalog (63 types from Flowise 1.8.4) |
| ✅ | `GET /api/v1/components-credentials/:name` | Single credential type lookup |
| 🚧 | `GET /api/v1/components-credentials-icon/:name` | 404 (icons not served yet) |

**Goal**: Configure API keys and service connections for nodes.

---

## Step 4: Variables & API Keys

Full CRUD for environment variables and API key management.

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/variables` | List (no encryption, plain values) |
| ✅ | `POST /api/v1/variables` | Create |
| ✅ | `PUT /api/v1/variables/:id` | Update |
| ✅ | `DELETE /api/v1/variables/:id` | Delete (Flowise DeleteResult shape) |
| ✅ | `GET /api/v1/apikey` | List (full array with apiKey/apiSecret) |
| ✅ | `POST /api/v1/apikey` | Create (returns full array) |
| ✅ | `PUT /api/v1/apikey/:id` | Rename only |
| ✅ | `DELETE /api/v1/apikey/:id` | Delete (returns remaining keys) |

**Goal**: Manage variables and API keys used in chatflow execution.

---

## Step 5: Node Catalog (real)

Replace static JSON stub with dynamic node catalog built from flowise-components. Hardest step — ~370KB response, icon serving, dynamic option loading.

| Status | Endpoint | Notes |
|---|---|---|
| 🔲 | `GET /api/v1/nodes` | Build catalog from flowise-components at startup |
| 🔲 | `GET /api/v1/node-icon/:name` | Serve icons from flowise-components package |
| 🔲 | `POST /api/v1/node-load-method/:name` | Dynamic options (e.g., list models from OpenAI) |

**Goal**: Node palette reflects actually available components, dynamic dropdowns work.

---

## Step 6: Tools & Assistants

Full CRUD for custom tools and assistants.

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/tools` | List |
| ✅ | `POST /api/v1/tools` | Create |
| ✅ | `PUT /api/v1/tools/:id` | Update (merge semantics) |
| ✅ | `DELETE /api/v1/tools/:id` | Delete (DeleteResult shape) |
| ✅ | `GET /api/v1/assistants` | List |
| ✅ | `POST /api/v1/assistants` | Create (local persistence, no OpenAI call) |
| ✅ | `PUT /api/v1/assistants/:id` | Update (local only) |
| ✅ | `DELETE /api/v1/assistants/:id` | Delete (local only) |

**Goal**: Full tool and assistant management through the UI.

---

## Step 7: Document Store & Marketplace

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/document-store/stores` | List with parsed arrays + totals |
| ✅ | `GET /api/v1/document-store/store/:id` | Get by ID with totals |
| ✅ | `POST /api/v1/document-store/store` | Create |
| ✅ | `PUT /api/v1/document-store/store/:id` | Update |
| ✅ | `DELETE /api/v1/document-store/store/:id` | Delete |
| ✅ | `GET /api/v1/upsert-history/:id` | Stub returning `[]` |
| ✅ | `GET /api/v1/marketplaces/templates` | 55 static templates from Flowise |

**Goal**: Document ingestion and template marketplace functional.

---

## Prediction & Chat (already done / partially done)

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `POST /api/v1/prediction/:id` | JSON + SSE streaming (public/API-key access) |
| ✅ | `POST /api/v1/attachments/:chatflowId/:chatId` | File uploads |
| � | `POST /api/v1/internal-prediction/:id` | Same handler as prediction (Flowise 3.0 UI) |
| 🚧 | `GET /api/v1/internal-chatmessage/:id?feedback=true` | Stub: returns `[]` |

### internal-prediction vs prediction

Flowise 3.0 UI uses `internal-prediction` (not `prediction`) for the built-in chat panel.
Both use SSE streaming with the same event format: `start` → `token`* → `metadata` → `end`.

### SSE error events (missing credentials)

When a chatflow has nodes without credentials configured, the prediction still returns
HTTP 200 with `text/event-stream`, but sends an error event instead of tokens:

```
data:{"event":"error","data":"Missing credentials. Please pass an `apiKey`..."}
data:{"event":"end","data":"[DONE]"}
```

Tests should cover this error-in-SSE case.

---

## Step 5a: Flow Execution — Real LLM Predictions

Replace stub prediction responses with actual LLM execution. Walk the flowData graph,
instantiate LangChain components, and run the chain. Start with the 3 node types in
the Deepseek E2E fixture, then expand.

### Why LangChain?

Flowise's node system is built on LangChain. The ChatDeepseek node is literally
`new ChatOpenAI({...})` from `@langchain/openai` with `baseURL: 'https://api.deepseek.com'`.
ConversationChain and BufferMemory are also LangChain classes. Using raw `fetch()` would
mean reimplementing memory, chains, agents, and retrieval from scratch — not practical
for Flowise compatibility.

### Dependencies to add

| Package | Why |
|---|---|
| `@langchain/openai` | `ChatOpenAI` — what ChatDeepseek (and ChatOpenAI, Azure, etc.) use |
| `@langchain/core` | Base types: messages, runnables, callbacks, streaming |
| `langchain` | `ConversationChain`, `BufferMemory`, and other chain types |

### Architecture

```
flowData JSON ──► flowRunner.ts ──► LangChain objects ──► streaming response
                   │                                         │
                   ├─ parse graph (nodes + edges)            ├─ SSE: start → token* → metadata → end
                   ├─ topological sort                       └─ error → end (on failure)
                   ├─ resolve credentials (decrypt)
                   └─ instantiate LangChain components
```

### Node types to support (Phase 1 — Deepseek fixture)

| Status | Node Type | LangChain Class | Notes |
|---|---|---|---|
| ✅ | `chatDeepseek` | `ChatOpenAI` | `baseURL: 'https://api.deepseek.com'`, model from `inputs.modelName` |
| ✅ | `bufferMemory` | `BufferMemory` | Session-scoped conversation memory |
| ✅ | `conversationChain` | `ConversationChain` | Chains LLM + memory, runs `chain.call({ input })` |

### Node types to support (Phase 2 — common chat models)

| Status | Node Type | LangChain Class | Notes |
|---|---|---|---|
| 🔲 | `chatOpenAI` | `ChatOpenAI` | `baseURL: 'https://api.openai.com/v1'` |
| 🔲 | `chatAnthropic` | `ChatAnthropic` | Requires `@langchain/anthropic` |
| 🔲 | `llmChain` | `LLMChain` | Generic LLM chain with prompt template |
| 🔲 | `promptTemplate` | `PromptTemplate` | User-defined prompt templates |

### Implementation files

| File | Purpose |
|---|---|
| `src/services/flowRunner.ts` | Parse flowData graph, topological sort, instantiate nodes |
| `src/services/nodeRegistry.ts` | Map of `nodeType → init(nodeData, credential) → LangChain object` |
| `src/services/nodes/chatDeepseek.ts` | Init function for ChatDeepseek |
| `src/services/nodes/bufferMemory.ts` | Init function for BufferMemory |
| `src/services/nodes/conversationChain.ts` | Init function for ConversationChain |

### Flow execution pipeline

1. Parse `flowData` JSON → extract `nodes[]` and `edges[]`
2. Topological sort nodes by edges (upstream → downstream)
3. For each node in order:
   a. Resolve credential (if `node.data.credential` set) → decrypt API key
   b. Call `nodeRegistry[node.data.type].init(nodeData, credentialData)` → LangChain object
   c. Wire upstream outputs as inputs (via edge connections)
4. Find the terminal node (the chain/agent) and call it with the user's question
5. Stream tokens via LangChain callbacks → SSE events

### Tests

| Test | Level | What it validates |
|---|---|---|
| `flowRunner.test.ts` — graph parsing | Unit | `parseFlowData()` extracts nodes, edges, topological order |
| `flowRunner.test.ts` — credential resolution | Unit | Node credential ID → decrypted API key |
| `nodeRegistry.test.ts` — chatDeepseek | Unit | Correct `ChatOpenAI` config: model, temp, baseURL, apiKey |
| `nodeRegistry.test.ts` — conversationChain | Unit | Chain wired with LLM + memory |
| `streamPrediction.test.ts` — real model (mocked) | Unit | LangChain streaming → SSE events |
| `02_e2e_prediction.test.ts` | E2E | Full pipeline with real Deepseek API (already exists) |

### Stub fallback

When flowData has no recognized model node (e.g., empty `{"nodes":[],"edges":[]}`),
`streamPrediction` continues to return stub tokens. This keeps existing tests passing.

**Goal**: `POST /api/v1/prediction/:id` with a Deepseek chatflow returns real LLM answers.

---

## Step 8: Authentication & User Management (Flowise 3.0)

Flowise 3.0 requires authentication by default. All API calls return 401 without a valid
session cookie. The auth flow is: register → login → cookie-based session.

### Auth Flow

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/settings` | Returns `{ PLATFORM_TYPE: "open source" }` — public, no auth needed |
| ✅ | `GET /api/v1/account/basic-auth` | Returns `{ status: false }` — checks if basic-auth mode |
| ✅ | `POST /api/v1/auth/resolve` | Body `{}` → `{ redirectUrl }` — see resolve logic below |
| ✅ | `POST /api/v1/account/register` | Nested body (see shape below) → 201 user object |
| ✅ | `POST /api/v1/auth/login` | `{ email, password }` → user with roles/workspaces/permissions + set-cookie |
| ✅ | `POST /api/v1/account/logout` | Clears session → `{ message: "logged_out", redirectTo: "/login" }` |
| ✅ | `GET /api/v1/auth/permissions/:name` | Check feature permission (e.g., `API_KEY`) → `{ authorized: true }` |

### User Profile

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `GET /api/v1/user?id=:id` | Get user profile: `{ id, name, email, status, createdDate, ... }` |
| ✅ | `PUT /api/v1/user` | Update profile `{ id, name, email }` or password `{ id, oldPassword, newPassword, confirmPassword }` |

### Settings response shape

```json
{ "PLATFORM_TYPE": "open source" }
```

This endpoint is public (no auth required) and is the first thing the UI fetches.

### auth/resolve logic

- No user registered yet → `{ redirectUrl: "/organization-setup" }` (first-time setup)
- Not logged in → `{ redirectUrl: "/signin" }`
- Already logged in → `{ redirectUrl: "/chatflows" }`

### Register request shape

The register body wraps in a `user` object with `credential` instead of `password`:

```json
{
  "user": {
    "name": "Admin",
    "email": "admin@gmail.com",
    "type": "pro",
    "credential": "Admin123_"
  }
}
```

Response (201):
```json
{
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@gmail.com",
    "status": "active",
    "createdBy": "uuid",
    "updatedBy": "uuid",
    "createdDate": "...",
    "updatedDate": "..."
  }
}
```

### Login response shape

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User",
  "roleId": "uuid",
  "activeOrganizationId": "uuid",
  "activeWorkspaceId": "uuid",
  "activeWorkspace": "Default Workspace",
  "assignedWorkspaces": [{ "id": "uuid", "name": "Default Workspace", "role": "owner", "organizationId": "uuid" }],
  "permissions": ["organization", "workspace"],
  "features": {},
  "isSSO": false,
  "isOrganizationAdmin": true
}
```

### 401 Unauthorized behavior

Without a valid session, all non-public endpoints return:
```json
{ "message": "Invalid or Missing token" }
```
With HTTP 401. Public endpoints: `GET /settings`, `POST /auth/resolve`, `POST /account/register`,
`POST /auth/login`, `GET /account/basic-auth`.

### Impact on compat tests

All existing compat tests return 401 against Flowise 3.0. The test harness must:
1. Register/login before running tests (or use a shared `beforeAll` setup)
2. Forward the session cookie on every request

**Goal**: Users can register, log in, manage profile. All subsequent API calls require auth.

---

## Step 9: Paginated List Responses (Flowise 3.0)

Flowise 3.0 wraps all list endpoints in `{ data: [...], total: number }` instead of returning
bare arrays. The UI sends `?page=1&limit=12` query parameters.

### Affected endpoints

| Status | Endpoint | 1.8.4 shape → 3.0 shape |
|---|---|---|
| 🔲 | `GET /api/v1/chatflows` | `[...]` → `{ data: [...], total }` |
| 🔲 | `GET /api/v1/tools` | `[...]` → `{ data: [...], total }` |
| 🔲 | `GET /api/v1/variables` | `[...]` → `{ data: [...], total }` |
| 🔲 | `GET /api/v1/apikey` | `[...]` → `{ data: [...], total }` |
| 🔲 | `GET /api/v1/document-store/store` | `[...]` → `{ data: [...], total }` |
| 🔲 | `GET /api/v1/executions` | n/a → `{ data: [...], total }` (new) |
| 🔲 | `GET /api/v1/assistants` | `[...]` → `{ data: [...], total }` |

### Query parameters

All list endpoints accept: `?page=1&limit=12`. Page is 1-indexed. Default limit appears to be 12.

### Chatflow type filter

Chatflows now have a `type` field: `CHATFLOW` or `AGENTFLOW`. The UI queries them separately:
- `GET /api/v1/chatflows?type=CHATFLOW&page=1&limit=12` — chatflows tab
- `GET /api/v1/chatflows?type=AGENTFLOW&page=1&limit=12` — agentflows tab

### workspaceId field

All entities now include a `workspaceId` field (UUID) linking them to the active workspace.
This affects: chatflows, credentials, tools, variables, assistants, document-stores, apikeys.

**Goal**: All list endpoints return paginated `{ data, total }` and support `?page=N&limit=N`.

---

## Step 10: Version, Settings & Export/Import (Flowise 3.0)

New utility endpoints added in Flowise 3.0.

| Status | Endpoint | Notes |
|---|---|---|
| 🔲 | `GET /api/v1/version` | `{ version: "3.0.13" }` |
| 🔲 | `GET /api/v1/settings` | `{ PLATFORM_TYPE: "open source" }` (public, no auth) |
| 🔲 | `POST /api/v1/export-import/export` | Body selects entity types → returns full JSON dump |
| 🔲 | `POST /api/v1/export-import/import` | Imports a previously exported JSON dump |
| 🔲 | `GET /api/v1/executions?page=1&limit=12` | List workflow executions (paginated) |
| 🔲 | `GET /api/v1/marketplaces/custom` | Custom marketplace templates |
| 🔲 | `GET /api/v1/chatflows/has-changed/:id` | Check if chatflow was modified (returns HTML fallback?) |

### Export request body

```json
{
  "agentflow": true,
  "agentflowv2": true,
  "assistantCustom": true,
  "assistantOpenAI": true,
  "assistantAzure": true,
  "chatflow": true,
  "chat_message": true,
  "chat_feedback": true,
  "custom_template": true,
  "document_store": true,
  "execution": true,
  "tool": true,
  "variable": true
}
```

### Export response shape

```json
{
  "FileDefaultName": "ExportData.json",
  "AgentFlow": [],
  "AgentFlowV2": [...],
  "AssistantCustom": [...],
  "AssistantFlow": [...],
  "AssistantOpenAI": [],
  "AssistantAzure": [],
  "ChatFlow": [...],
  "ChatMessage": [],
  "ChatMessageFeedback": [],
  "CustomTemplate": [],
  "DocumentStore": [...],
  "DocumentStoreFileChunk": [],
  "Execution": [],
  "Tool": [],
  "Variable": [...]
}
```

**Goal**: Version reporting, full data export/import, execution history.

---

## Step 11: Assistant Sub-resources & Credential Icons (Flowise 3.0)

New endpoints for assistant configuration and credential icon serving.

### Assistant component sub-resources

| Status | Endpoint | Notes |
|---|---|---|
| 🔲 | `GET /api/v1/assistants?type=CUSTOM` | Filter assistants by type (`CUSTOM`, `OPENAI`, `AZURE`) |
| 🔲 | `GET /api/v1/assistants/components/chatmodels` | List available chat models for assistant config |
| 🔲 | `GET /api/v1/assistants/components/docstores` | List document stores for assistant config |
| 🔲 | `GET /api/v1/assistants/components/tools` | List tools available for assistant config |

### Credential icons (real)

| Status | Endpoint | Notes |
|---|---|---|
| 🔲 | `GET /api/v1/components-credentials-icon/:name` | Serve SVG/PNG icons from flowise-components |

In 3.0, this endpoint serves real icons (was 404 in our 1.8.4 implementation). Some credential
names return 500 in Flowise itself (known bugs: `azureCognitiveServices`, `googleMakerSuite`,
`httpBasicAuth`, `httpBearerToken`, etc.).

### Credential filtering

| Status | Endpoint | Notes |
|---|---|---|
| 🔲 | `GET /api/v1/credentials?credentialName=:name` | Filter credentials by type name |

**Goal**: Assistant creation UI can browse available models/tools/stores. Credential icons display.

---

## Approach Notes

### Static node catalog (Step 1)

Extract from mitmproxy capture, serve as-is. Pin to Flowise 1.8.4 node catalog. Replace with dynamic catalog in Step 5.

### Credential encryption

Flowise uses CryptoJS AES with `FLOWISE_SECRETKEY_OVERWRITE` env var (or auto-generated key). Our implementation matches this scheme for credential portability.

### Flowise 3.0 migration strategy

Steps 8–11 can be implemented in any order, but Step 8 (auth) should come first since all
other endpoints depend on it. Recommended sequence:

1. **Step 8** — Auth + session management (unblocks compat tests against Flowise 3.0)
2. **Step 9** — Pagination wrappers (cross-cutting, touches all existing list handlers)
3. **Step 10** — New utility endpoints (version, settings, export/import)
4. **Step 11** — Assistant sub-resources + credential icons

The pagination change (Step 9) is backward-incompatible: existing tests expect bare arrays.
Options:
- **v3-only**: Update all handlers and tests to the new shape
- **Content negotiation**: Detect `?page=` param — if present, return `{ data, total }`;
  if absent, return bare array for backward compat
- **Version header**: `X-Flowise-Compat: 3` to opt in

### mitmproxy captures

- `session-20260308-084848.jsonl` — 254 requests from Flowise 3.0.13 UI session
  - Covers: auth flow, chatflow CRUD, credential CRUD, assistant CRUD, variable CRUD, apikey CRUD,
    document store CRUD, user profile update, password change, export/import, node icons
- `session-20260308-090959.jsonl` — 713 requests from Flowise 3.0.13 (clean state, full E2E)
  - Covers: register → login → create credential → create chatflow (Deepseek + ConversationChain +
    BufferMemory) → prediction with missing creds (SSE error) → prediction with creds (SSE success)
  - New endpoints observed: `internal-prediction`, `internal-chatmessage`, `chatflows-uploads`,
    `chatflows/has-changed`
  - Confirmed: 566 node-icon + 109 credential-icon requests (all 304 on repeat), 7 credential
    icons return 500 (Flowise bugs)
