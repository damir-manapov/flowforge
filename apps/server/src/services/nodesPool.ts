/**
 * NodesPool — unified node registry.
 *
 * Single source of truth for every node: JSON metadata (from nodes.json),
 * init functions (from services/nodes/*), and load methods (model/region lists).
 *
 * Replaces the former nodeRegistry.ts and nodeLoadMethods.ts modules.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LoadMethodFn, LoadMethodResult, NodeData, NodeDefinition, NodeInitFn } from '../types/node.js'
import type { ModelType } from './modelLoader.js'
import { getModels, getRegions, MODEL_TYPE } from './modelLoader.js'
import { initBufferMemory } from './nodes/bufferMemory.js'
import { initChatDeepseek } from './nodes/chatDeepseek.js'
import { initConversationChain } from './nodes/conversationChain.js'

// ── Data loading ─────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const nodesPath = resolve(__dirname, '..', '..', 'data', 'nodes.json')

let pool: Map<string, NodeDefinition> | undefined

function loadPool(): Map<string, NodeDefinition> {
  if (!pool) {
    const raw = readFileSync(nodesPath, 'utf-8')
    const defs = JSON.parse(raw) as NodeDefinition[]
    pool = new Map<string, NodeDefinition>()
    for (const def of defs) {
      pool.set(def.name, def)
    }
    attachInitFunctions(pool)
    attachLoadMethods(pool)
  }
  return pool
}

// ── Init functions ───────────────────────────────────────────────────

/** Node implementations: name → init function. */
const initFunctions: ReadonlyMap<string, NodeInitFn> = new Map<string, NodeInitFn>([
  ['chatDeepseek', initChatDeepseek],
  ['bufferMemory', initBufferMemory],
  ['conversationChain', initConversationChain],
])

function attachInitFunctions(nodes: Map<string, NodeDefinition>): void {
  for (const [name, init] of initFunctions) {
    const def = nodes.get(name)
    if (def) {
      def.init = init
    }
  }
}

// ── Load methods ─────────────────────────────────────────────────────

/** Helper: build a model-list method for a direct-match provider. */
function modelMethod(category: ModelType, provider: string): LoadMethodFn {
  return () => getModels(category, provider) as LoadMethodResult
}

/** Helper: build a region-list method for a direct-match provider. */
function regionMethod(category: ModelType, provider: string): LoadMethodFn {
  return () => getRegions(category, provider) as LoadMethodResult
}

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

/** Build the complete load-method map for all nodes. */
function buildLoadMethodMap(): Map<string, Record<string, LoadMethodFn>> {
  const map = new Map<string, Record<string, LoadMethodFn>>()

  function register(name: string, methods: Record<string, LoadMethodFn>): void {
    const existing = map.get(name)
    map.set(name, existing ? { ...existing, ...methods } : methods)
  }

  // ---- Chat Models (direct match: nodeName === models.json provider) ----
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

  // ---- Aliased Chat Model nodes ----
  register('chatDeepseek', { listModels: modelMethod(MODEL_TYPE.CHAT, 'deepseek') })
  register('chatGroq_LlamaIndex', { listModels: modelMethod(MODEL_TYPE.CHAT, 'groqChat') })

  // ---- LLM Models ----
  const directLlmModelNodes = ['azureOpenAI', 'cohere', 'openAI']

  for (const name of directLlmModelNodes) {
    register(name, { listModels: modelMethod(MODEL_TYPE.LLM, name) })
  }

  register('awsBedrock', {
    listModels: modelMethod(MODEL_TYPE.LLM, 'awsBedrock'),
    listRegions: regionMethod(MODEL_TYPE.LLM, 'awsBedrock'),
  })

  // ---- Embedding Models ----
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

  // ---- Region-only nodes ----
  register('S3', { listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock') })
  register('s3Directory', { listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock') })
  register('kendra', { listRegions: regionMethod(MODEL_TYPE.CHAT, 'awsChatBedrock') })
  register('awsBedrockKBRetriever', { listRegions: regionMethod(MODEL_TYPE.EMBEDDING, 'AWSBedrockEmbeddings') })

  // ---- Agentflow nodes (aggregate all Chat Model nodes, skip LlamaIndex) ----
  const agentflowNodes = ['agentAgentflow', 'conditionAgentAgentflow', 'humanInputAgentflow', 'llmAgentflow']

  for (const name of agentflowNodes) {
    register(name, { listModels: listChatModelNodes })
  }

  // ---- Dynamic methods (need DB/API — return [] for now) ----
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
      const methodMap: Record<string, LoadMethodFn> = {}
      for (const methodName of methods) {
        methodMap[methodName] = () => []
      }
      register(nodeName, methodMap)
    }
  }

  return map
}

function attachLoadMethods(nodes: Map<string, NodeDefinition>): void {
  const loadMethodMap = buildLoadMethodMap()
  for (const [name, methods] of loadMethodMap) {
    const def = nodes.get(name)
    if (def) {
      def.loadMethodFns = methods
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

/** Get all node definitions as an array (for GET /api/v1/nodes). */
export function getAllNodes(): NodeDefinition[] {
  return Array.from(loadPool().values())
}

/** Get a single node definition by name. */
export function getNode(name: string): NodeDefinition | undefined {
  return loadPool().get(name)
}

/** Check if a node type exists (has metadata in nodes.json). */
export function hasNodeMetadata(name: string): boolean {
  return loadPool().has(name)
}

/** Check if a node type has an init function registered. */
export function hasNodeInit(name: string): boolean {
  return loadPool().get(name)?.init != null
}

/** Get all node type names that have init functions. */
export function getExecutableNodes(): string[] {
  const result: string[] = []
  for (const [name, def] of loadPool()) {
    if (def.init) result.push(name)
  }
  return result
}

/** Instantiate a node by type name. Throws if no init function is registered. */
export async function initNode(
  name: string,
  nodeData: NodeData,
  credentialData?: Record<string, unknown>,
): Promise<unknown> {
  const def = loadPool().get(name)
  if (!def?.init) {
    throw new Error(`Unknown node type: ${name}. Registered types: ${getExecutableNodes().join(', ')}`)
  }
  return def.init(nodeData, credentialData)
}

/**
 * Resolve a load method for a given node name + method name.
 * Returns undefined if no method is registered.
 */
export function resolveLoadMethod(nodeName: string, methodName: string): LoadMethodFn | undefined {
  return loadPool().get(nodeName)?.loadMethodFns?.[methodName]
}

/**
 * Get the first registered load method for a node (fallback when methodName is omitted).
 */
export function resolveFirstLoadMethod(nodeName: string): LoadMethodFn | undefined {
  const methods = loadPool().get(nodeName)?.loadMethodFns
  if (!methods) return undefined
  const firstKey = Object.keys(methods)[0]
  if (!firstKey) return undefined
  return methods[firstKey]
}

/** Visible for testing — clears the in-memory pool so next call re-reads from disk. */
export function _resetPool(): void {
  pool = undefined
}
