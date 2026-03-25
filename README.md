# FlowForge

Flowise-compatible backend reimplementation with a comprehensive compatibility test harness.

335 unit tests, 95 compat tests. 3 real node implementations (ChatDeepseek,
BufferMemory, ConversationChain) out of 301 node definitions.

## Project Structure

```
flowforge/
  e2e-reimpl.sh        — Run e2e tests against reimplementation (starts/stops dev server)
  e2e-official.sh      — Run e2e tests against official Flowise (starts/stops container)
  apps/
    server/              — Flowise-compatible Fastify server
      src/
        middleware/       — Auth enforcement (session cookie validation)
        routes/          — 16 route modules (chatflows, predictions, datasets, evaluations, …)
        services/        — Business logic (NodesPool, flowRunner, evaluationRunner, …)
          nodes/         — Node implementations (chatDeepseek, bufferMemory, conversationChain)
        storage/         — 11 in-memory stores (chatflows, credentials, datasets, …)
        sse/             — SSE streaming writer
        types/           — Shared TypeScript types
        utils/           — Encryption, sanitization, pagination
      data/              — Static data files
        nodes.json                   — 301 node definitions
        models.json                  — LLM model/region lists (from Flowise)
        components-credentials.json  — 109 credential definitions
        marketplace-templates.json   — 64 marketplace templates
      tests/             — 29 test files (335 unit + integration tests)
    compat-tests/        — Black-box compatibility test suite (95 tests)
  packages/
    test-utils/          — Shared HTTP client, SSE parser, golden recorder
  compose/
    docker-compose.yml         — Server-only (build & run on :4000)
    docker-compose.dev-ui.yml  — Flowise UI via Caddy (:8080) + local dev server
    docker-compose.flowise.yml — Official Flowise on :3001
    docker-compose.record.yml  — Flowise + Caddy recording proxy
```

## Server Architecture

### Services

| Service | Purpose |
|---------|---------|
| `nodesPool` | Unified node registry — metadata + init functions + load methods in one place |
| `flowRunner` | Graph parser + executor — topological sort, credential resolution, node init |
| `flowValidation` | Pre-execution validation — connectivity, required inputs, credential checks |
| `predictionService` | Prediction orchestration — real flow execution or stub fallback |
| `evaluationRunner` | Dataset-driven evaluation — 3 comparison strategies (exact, contains, regex) |
| `modelLoader` | Reads `models.json` — provides model/region lists for node load methods |
| `httpSecurity` | SSRF protection — IP deny list, DNS resolution checks, `secureFetch()` |
| `secureZodParser` | Safe Zod schema parsing from untrusted strings (whitelist approach, no eval) |
| `authService` | Session management — register, login, logout, cookie-based sessions |
| `credentialService` | AES-encrypted credential storage and retrieval |

### Storage (all in-memory)

`inMemoryStore` (chatflows), `credentialStore`, `apiKeyStore`, `variableStore`,
`toolStore`, `assistantStore`, `documentStoreStore`, `userStore`,
`customTemplateStore`, `datasetStore`, `evaluationStore`

### Middleware

- **Auth** (`middleware/auth.ts`) — `onRequest` hook enforcing session cookies on
  protected routes. Public routes (ping, login, register) bypass auth.

### Node Implementations

3 of 301 nodes have real `init` functions:

| Node | LangChain class | Description |
|------|----------------|-------------|
| `chatDeepseek` | `ChatOpenAI` (baseURL override) | Deepseek chat model |
| `bufferMemory` | `BufferMemory` | Conversation memory |
| `conversationChain` | `ConversationChain` | Basic LLM chain with memory |

Remaining 298 nodes have metadata only (served via `GET /nodes`) — predictions
fall back to stub responses.

## Prerequisites

- Node.js >= 22
- pnpm (corepack-managed via `packageManager` field)

## Install

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Development

```bash
cd apps/server
pnpm dev
```

Uses `bun --watch` with auto-reload on source changes.

## Run Server Locally

```bash
cd apps/server
node dist/main.js
```

Or via Docker Compose:

```bash
pnpm compose:up
```

Server listens on port 4000 (mapped from container port 3000).

## Run with Flowise UI (dev mode)

Start the local dev server, then bring up the UI:

```bash
cd apps/server && pnpm dev          # Starts bun on :3000
pnpm compose:up:dev-ui              # Caddy serves Flowise UI on :8080, proxies API to :3000
pnpm compose:down:dev-ui            # Stop UI containers
```

Opens the original Flowise UI at `http://localhost:8080`, backed by the local FlowForge dev server.

## Run Flowise (for recording/comparison)

```bash
pnpm compose:flowise:up    # Start Flowise on :3001
pnpm compose:flowise:down  # Stop Flowise
```

## Run E2E Tests

One-liner scripts that start the target, run compat tests, and clean up:

```bash
bash e2e-reimpl.sh          # Starts dev server on :3000, runs 95 tests, stops server
bash e2e-official.sh        # Starts Flowise container on :3001, runs tests, stops container
```

Both scripts detect an already-running target and skip start/stop.

### Manual approach

