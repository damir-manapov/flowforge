# FlowForge Implementation Plan

API endpoints discovered via mitmproxy traffic recording against Flowise 1.8.4 UI.

**Scope**: ~45 endpoints across 7 steps. 7 already done.

Each step follows the same cycle:

1. **Stub** — return `[]` or static data so the UI doesn't break
2. **Tests** — write compat tests for the endpoint contract
3. **Verify against Flowise** — run tests against the original backend to confirm they pass
4. **Implement** — build the real handler in FlowForge
5. **Verify against FlowForge** — run the same tests against our backend until green

Step 1 only executes cycle steps 1–3 (stub + tests + verify on Flowise). Later steps upgrade those stubs to real implementations (cycle steps 4–5).

Existing test scripts (in `apps/compat-tests/package.json`):

- `pnpm test:official` — runs against Flowise on `localhost:3001`
- `pnpm test:reimpl` — runs against FlowForge on `localhost:4000`
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
| � | `GET /api/v1/nodes` | static JSON (extracted from Flowise 1.8.4) |
| 🚧 | `GET /api/v1/node-icon/:name` | 404 (icons not served yet) |
| 🚧 | `GET /api/v1/credentials` | `[]` |
| 🚧 | `GET /api/v1/components-credentials` | `[]` |
| 🚧 | `GET /api/v1/apikey` | `[]` |
| 🚧 | `GET /api/v1/tools` | `[]` |
| 🚧 | `GET /api/v1/assistants` | `[]` |
| 🚧 | `GET /api/v1/variables` | `[]` |
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
| � | `GET /api/v1/chatflows-streaming/:id` | Stub: always returns `{ isStreaming: false }` |

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

## Prediction (already done)

| Status | Endpoint | Notes |
|---|---|---|
| ✅ | `POST /api/v1/prediction/:id` | JSON + SSE streaming |
| ✅ | `POST /api/v1/attachments/:chatflowId/:chatId` | File uploads |

---

## Approach Notes

### Static node catalog (Step 1)

Extract from mitmproxy capture, serve as-is. Pin to Flowise 1.8.4 node catalog. Replace with dynamic catalog in Step 5.

### Credential encryption

Flowise uses AES-256 with `PASSPHRASE` env var. Match the same scheme for credential portability.
