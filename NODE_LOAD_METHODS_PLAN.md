# Node Load Methods — Architecture Plan

## Goal

Replace the flat `data/node-load-methods.json` lookup with a proper service
architecture that mirrors how Flowise 3.0.13 implements `POST /node-load-method/:name`.

---

## How Flowise Does It

### 3-Layer Architecture

```
Route  →  Controller  →  Service
                            ↓
              nodesPool.componentNodes[nodeName]
                .loadMethods[methodName](nodeData, options)
```

Each node class has a `loadMethods` object with named async functions.  Most call
`modelLoader.getModels(category, providerName)` or `getRegions(category, providerName)`.

### modelLoader (flowise-components)

Reads `models.json` — a static file with three categories:

```jsonc
{
  "chat":      [ { "name": "awsChatBedrock",  "models": [...], "regions": [...] }, ... ],
  "llm":       [ { "name": "awsBedrock",      "models": [...], "regions": [...] }, ... ],
  "embedding": [ { "name": "openAIEmbeddings","models": [...], "regions": [...] }, ... ]
}
```

**Functions:**
- `getModels(category, providerName)` → returns `[{label, name}]`
- `getRegions(category, providerName)` → returns `[{label, name}]`

### models.json Statistics (Flowise 3.0.13)

| Category  | Providers | Example                              |
|-----------|-----------|--------------------------------------|
| chat      | 17        | awsChatBedrock, deepseek, chatOpenAI |
| llm       | 5         | awsBedrock, azureOpenAI, cohere      |
| embedding | 8         | openAIEmbeddings, cohereEmbeddings   |

---

## Current State (FlowForge)

- `data/node-load-methods.json` — flat file with 70 pre-captured entries
  keyed as `{nodeName}/{methodName}`, 810 total items.  Committed in `5fd4f4a`.
- `data/models.json` — extracted from Flowise 3.0.13 (done).
- Route in `src/routes/nodes.ts` does a direct JSON lookup → no service layer.

---

## 18 Unique Load Methods Across 301 Nodes

### Static Methods (models.json-powered) — 2 methods

| Method        | Nodes | What It Does                                   |
|---------------|-------|------------------------------------------------|
| `listModels`  | 34    | `getModels(category, provider)` from models.json |
| `listRegions` | 9     | `getRegions(category, provider)` from models.json |

### Dynamic Methods (need runtime / DB) — 16 methods

| Method                | Nodes | Original Data Source         |
|-----------------------|-------|------------------------------|
| `listFlows`           | 2     | DB query — chatflows         |
| `listChatflows`       | 1     | DB query — chatflows         |
| `listAgentflows`      | 1     | DB query — chatflows (agent) |
| `listAssistants`      | 1     | OpenAI API call              |
| `listTools`           | 2     | DB query — tools table       |
| `listStores`          | 2     | DB query — doc stores        |
| `listActions`         | 7     | MCP runtime — tool list      |
| `listEndpoints`       | 1     | OpenAPI spec parse           |
| `listServers`         | 1     | OpenAPI spec parse           |
| `listTables`          | 1     | AWS DynamoDB API call        |
| `listTopics`          | 1     | AWS SNS API call             |
| `listFiles`           | 1     | Google Drive API call        |
| `listSpreadsheets`    | 1     | Google Sheets API call       |
| `listConnections`     | 1     | Composio API call            |
| `listApps`            | 1     | Composio API call            |
| `listPreviousNodes`   | 1     | Runtime — flow graph walk    |

---

## Node-to-Provider Mapping

### Direct Match (node name === models.json provider name) — 28 nodes

These call `getModels(category, nodeName)` or `getRegions(category, nodeName)`:

`chatOpenAI`, `chatAnthropic`, `chatMistralAI`, `chatCerebras`, `chatCohere`,
`chatGoogleGenerativeAI`, `chatGoogleVertexAI`, `chatPerplexity`,
`awsChatBedrock`, `azureChatOpenAI`, `groqChat`, `chatOpenAI_LlamaIndex`,
`chatAnthropic_LlamaIndex`, `chatMistral_LlamaIndex`, `azureChatOpenAI_LlamaIndex`,
`awsBedrock`, `azureOpenAI`, `cohere`, `openAI`,
`openAIEmbeddings`, `cohereEmbeddings`, `mistralAIEmbeddings`,
`googleGenerativeAiEmbeddings`, `googlevertexaiEmbeddings`,
`AWSBedrockEmbeddings`, `openAIEmbedding_LlamaIndex`, `voyageAIEmbeddings`,
`chatAlibabaTongyi`

### Aliased Nodes — must map nodeName → provider in models.json

| Node Name                  | Method         | maps to → `getModels/getRegions(cat, provider)`     |
|----------------------------|----------------|------------------------------------------------------|
| `chatDeepseek`             | `listModels`   | `getModels(CHAT, 'deepseek')`                        |
| `chatGroq_LlamaIndex`     | `listModels`   | `getModels(CHAT, 'groqChat')`                        |
| `S3`                       | `listRegions`  | `getRegions(CHAT, 'awsChatBedrock')`                 |
| `s3Directory`              | `listRegions`  | `getRegions(CHAT, 'awsChatBedrock')`                 |
| `kendra`                   | `listRegions`  | `getRegions(CHAT, 'awsChatBedrock')`                 |
| `awsBedrockKBRetriever`   | `listRegions`  | `getRegions(EMBEDDING, 'AWSBedrockEmbeddings')`      |