```bash
# Reimplementation
cd apps/server && pnpm dev   # Start dev server on :3000
cd apps/compat-tests
pnpm test:reimpl             # BASE_URL=http://localhost:3000/api/v1

# Official Flowise
pnpm compose:flowise:up      # Start Flowise on :3001
cd apps/compat-tests
pnpm test:official            # BASE_URL=http://localhost:3001/api/v1
```

### Record goldens

Run tests against official Flowise with recording enabled:

```bash
cd apps/compat-tests
pnpm test:record
```

This stores normalized responses in `apps/compat-tests/goldens/official/`.

## Test Architecture

### Three layers

1. **HTTP Contract Tests** — Direct API calls validating status codes, headers, JSON schemas, error structures
2. **Golden Baseline Tests** — Record official Flowise responses, compare reimplementation against them
3. **Client Integration Tests** — Smoke tests using real client payload format (flowise-embed)

### Black-box rule

Tests communicate with the server **only via HTTP**. No imports from server code, no database access, no internal function calls. The same tests run against both official Flowise and our reimplementation.

### Test files

```
tests/api/
  01_ping.test.ts                  — Connectivity
  02_chatflows_crud.test.ts        — Chatflows CRUD
  03_credentials_crud.test.ts      — Credentials CRUD
  03_prediction_nonstream.test.ts  — Non-streaming prediction
  04_prediction_stream_sse.test.ts — SSE streaming
  05_prediction_errors.test.ts     — Error cases
  06_attachments_upload.test.ts    — File uploads
  07_auth_headers.test.ts          — Auth & headers
  08_concurrency.test.ts           — Parallel requests
  09_regression_quirks.test.ts     — Edge cases & quirks
  10_boot_endpoints.test.ts        — Boot / config endpoints
  11_variables_apikeys.test.ts     — Variables & API keys CRUD
  12_tools_assistants.test.ts      — Tools & assistants CRUD
  13_documentstore_marketplace.test.ts — Document store & marketplace

tests/integration/
  01_flowise_embed_smoke.test.ts   — Client integration smoke
  02_e2e_prediction.test.ts        — E2E prediction with Deepseek
```

## Environment Variables

### Server (`apps/server`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listen port | `3000` |
| `HOST` | Server bind address | `0.0.0.0` |
| `LOG_LEVEL` | Pino log level (`debug`, `info`, `warn`, `error`) | `info` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `*` |
| `RATE_LIMIT_MAX` | Max requests per minute per IP (0 = disabled) | `0` |
| `BODY_LIMIT` | Max request body size in bytes | `2097152` (2 MB) |
| `STUB_TOKEN_DELAY_MS` | Delay between SSE tokens in streaming mode | `50` |
| `MAX_CHATFLOWS` | Max chatflows in memory (LRU eviction) | `10000` |
| `FLOWISE_SECRETKEY_OVERWRITE` | Fixed AES key for credential encryption (omit for random key) | — |
| `TOOL_FUNCTION_DENY_LIST` | Comma-separated hostnames/IPs blocked by `secureFetch` (SSRF protection) | — |

### Tests (`apps/compat-tests`)

| Variable | Description | Default |
|---|---|---|
| `BASE_URL` | Server API base URL | — (required) |
| `AUTH_TOKEN` | Bearer token for auth | — (optional) |
| `TARGET_NAME` | `official` or `reimpl` | `reimpl` |
| `RECORD_GOLDENS` | Set to `1` to record golden baselines | `0` |
| `HAS_LLM` | Set to `1` if target has real LLM nodes | auto for reimpl |
| `DEEPSEEK_API_KEY` | Deepseek API key for E2E prediction tests | — (optional) |

## Adding New Compatibility Tests

1. Create a new test file in `apps/compat-tests/tests/api/`
2. Import the shared client from `../../src/setup.js`
3. Use `client.get()`, `client.post()`, etc. — HTTP only
4. Use Zod schemas from `../../src/schemas.js` for response validation
5. Call `recorder.record()` when `shouldRecord()` is true
6. The test must pass against both targets

## Test-First Workflow

1. Write tests describing expected Flowise API behavior
2. Run tests against official Flowise (`pnpm test:official`)
3. Record goldens (`pnpm test:record`)
4. Implement in `apps/server`
5. Run tests against reimplementation (`pnpm test:reimpl`)
6. Fix server until all tests pass

## Docker Compose

```bash
pnpm compose:up            # Start server on :4000
pnpm compose:down          # Stop server
pnpm compose:restart       # Restart server
pnpm compose:reset         # Stop + remove volumes
pnpm compose:up:dev-ui     # Flowise UI on :8080 (needs local dev server on :3000)
pnpm compose:down:dev-ui   # Stop UI containers
pnpm compose:flowise:up    # Official Flowise on :3001
pnpm compose:flowise:down  # Stop Flowise
pnpm compose:record:up     # Flowise + recording proxy
pnpm compose:record:down   # Stop recording stack
```

## Unit Tests

Run unit tests for all packages and apps:

```bash
pnpm vitest run
```

## Quality Checks

```bash
bash check.sh          # Format, lint, typecheck, unit tests
bash health.sh         # Gitleaks, renovate, pnpm audit
bash all-checks.sh     # Both (runs as pre-commit hook)
```

## CI

GitHub Actions runs on every push/PR:
- **check** — lint, typecheck, unit tests
- **compat** — build & run compat tests against reimplementation
- **docker** — build Docker image
