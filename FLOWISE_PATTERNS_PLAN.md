# FlowForge — Flowise Patterns Adoption Plan

Patterns identified from the Flowise 3.0.13 codebase that we should adopt to
improve FlowForge's architecture, security, and feature parity.

---

## Current State

| Area | FlowForge Status | Flowise Reference |
|------|-----------------|-------------------|
| Node metadata | `data/nodes.json` (301 static defs) | `NodesPool` dynamic class loading |
| Node execution | `nodeRegistry.ts` (3 nodes registered) | `nodesPool.componentNodes[name].init()` |
| Node load methods | `nodeLoadMethods.ts` registry + `modelLoader.ts` | `componentNodes[name].loadMethods[method]()` |
| Flow validation | `parseFlowData()` — topology only | Full connectivity + input + credential check |
| Marketplace | `data/marketplace-templates.json` (55 templates), served but read-only | JSON templates + CRUD |
| Credential definitions | `data/components-credentials.json` (63 defs) | 109 `.credential.ts` class files |
| Evaluation | None | `EvaluationRunner` + `EvaluationRunTracer` |
| SSRF protection | None | `httpSecurity.ts` — `isDeniedIP`, `secureFetch` |
| Schema parsing | None | `secureZodParser.ts` — sandboxed user schemas |
| Tests | 251 unit + 95 compat | ~4 test files total |

---

## Phase 1 — Unified Node Architecture (NodesPool)

**Problem:** Node data is split across 3 places — `nodes.json` (metadata),
`nodeRegistry.ts` (execution), `nodeLoadMethods.ts` (load methods). Adding a node
means updating all three.

**Goal:** Single source of truth per node. A unified `NodeDefinition` type that
holds metadata, init function, and load methods together.

### 1.1 Design unified `NodeDefinition` type

```typescript
interface NodeDefinition {
  // Metadata (currently from nodes.json)
  label: string
  name: string
  type: string
  icon: string
  category: string
  version: number
  baseClasses: string[]
  description?: string
  inputs: NodeParam[]
  output?: NodeOutput[]
  credential?: CredentialRef
  tags?: string[]

  // Execution (currently from nodeRegistry.ts)
  init?: (nodeData: NodeData, credentialData?: Record<string, unknown>) => Promise<unknown>
  run?: (nodeData: NodeData, input: string) => Promise<string>

  // Load methods (currently from nodeLoadMethods.ts)
  loadMethods?: Record<string, (nodesData?: unknown[]) => LoadMethodResult>
}
```

### 1.2 Create `NodesPool` service

```
apps/server/src/services/nodesPool.ts
```

- Loads all 301 node definitions from `nodes.json`
- Enriches with `init` functions from node implementations (3 currently)
- Enriches with `loadMethods` from the existing registry
- Single `getNode(name)` accessor
- `getAllNodes()` returns metadata array (for `GET /nodes`)
- `getLoadMethod(nodeName, methodName)` replaces current `resolveLoadMethod()`
- `initNode(name, data, creds)` replaces current `initNode()`

### 1.3 Migrate routes / services to use `NodesPool`

- `routes/nodes.ts` → `nodesPool.getAllNodes()` and `nodesPool.getLoadMethod()`
- `flowRunner.ts` → `nodesPool.initNode()`
- Remove `nodeRegistry.ts`, `nodeLoadMethods.ts` as standalone modules

### 1.4 Node implementation files

Each node implementation remains its own file under `services/nodes/`:

```
services/nodes/chatDeepseek.ts    → exports { init, loadMethods }
services/nodes/bufferMemory.ts    → exports { init }
services/nodes/conversationChain.ts → exports { init }
```

`NodesPool` imports and attaches these to the matching node definition.
Future nodes just need one file + one registration line.

### Tasks

- [ ] 1.1 Define `NodeDefinition` type in `types/node.ts`
- [ ] 1.2 Create `NodesPool` service with all accessors
- [ ] 1.3 Migrate `routes/nodes.ts` to use `NodesPool`
- [ ] 1.4 Migrate `flowRunner.ts` to use `NodesPool`
- [ ] 1.5 Remove standalone `nodeRegistry.ts` and `nodeLoadMethods.ts`
- [ ] 1.6 Update unit tests
- [ ] 1.7 Run all checks and commit

---

## Phase 2 — Flow Validation Service

**Problem:** We only validate that a flow has nodes and can be topologically sorted.
Flowise validates connectivity, required inputs, and credential presence before execution.

**Goal:** Pre-execution validation that catches common errors (disconnected nodes,
missing required inputs, missing credentials) and returns actionable error messages.

### How Flowise does it

