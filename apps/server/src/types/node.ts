/**
 * Shared node types used across the NodesPool, node implementations,
 * and flow execution services.
 */

import type { FlowNode } from '../services/flowRunner.js'

// ── Runtime types (used by node init functions) ──────────────────────

/** The data object passed to a node init function. */
export type NodeData = FlowNode['data'] & { inputs: Record<string, unknown> }

/** A node init function: receives node data + optional credentials, returns a LangChain object. */
export type NodeInitFn = (nodeData: NodeData, credentialData?: Record<string, unknown>) => Promise<unknown>

// ── Load method types ────────────────────────────────────────────────

export type LoadMethodResult = Array<{ label: string; name: string; [key: string]: unknown }>
export type LoadMethodFn = (nodesData?: unknown[]) => LoadMethodResult

// ── JSON node metadata (shape of nodes.json entries) ─────────────────

export interface NodeInputParam {
  label: string
  name: string
  type: string
  description?: string
  optional?: boolean
  default?: unknown
  loadMethod?: string
  loadConfig?: boolean
  options?: Array<{ label: string; name: string; description?: string }>
  acceptVariable?: boolean
  rows?: number
  placeholder?: string
  array?: unknown[]
  [key: string]: unknown
}

export interface NodeOutput {
  label: string
  name: string
  baseClasses: string[]
  description?: string
}

export interface NodeCredentialRef {
  label: string
  name: string
  type: string
  credentialNames: string[]
  optional?: boolean
}

/** A single node definition from nodes.json, enriched with runtime functions. */
export interface NodeDefinition {
  // ── From nodes.json ──
  label: string
  name: string
  type: string
  version: number
  category: string
  description?: string
  baseClasses: string[]
  inputs: NodeInputParam[]
  outputs?: NodeOutput[]
  credential?: NodeCredentialRef
  icon?: string
  color?: string
  badge?: string
  tags?: string[]
  documentation?: string
  hint?: string
  hideInput?: boolean
  hideOutput?: boolean
  deprecateMessage?: string
  baseURL?: string
  filePath?: string
  loadMethods?: Record<string, unknown>
  vectorStoreMethods?: Record<string, unknown>

  // ── Runtime (attached by NodesPool) ──
  init?: NodeInitFn
  loadMethodFns?: Record<string, LoadMethodFn>
}
