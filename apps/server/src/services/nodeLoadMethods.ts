import type { ModelType } from './modelLoader.js'
import { getModels, getRegions, MODEL_TYPE } from './modelLoader.js'

/**
 * Node load-method registry — maps node names to their load method
 * implementations, mirroring how each Flowise node class defines
 * `loadMethods: { listModels(), listRegions(), ... }`.
 *
 * Three flavours:
 * 1. Static model lookups → getModels(category, provider)
 * 2. Static region lookups → getRegions(category, provider)
 * 3. Agentflow aggregators → list all Chat Model nodes from nodes.json
 * 4. Dynamic methods (listFlows, listTools, etc.) → return [] (no DB yet)
 */

type LoadMethodResult = Array<{ label: string; name: string; [key: string]: unknown }>
type LoadMethodFn = (nodesData?: unknown[]) => LoadMethodResult

/** Helper: build a model-list method for a direct-match provider. */
function modelMethod(category: ModelType, provider: string): LoadMethodFn {
  return () => getModels(category, provider) as LoadMethodResult
}

/** Helper: build a region-list method for a direct-match provider. */
function regionMethod(category: ModelType, provider: string): LoadMethodFn {
  return () => getRegions(category, provider) as LoadMethodResult
}

// ---------------------------------------------------------------------------
// Registry: nodeName → { methodName → LoadMethodFn }
// ---------------------------------------------------------------------------

const registry: Record<string, Record<string, LoadMethodFn>> = {}

function register(nodeName: string, methods: Record<string, LoadMethodFn>): void {
  registry[nodeName] = methods
}

// ---- Chat Models (direct match: nodeName === models.json provider) --------

const directChatModelNodes = [
  'awsChatBedrock',
  'azureChatOpenAI',
  'azureChatOpenAI_LlamaIndex',
  'chatAlibabaTongyi',
  'chatAnthropic',
  'chatAnthropic_LlamaIndex',
  'chatCerebras',
  'chatCohere',
  'chatGoogleGenerativeAI',
  'chatMistralAI',
  'chatMistral_LlamaIndex',
  'chatOpenAI',
  'chatOpenAI_LlamaIndex',
  'chatPerplexity',
  'groqChat',
]

for (const name of directChatModelNodes) {
  register(name, { listModels: modelMethod(MODEL_TYPE.CHAT, name) })
}

// Chat models with regions too
register('awsChatBedrock', {
  listModels: modelMethod(MODEL_TYPE.CHAT, 'awsChatBedrock'),
  listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock'),
})

register('chatGoogleVertexAI', {
  listModels: modelMethod(MODEL_TYPE.CHAT, 'chatGoogleVertexAI'),
  listRegions: regionMethod(MODEL_TYPE.CHAT, 'chatGoogleVertexAI'),
})

// ---- Aliased Chat Model nodes (nodeName !== models.json provider) ---------

register('chatDeepseek', { listModels: modelMethod(MODEL_TYPE.CHAT, 'deepseek') })
register('chatGroq_LlamaIndex', { listModels: modelMethod(MODEL_TYPE.CHAT, 'groqChat') })

// ---- LLM Models -----------------------------------------------------------

const directLlmModelNodes = ['azureOpenAI', 'cohere', 'openAI']

for (const name of directLlmModelNodes) {
  register(name, { listModels: modelMethod(MODEL_TYPE.LLM, name) })
}

register('awsBedrock', {
  listModels: modelMethod(MODEL_TYPE.LLM, 'awsBedrock'),
  listRegions: regionMethod(MODEL_TYPE.LLM, 'awsBedrock'),
})

// ---- Embedding Models -----------------------------------------------------

const directEmbeddingModelNodes = [
  'cohereEmbeddings',
  'googleGenerativeAiEmbeddings',
  'googlevertexai',
  'mistralAIEmbeddings',
  'openAIEmbedding_LlamaIndex',
  'openAIEmbeddings',
  'voyageAIEmbeddings',
]

for (const name of directEmbeddingModelNodes) {
  register(name, { listModels: modelMethod(MODEL_TYPE.EMBEDDING, name) })
}