The `checkFlowValidation` service:
1. Parses `flowData` → `nodes[]` + `edges[]`
2. Builds `connectedNodes` set from edges
3. For each node:
   - Is it connected? (skip `stickyNoteAgentflow`)
   - Are required inputs provided? (check `node.data.inputs` vs `componentNode.inputs`)
   - Does it need a credential? (check `componentNode.credential`)
   - Is the credential provided? (check `node.data.credential`)
4. Returns `[{nodeId, nodeLabel, issues: string[]}]`

### 2.1 Create `flowValidation` service

```
apps/server/src/services/flowValidation.ts
```

Validate against `NodesPool` metadata:
- **Disconnected nodes** — node ID not in any edge source/target
- **Missing required inputs** — input not marked `optional` and no value in `node.data.inputs`
- **Missing credentials** — node definition has `credential` but `node.data.credential` is empty
- **Unknown node types** — node name not in NodesPool

### 2.2 Wire into flow execution

Call `validateFlow()` before `executeFlow()` in `predictionService.ts`.
Return 400 with validation errors instead of failing mid-execution.

### 2.3 Add validation endpoint

`POST /api/v1/chatflows/validate/:id` — returns validation result without executing.

### Tasks

- [ ] 2.1 Create `flowValidation.ts` with `validateFlow(flowData, nodesPool)` 
- [ ] 2.2 Define return type `{nodeId, nodeLabel, issues: string[]}[]`
- [ ] 2.3 Add unit tests — disconnected nodes, missing inputs, missing creds
- [ ] 2.4 Wire into `predictionService.ts` pre-execution
- [ ] 2.5 Add `POST /api/v1/chatflows/validate/:id` endpoint
- [ ] 2.6 Add compat test — create invalid flow, validate, check errors
- [ ] 2.7 Run all checks and commit

---

## Phase 3 — Marketplace Templates

**Problem:** We serve 55 templates from `marketplace-templates.json` but they're
read-only. No import/use functionality and no parity with Flowise's marketplace.

**Goal:** Serve real marketplace templates that users can browse and import into
their workspace as new chatflows.

### Current state

- `GET /api/v1/marketplaces/templates` → serves 55 templates from JSON ✅
- `GET /api/v1/marketplaces/custom` → returns `[]` (stub)
- Individual template JSONs exist but aren't from original Flowise format

### 3.1 Extract complete templates from Flowise

Flowise ships templates in `marketplaces/` — 24 chatflows + agentflows + tools:

```
marketplaces/
  chatflows/     → 24 pre-built chatflow JSONs
  agentflows/    → agent-based flow templates
  agentflowsv2/  → v2 agent flows
  tools/         → tool templates
```

Each template: `{description, usecases, framework, nodes[], edges[]}`

Extract all templates from Flowise Docker and normalize for our format.

### 3.2 Template import endpoint

`POST /api/v1/chatflows` already creates chatflows. Templates just need a
"use template" action in the UI that POSTs the template's `flowData`.

### 3.3 Custom template CRUD

Enable users to save their own flows as templates:

- `POST /api/v1/marketplaces/custom` — save chatflow as template
- `GET /api/v1/marketplaces/custom` — list user templates
- `DELETE /api/v1/marketplaces/custom/:id` — delete template

### Tasks

- [ ] 3.1 Extract all Flowise templates from Docker container
- [ ] 3.2 Normalize template format to match our `marketplace-templates.json` schema
- [ ] 3.3 Update `marketplace-templates.json` with full Flowise template set
- [ ] 3.4 Implement `POST /api/v1/marketplaces/custom` (save template)
- [ ] 3.5 Implement `DELETE /api/v1/marketplaces/custom/:id`
- [ ] 3.6 Wire custom templates to in-memory store
- [ ] 3.7 Add compat tests
- [ ] 3.8 Run all checks and commit

---

## Phase 4 — Credential Definitions

**Problem:** We have 63 credential definitions in `components-credentials.json`.
Flowise has 109. Some are incomplete or missing fields.

**Goal:** Full credential definition parity with Flowise 3.0.13. Every node that
references a credential type should have a matching definition.

### How Flowise does it

Each credential is a TypeScript class implementing `INodeCredential`:

```typescript
class OpenAIApi implements INodeCredential {
  label: string    // "OpenAI API"
  name: string     // "openAIApi"
  version: number  // 1.0
  inputs: INodeParams[]  // [{label, name, type: 'password'}]
  icon?: string
  description?: string
  optional?: boolean
}
```

### 4.1 Extract all 109 credential definitions

Extract from Flowise Docker container, convert to JSON format matching our
existing `components-credentials.json` schema.

