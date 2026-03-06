# FlowForge

Flowise-compatible backend reimplementation with a comprehensive compatibility test harness.

## Project Structure

```
flowforge/
  apps/
    server/            — Flowise-compatible Fastify server
    compat-tests/      — Black-box compatibility test suite
  packages/
    test-utils/        — Shared HTTP client, SSE parser, golden recorder
  compose/             — Docker Compose for running the server
```

## Prerequisites

- Node.js >= 22
- pnpm 10.30.0 (corepack-managed via `packageManager` field)

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

Uses `tsx watch` with auto-reload on source changes.

## Run Server Locally

```bash
cd apps/server
node dist/server.js
```

Or via Docker Compose:

```bash
pnpm compose:up
```

Server listens on port 4000 (mapped from container port 3000).

## Run Flowise (for recording/comparison)

```bash
pnpm compose:flowise:up    # Start Flowise on port 3001
pnpm compose:flowise:down  # Stop Flowise
```

## Run Tests

### Against our reimplementation

Start the server first, then run:

```bash
BASE_URL=http://localhost:4000/api/v1 TARGET_NAME=reimpl pnpm test
```

Or using the compat-tests scripts:

```bash
cd apps/compat-tests
pnpm test:reimpl
```

### Against official Flowise

Start official Flowise on port 3000, then:

```bash
cd apps/compat-tests
pnpm test:official
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
  01_ping.test.ts              — Connectivity
  02_chatflows_crud.test.ts    — Chatflows CRUD
  03_prediction_nonstream.test.ts  — Non-streaming prediction
  04_prediction_stream_sse.test.ts — SSE streaming
  05_prediction_errors.test.ts     — Error cases
  06_attachments_upload.test.ts    — File uploads
  07_auth_headers.test.ts          — Auth & headers
  08_concurrency.test.ts           — Parallel requests
  09_regression_quirks.test.ts     — Edge cases & quirks

tests/integration/
  01_flowise_embed_smoke.test.ts   — Client integration smoke
```

## Environment Variables

### Server (`apps/server`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listen port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `*` |
| `STUB_TOKEN_DELAY_MS` | Delay between SSE tokens in streaming mode | `50` |

### Tests (`apps/compat-tests`)

| Variable | Description | Default |
|---|---|---|
| `BASE_URL` | Server API base URL | — (required) |
| `AUTH_TOKEN` | Bearer token for auth | — (optional) |
| `TARGET_NAME` | `official` or `reimpl` | `reimpl` |
| `RECORD_GOLDENS` | Set to `1` to record golden baselines | `0` |
| `HAS_LLM` | Set to `1` if target has real LLM nodes | auto for reimpl |

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
pnpm compose:up        # Start
pnpm compose:down      # Stop
pnpm compose:restart   # Restart
pnpm compose:reset     # Stop + remove volumes
```

## Unit Tests

Run unit tests for shared packages (normalize, SSE parser, concurrency, retry):

```bash
pnpm vitest run
```

## CI

GitHub Actions runs on every push/PR:
- **check** — lint, typecheck, unit tests
- **compat** — build & run compat tests against reimplementation
- **docker** — build Docker image
