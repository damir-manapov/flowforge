# FlowForge

Flowise-compatible backend reimplementation with a comprehensive compatibility test harness.

## Project Structure

```
flowforge/
  apps/
    server/            — Flowise-compatible Fastify server
    compat-tests/      — Black-box compatibility test suite
  packages/
    test-utils/        — Shared HTTP client, SSE parser, Flowise event parser, golden recorder
  compose/
    docker-compose.yml         — Server-only (build & run on :4000)
    docker-compose.dev-ui.yml  — Flowise UI via Caddy (:8080) + local dev server
    docker-compose.flowise.yml — Official Flowise on :3001
    docker-compose.record.yml  — Flowise + Caddy recording proxy
```

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

## Run Tests

### Against our reimplementation

Start the dev server (`pnpm dev` in `apps/server`), then:

```bash
cd apps/compat-tests
pnpm test:reimpl            # BASE_URL=http://localhost:3000/api/v1
```

### Against official Flowise

Start official Flowise (`pnpm compose:flowise:up`), then:

```bash
cd apps/compat-tests
pnpm test:official           # BASE_URL=http://localhost:3001/api/v1
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