register('AWSBedrockEmbeddings', {
  listModels: modelMethod(MODEL_TYPE.EMBEDDING, 'AWSBedrockEmbeddings'),
  listRegions: regionMethod(MODEL_TYPE.EMBEDDING, 'AWSBedrockEmbeddings'),
})

register('googlevertexaiEmbeddings', {
  listModels: modelMethod(MODEL_TYPE.EMBEDDING, 'googlevertexaiEmbeddings'),
  listRegions: regionMethod(MODEL_TYPE.EMBEDDING, 'googlevertexaiEmbeddings'),
})

// ---- Region-only nodes (no listModels, just listRegions) ------------------

register('S3', { listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock') })
register('s3Directory', { listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock') })
register('kendra', { listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock') })
register('awsBedrockKBRetriever', { listRegions: regionMethod(MODEL_TYPE.EMBEDDING, 'AWSBedrockEmbeddings') })

// ---- Agentflow nodes (aggregate all Chat Model nodes, skip LlamaIndex) ----

interface NodeDef {
  name: string
  label: string
  category?: string
  icon?: string
  tags?: string[]
}

function listChatModelNodes(nodesData?: unknown[]): LoadMethodResult {
  if (!nodesData) return []
  const nodes = nodesData as NodeDef[]
  const result: LoadMethodResult = []
  for (const node of nodes) {
    if (node.category !== 'Chat Models') continue
    if (node.tags?.includes('LlamaIndex')) continue
    result.push({ label: node.label, name: node.name, imageSrc: node.icon ?? '' })
  }
  return result
}

const agentflowNodes = ['agentAgentflow', 'conditionAgentAgentflow', 'humanInputAgentflow', 'llmAgentflow']

for (const name of agentflowNodes) {
  register(name, { listModels: listChatModelNodes })
}

// ---- Dynamic methods (need DB/API — return [] for now) --------------------

const dynamicStubs: Array<{ nodes: string[]; methods: string[] }> = [
  { nodes: ['seqExecuteFlow', 'executeFlowAgentflow'], methods: ['listFlows'] },
  { nodes: ['ChatflowTool'], methods: ['listChatflows'] },
  { nodes: ['agentAsTool'], methods: ['listAgentflows'] },
  { nodes: ['openAIAssistant'], methods: ['listAssistants'] },
  { nodes: ['customTool', 'toolAgentflow'], methods: ['listTools'] },
  { nodes: ['documentStore', 'documentStoreVS'], methods: ['listStores'] },
  {
    nodes: [
      'braveSearchMCP',
      'customMCP',
      'githubMCP',
      'postgreSQLMCP',
      'sequentialThinkingMCP',
      'slackMCP',
      'supergatewayMCP',
      'teradataMCP',
    ],
    methods: ['listActions'],
  },
  { nodes: ['openAPIToolkit'], methods: ['listEndpoints', 'listServers'] },
  { nodes: ['awsDynamoDBKVStorage'], methods: ['listTables'] },
  { nodes: ['awsSNS'], methods: ['listTopics'] },
  { nodes: ['googleDrive'], methods: ['listFiles'] },
  { nodes: ['googleSheets'], methods: ['listSpreadsheets'] },
  { nodes: ['composio'], methods: ['listConnections', 'listApps', 'listActions'] },
  { nodes: ['loopAgentflow'], methods: ['listPreviousNodes'] },
]

for (const { nodes, methods } of dynamicStubs) {
  for (const nodeName of nodes) {
    const methodMap: Record<string, LoadMethodFn> = { ...registry[nodeName] }
    for (const methodName of methods) {
      methodMap[methodName] = () => []
    }
    registry[nodeName] = methodMap
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a load method for a given node name + method name.
 * Returns undefined if no method is registered.
 */
export function resolveLoadMethod(nodeName: string, methodName: string): LoadMethodFn | undefined {
  return registry[nodeName]?.[methodName]
}

/**
 * Get the first registered method for a node (fallback when methodName is omitted).
 */
export function resolveFirstLoadMethod(nodeName: string): LoadMethodFn | undefined {
  const methods = registry[nodeName]
  if (!methods) return undefined
  const firstKey = Object.keys(methods)[0]
  if (!firstKey) return undefined
  return methods[firstKey]
}