### Agentflow Nodes — special: aggregate all Chat Models

| Node Name                  | Method         | Implementation                                      |
|----------------------------|----------------|------------------------------------------------------|
| `agentAgentflow`           | `listModels`   | All nodes where `category === 'Chat Models'` (skip LlamaIndex) |
| `conditionAgentAgentflow`  | `listModels`   | Same ↑                                               |
| `humanInputAgentflow`      | `listModels`   | Same ↑                                               |
| `llmAgentflow`             | `listModels`   | Same ↑                                               |

These return `[{label, name, imageSrc}]` — a list of chat model **nodes** (not model
names).  The UI uses this to let users pick which chat model node to wire into an agent.

---

## Implementation Plan

### Step 1 — Create `modelLoader` service

**File:** `apps/server/src/services/modelLoader.ts`

```typescript
// Reads data/models.json, exposes getModels() and getRegions()
// Mirrors flowise-components/src/modelLoader.ts

export const MODEL_TYPE = { CHAT: 'chat', LLM: 'llm', EMBEDDING: 'embedding' } as const
type ModelType = (typeof MODEL_TYPE)[keyof typeof MODEL_TYPE]

interface ModelEntry { label: string; name: string }

export function getModels(category: ModelType, providerName: string): ModelEntry[]
export function getRegions(category: ModelType, providerName: string): ModelEntry[]
```

Caches parsed JSON.  Each entry in `providers[].models` becomes `{label: name, name}`.
For regions the same: `{label: region, name: region}`.

### Step 2 — Create node load-method registry

**File:** `apps/server/src/services/nodeLoadMethods.ts`

A declarative map from `nodeName` → `{ [methodName]: () => result }`.

Three flavours:

1. **Model-provider nodes** — `listModels` → `getModels(category, provider)`
2. **Region-provider nodes** — `listRegions` → `getRegions(category, provider)`
3. **Agentflow nodes** — return aggregated chat model node list from `nodes.json`
4. **Dynamic nodes** — return `[]` (proper implementation needs DB/API access)

```typescript
type LoadMethodFn = () => Array<{ label: string; name: string; imageSrc?: string }>

// Registry: nodeName → { methodName → LoadMethodFn }
const registry: Record<string, Record<string, LoadMethodFn>> = { ... }

export function resolveLoadMethod(
  nodeName: string, methodName: string
): LoadMethodFn | undefined
```

### Step 3 — Rewire the route

**File:** `apps/server/src/routes/nodes.ts`

Replace `loadMethodsData()` flat-file lookup with:

```typescript
import { resolveLoadMethod } from '../services/nodeLoadMethods.js'

// POST /api/v1/node-load-method/:name
const method = resolveLoadMethod(name, loadMethod)
return reply.code(200).send(method ? method() : [])
```

Remove `loadMethodsPath`, `loadMethodsCache`, `loadMethodsData()`.

### Step 4 — Delete `data/node-load-methods.json`

No longer needed — models come from `models.json` via `modelLoader`, agentflow
nodes come from `nodes.json` at runtime, dynamic methods return `[]`.

### Step 5 — Update tests if shapes changed

The existing tests should still pass:
- `chatDeepseek/listModels` → `getModels(CHAT, 'deepseek')` → same model names
- `chatOpenAI/listModels` → `getModels(CHAT, 'chatOpenAI')` → same model names
- `unknownNode/listModels` → `resolveLoadMethod` returns `undefined` → `[]`

Verify with `bun test` and `bash all-checks.sh`.

### Step 6 — Commit

```
feat(server): replace flat node-load-methods.json with modelLoader service

Mirror the original Flowise architecture:
- modelLoader reads data/models.json for model/region lists
- nodeLoadMethods registry maps node names to load method implementations
- Agentflow nodes aggregate all Chat Model nodes from nodes.json
- Dynamic methods (listFlows, listTools, etc.) return [] (no DB yet)
- Remove data/node-load-methods.json (810 items flat file)
```

---

## File Inventory After Implementation

```
apps/server/
  data/
    models.json              ← source of truth for models & regions (from Flowise)
    nodes.json               ← 301 node definitions (unchanged)
    node-load-methods.json   ← DELETED
  src/
    services/
      modelLoader.ts         ← NEW: getModels(), getRegions()
      nodeLoadMethods.ts     ← NEW: registry + resolveLoadMethod()
    routes/
      nodes.ts               ← MODIFIED: use resolveLoadMethod() instead of flat JSON
```

---

## Why This Architecture

1. **Mirrors Flowise** — easier to keep in sync when Flowise updates models.json
2. **Single source of truth** — models.json is the canonical model list, no duplication
3. **Extensible** — adding a new node just means adding one line to the registry
4. **Testable** — `modelLoader` and `resolveLoadMethod` are pure functions, easy to unit test
5. **Future-ready** — dynamic methods (listFlows, etc.) can be wired to real DB queries later
