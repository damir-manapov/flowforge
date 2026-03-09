/**
 * Flow graph parser and executor.
 *
 * Takes a Flowise flowData JSON string, parses the node/edge graph,
 * resolves credentials, instantiates LangChain components via the
 * node registry, and runs the terminal chain node.
 */

import { decryptCredentialData } from '../utils/encryption.js'
import { getCredentialById } from './credentialService.js'
import { initNode } from './nodesPool.js'

// ── Types ────────────────────────────────────────────────────────────

export interface FlowNode {
  id: string
  data: {
    name: string
    type: string
    label: string
    credential?: string
    inputs: Record<string, unknown>
    baseClasses?: string[]
    inputAnchors?: Array<{ name: string; type: string }>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface FlowEdge {
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

export interface ParsedFlow {
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** Nodes in topological order (upstream before downstream). */
  sorted: FlowNode[]
  /** The terminal node (receives inputs but has no outgoing edges). */
  endingNode: FlowNode
}

// ── Graph parsing ────────────────────────────────────────────────────

/** Parse flowData JSON into nodes, edges, sorted order, and ending node. */
export function parseFlowData(flowDataJson: string): ParsedFlow {
  const fd = JSON.parse(flowDataJson) as { nodes?: FlowNode[]; edges?: FlowEdge[] }
  const nodes = fd.nodes ?? []
  const edges = fd.edges ?? []

  if (nodes.length === 0) {
    throw new Error('Flow has no nodes')
  }

  const sorted = topologicalSort(nodes, edges)
  const endingNode = findEndingNode(nodes, edges)

  return { nodes, edges, sorted, endingNode }
}

/** Topological sort — upstream nodes before downstream. */
export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
    adjacency.get(edge.source)?.push(edge.target)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const result: FlowNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()
    if (id == null) break
    const node = nodeMap.get(id)
    if (node) result.push(node)

    for (const neighbor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (result.length !== nodes.length) {
    throw new Error('Flow graph has a cycle')
  }

  return result
}

/** Find the terminal node — a node with incoming edges but no outgoing edges. */
export function findEndingNode(nodes: FlowNode[], edges: FlowEdge[]): FlowNode {
  const sources = new Set(edges.map((e) => e.source))
  const targets = new Set(edges.map((e) => e.target))

  // Nodes that are targets but not sources (leaf/terminal)
  const terminals = nodes.filter((n) => targets.has(n.id) && !sources.has(n.id))

  if (terminals.length >= 1) return terminals[0] as FlowNode

  // If no edges, use the single node
  if (edges.length === 0 && nodes.length === 1) return nodes[0] as FlowNode

  throw new Error('Cannot determine ending node of the flow')
}

// ── Credential resolution ────────────────────────────────────────────

/** Resolve a credential ID to decrypted plain data. */
export function resolveCredential(credentialId: string): Record<string, unknown> {
  const credential = getCredentialById(credentialId)
  if (!credential) {
    throw new Error(`Credential ${credentialId} not found`)
  }
  return decryptCredentialData(credential.encryptedData)
}

// ── Flow execution ───────────────────────────────────────────────────

/**
 * Build and execute a flow. Returns the instantiated node objects keyed by node ID.
 *
 * Walks the sorted nodes, resolves credentials, instantiates LangChain objects,
 * and wires upstream outputs into downstream inputs via edge connections.
 */
export async function buildFlow(
  flow: ParsedFlow,
  overrideConfig?: Record<string, unknown>,
): Promise<Map<string, unknown>> {
  const instances = new Map<string, unknown>()

  for (const node of flow.sorted) {
    // 1. Resolve credential if present
    let credentialData: Record<string, unknown> | undefined
    if (node.data.credential) {
      credentialData = resolveCredential(node.data.credential)
    }

    // 2. Merge overrideConfig into node inputs (Flowise injects sessionId etc.)
    const resolvedInputs: Record<string, unknown> = { ...node.data.inputs }
    if (overrideConfig) {
      for (const [key, value] of Object.entries(overrideConfig)) {
        // Only override if the node declares this input (has it in inputs or it's empty)
        if (key in resolvedInputs || resolvedInputs[key] === '' || resolvedInputs[key] == null) {
          resolvedInputs[key] = value
        }
      }
    }

    // 3. Resolve upstream inputs from edges
    for (const edge of flow.edges) {
      if (edge.target !== node.id) continue

      // Extract the input name from targetHandle: "nodeId-input-{name}-{type}"
      const inputName = extractInputName(edge.targetHandle)
      if (inputName && instances.has(edge.source)) {
        resolvedInputs[inputName] = instances.get(edge.source)
      }
    }

    // 4. Instantiate the node
    const instance = await initNode(
      node.data.name,
      {
        ...node.data,
        inputs: resolvedInputs,
      },
      credentialData,
    )

    instances.set(node.id, instance)
  }

  return instances
}

/** Extract input name from a Flowise targetHandle string.
 *  Format: "conversationChain_0-input-model-BaseChatModel"
 *  Returns: "model"
 */
export function extractInputName(targetHandle: string): string | undefined {
  const parts = targetHandle.split('-')
  const inputIdx = parts.indexOf('input')
  if (inputIdx >= 0 && inputIdx + 1 < parts.length) {
    return parts[inputIdx + 1]
  }
  return undefined
}

/** Get the ending node's instance (the runnable chain/agent). */
export async function executeFlow(
  flowDataJson: string,
  overrideConfig?: Record<string, unknown>,
): Promise<{ flow: ParsedFlow; instances: Map<string, unknown> }> {
  const flow = parseFlowData(flowDataJson)
  const instances = await buildFlow(flow, overrideConfig)
  return { flow, instances }
}