### 4.2 Cross-reference with nodes.json

Every `node.credential.credentialNames[]` entry should have a matching credential
definition. Identify and fix any gaps.

### Tasks

- [ ] 4.1 Extract all 109 credential definitions from Flowise Docker
- [ ] 4.2 Convert to our JSON schema `{label, name, version, inputs, icon, description}`
- [ ] 4.3 Update `data/components-credentials.json` (63 → 109)
- [ ] 4.4 Add validation: every node's credential ref has a matching definition
- [ ] 4.5 Add unit test verifying cross-reference integrity
- [ ] 4.6 Run all checks and commit

---

## Phase 5 — HTTP Security (SSRF Protection)

**Problem:** When we add nodes that fetch user-provided URLs (web scrapers,
API toolkits, document loaders), we need SSRF protection to prevent requests to
internal networks.

**Goal:** Security middleware that blocks requests to private/internal IPs,
with a configurable deny list.

### How Flowise does it

`httpSecurity.ts` (230 lines) provides:

```typescript
isDeniedIP(ip: string): boolean          // Checks against private ranges
checkDenyList(hostname: string): void    // DNS resolve + IP check
secureAxiosRequest(config): Promise      // Wraps axios with SSRF check
secureFetch(url, options): Promise       // Wraps fetch with SSRF check
```

Checks against:
- Private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
- Loopback (127.x, ::1)
- Link-local (169.254.x, fe80::)
- Internal DNS names that resolve to private IPs

### 5.1 Create `httpSecurity` service

```
apps/server/src/services/httpSecurity.ts
```

Port the Flowise logic with our TypeScript patterns:
- `isDeniedIP(ip)` — check against private ranges
- `checkDenyList(hostname)` — DNS resolve + check
- `secureFetch(url, options)` — wrapper that checks before fetching
- Environment variable `TOOL_FUNCTION_DENY_LIST` for custom deny patterns

### Tasks

- [ ] 5.1 Create `httpSecurity.ts` service
- [ ] 5.2 Implement `isDeniedIP()` with private range checks
- [ ] 5.3 Implement `checkDenyList()` with DNS resolution
- [ ] 5.4 Implement `secureFetch()` wrapper
- [ ] 5.5 Add unit tests — private IPs denied, public IPs allowed
- [ ] 5.6 Run all checks and commit

---

## Phase 6 — Secure Zod Parser

**Problem:** When nodes accept user-provided JSON schemas (e.g., structured output
parser), parsing untrusted Zod schemas is a security risk — arbitrary code execution
via `z.transform()`, `z.refine()`, etc.

**Goal:** Sandboxed Zod schema parsing that only allows safe schema definitions.

### How Flowise does it

`secureZodParser.ts` (602 lines):
- Parses JSON → Zod schema with a whitelist of allowed Zod methods
- Blocks `transform`, `refine`, `superRefine`, `pipe`, and other code-execution surfaces
- Supports nested objects, arrays, unions, intersections, tuples
- Used by Structured Output Parser and similar nodes

### 6.1 Create `secureZodParser` service

```
apps/server/src/services/secureZodParser.ts
```

Port with simplifications where possible. Key functions:
- `parseZodSchema(jsonSchema)` → safe Zod schema
- Whitelist approach: only `z.string()`, `z.number()`, `z.boolean()`, `z.object()`,
  `z.array()`, `z.enum()`, `z.optional()`, `z.nullable()`, `z.union()`, etc.

### Tasks

- [ ] 6.1 Create `secureZodParser.ts`
- [ ] 6.2 Implement safe schema parsing with whitelist
- [ ] 6.3 Add unit tests — valid schemas parse, dangerous schemas rejected
- [ ] 6.4 Run all checks and commit

---

## Phase 7 — Evaluation System

**Problem:** No way to systematically test flow quality against datasets. Users
can't measure if a flow produces correct/expected outputs.

**Goal:** Dataset-driven evaluation that runs a flow against input/expected-output
pairs and reports accuracy/quality metrics.

### How Flowise does it

Three components:

1. **`EvaluationRunner.ts`** — orchestrates evaluation runs:
   - Takes a dataset (CSV/JSON with input + expected output pairs)
   - Runs each input through a chatflow prediction
   - Compares actual output to expected output
   - Reports pass/fail + metrics

2. **`EvaluationRunTracer.ts`** — traces execution for debugging:
   - Records each node's input/output during evaluation
   - Links traces to evaluation run ID
   - Enables debugging failed evaluations

3. **`EvaluationRunTracerLlama.ts`** — LlamaIndex-specific tracer variant

### Data model

