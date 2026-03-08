/**
 * Node registry — maps Flowise node type names to their init functions.
 *
 * Each init function receives the node data and optional credential data,
 * and returns a LangChain object (model, memory, chain, etc.).
 */

import type { FlowNode } from './flowRunner.js'

export type NodeData = FlowNode['data'] & { inputs: Record<string, unknown> }

export type NodeInitFn = (nodeData: NodeData, credentialData?: Record<string, unknown>) => Promise<unknown>

const registry = new Map<string, NodeInitFn>()

/** Register a node init function for a given node type name. */
export function registerNode(name: string, init: NodeInitFn): void {
  registry.set(name, init)
}

/** Check if a node type is registered. */
export function hasNode(name: string): boolean {
  return registry.has(name)
}

/** Get all registered node type names. */
export function getRegisteredNodes(): string[] {
  return Array.from(registry.keys())
}

/** Instantiate a node by type name. Throws if not registered. */
export async function initNode(
  name: string,
  nodeData: NodeData,
  credentialData?: Record<string, unknown>,
): Promise<unknown> {
  const init = registry.get(name)
  if (!init) {
    throw new Error(`Unknown node type: ${name}. Registered types: ${getRegisteredNodes().join(', ')}`)
  }
  return init(nodeData, credentialData)
}

// ── Register built-in nodes ──────────────────────────────────────────

import { initBufferMemory } from './nodes/bufferMemory.js'
import { initChatDeepseek } from './nodes/chatDeepseek.js'
import { initConversationChain } from './nodes/conversationChain.js'

registerNode('chatDeepseek', initChatDeepseek)
registerNode('bufferMemory', initBufferMemory)
registerNode('conversationChain', initConversationChain)