```typescript
interface EvaluationDataset {
  id: string
  name: string
  items: Array<{
    input: string
    expectedOutput: string
    metadata?: Record<string, unknown>
  }>
}

interface EvaluationRun {
  id: string
  datasetId: string
  chatflowId: string
  status: 'running' | 'completed' | 'failed'
  results: Array<{
    input: string
    expectedOutput: string
    actualOutput: string
    passed: boolean
    latencyMs: number
  }>
  summary: {
    total: number
    passed: number
    failed: number
    avgLatencyMs: number
  }
}
```

### 7.1 Dataset management

- `POST /api/v1/datasets` — create dataset
- `GET /api/v1/datasets` — list datasets
- `GET /api/v1/datasets/:id` — get dataset
- `DELETE /api/v1/datasets/:id` — delete dataset
- `POST /api/v1/datasets/:id/items` — add items to dataset

### 7.2 Evaluation runner

- `POST /api/v1/evaluations` — start evaluation run (datasetId + chatflowId)
- `GET /api/v1/evaluations` — list evaluation runs
- `GET /api/v1/evaluations/:id` — get evaluation run + results
- Run predictions for each dataset item
- Compare outputs (exact match, contains, LLM-as-judge)

### 7.3 Evaluation tracer

- Record per-node execution traces during evaluation
- Link to evaluation run for debugging

### Dependencies

- Requires working prediction pipeline (done — stub + Deepseek)
- Requires dataset storage (new in-memory store)
- Requires evaluation storage (new in-memory store)
- LLM-as-judge comparison needs a configured LLM

### Tasks

- [ ] 7.1 Create `datasetStore.ts` in-memory store
- [ ] 7.2 Create `evaluationStore.ts` in-memory store
- [ ] 7.3 Create dataset CRUD endpoints
- [ ] 7.4 Create `EvaluationRunner` service
- [ ] 7.5 Create evaluation CRUD endpoints
- [ ] 7.6 Implement exact-match + contains comparison strategies
- [ ] 7.7 Add `EvaluationTracer` for per-node tracing
- [ ] 7.8 Add unit tests for runner and comparisons
- [ ] 7.9 Add integration test: create dataset → run evaluation → check results
- [ ] 7.10 Run all checks and commit

---

## Implementation Order

| Phase | Feature | Effort | Impact | Depends On |
|-------|---------|--------|--------|------------|
| **1** | Unified Node Architecture (NodesPool) | Medium | High — cleaner codebase, single source of truth | — |
| **2** | Flow Validation | Low-Med | High — prevents runtime errors, better UX | Phase 1 |
| **3** | Marketplace Templates | Low | Medium — better onboarding | — |
| **4** | Credential Definitions | Low | Medium — complete credential parity | — |
| **5** | HTTP Security (SSRF) | Low-Med | High — security requirement for URL-fetching nodes | — |
| **6** | Secure Zod Parser | Medium | Medium — security for schema nodes | — |
| **7** | Evaluation System | High | High — quality measurement | Phases 1-2 |

Phases 3-6 are independent and can be parallelized. Phase 7 depends on a solid
prediction pipeline and is intentionally last.

---

## Files Affected

```
apps/server/src/
  types/
    node.ts                    ← NEW: NodeDefinition type (Phase 1)
  services/
    nodesPool.ts               ← NEW: unified node registry (Phase 1)
    flowValidation.ts          ← NEW: pre-execution validation (Phase 2)
    httpSecurity.ts            ← NEW: SSRF protection (Phase 5)
    secureZodParser.ts         ← NEW: safe schema parsing (Phase 6)
    evaluationRunner.ts        ← NEW: dataset eval orchestrator (Phase 7)
    evaluationTracer.ts        ← NEW: per-node tracing (Phase 7)
    nodeRegistry.ts            ← REMOVE: merged into NodesPool (Phase 1)
    nodeLoadMethods.ts         ← REMOVE: merged into NodesPool (Phase 1)
    modelLoader.ts             ← KEEP: used by NodesPool internally
  storage/
    datasetStore.ts            ← NEW: in-memory dataset store (Phase 7)
    evaluationStore.ts         ← NEW: in-memory evaluation store (Phase 7)
  routes/
    nodes.ts                   ← MODIFY: use NodesPool (Phase 1)
    evaluations.ts             ← NEW: evaluation endpoints (Phase 7)
    datasets.ts                ← NEW: dataset endpoints (Phase 7)
  data/
    components-credentials.json ← UPDATE: 63 → 109 definitions (Phase 4)
    marketplace-templates.json  ← UPDATE: add Flowise templates (Phase 3)
```
