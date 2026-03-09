/**
 * Flow validation service — pre-execution checks that catch common errors.
 *
 * Validates a flow's nodes and edges before execution:
 * - Disconnected nodes (not connected to any edge)
 * - Unknown node types (node name not in NodesPool)
 * - Missing required inputs (input not optional, no value provided)
 * - Missing credentials (node definition has credential but flow node doesn't)
 *
 * Mirrors Flowise's checkFlowValidation behaviour.
 */

import type { NodeDefinition, NodeInputParam } from '../types/node.js'
import type { FlowEdge, FlowNode } from './flowRunner.js'
import { getNode, hasNodeMetadata } from './nodesPool.js'

/** A single validation issue for a specific node. */
export interface ValidationIssue {
  nodeId: string
  nodeLabel: string
  issues: string[]
}

/** Parse raw flowData JSON into nodes + edges. */
function parseFlowData(flowDataJson: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const fd = JSON.parse(flowDataJson) as { nodes?: FlowNode[]; edges?: FlowEdge[] }
  return {
    nodes: fd.nodes ?? [],
    edges: fd.edges ?? [],
  }
}

/** Input types that represent user-provided values (not edge connections). */
const USER_INPUT_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'password',
  'options',
  'multiOptions',
  'json',
  'code',
  'file',
])

/** Sticky note types that are exempt from connectivity checks. */
const STICKY_NOTE_TYPES = new Set(['stickyNote', 'stickyNoteAgentflow'])

/** Check if a required input is missing a value. */
function isInputMissing(input: NodeInputParam, nodeInputs: Record<string, unknown>): boolean {
  if (input.optional) return false
  if (input.default != null) return false
  if (!USER_INPUT_TYPES.has(input.type)) return false

  const value = nodeInputs[input.name]
  return value == null || value === ''
}

/** Validate a single node against its definition. */
function validateNode(node: FlowNode, connectedIds: Set<string>, isMultiNodeFlow: boolean): string[] {
  const issues: string[] = []
  const nodeName = node.data.name

  // 1. Disconnected node check
  if (isMultiNodeFlow && !connectedIds.has(node.id) && !STICKY_NOTE_TYPES.has(nodeName)) {
    issues.push('Node is not connected to any other node')
  }

  // 2. Unknown node type
  if (!hasNodeMetadata(nodeName)) {
    issues.push(`Unknown node type: ${nodeName}`)
    return issues
  }

  const def = getNode(nodeName) as NodeDefinition

  // 3. Missing required inputs
  for (const input of def.inputs) {
    if (isInputMissing(input, node.data.inputs)) {
      issues.push(`Missing required input: ${input.label}`)
    }
  }

  // 4. Missing credentials
  if (def.credential && !def.credential.optional && !node.data.credential) {
    issues.push(`Missing credential: ${def.credential.label}`)
  }

  return issues
}

/**
 * Validate a flow and return an array of issues per node.
 * Returns empty array if the flow is valid.
 */
export function validateFlow(flowDataJson: string): ValidationIssue[] {
  const { nodes, edges } = parseFlowData(flowDataJson)

  if (nodes.length === 0) {
    return [{ nodeId: '', nodeLabel: '', issues: ['Flow has no nodes'] }]
  }

  const connectedIds = new Set<string>()
  for (const edge of edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  const isMultiNodeFlow = nodes.length > 1 && edges.length > 0
  const result: ValidationIssue[] = []

  for (const node of nodes) {
    const issues = validateNode(node, connectedIds, isMultiNodeFlow)
    if (issues.length > 0) {
      result.push({
        nodeId: node.id,
        nodeLabel: node.data.label || node.data.name,
        issues,
      })
    }
  }

  return result
}

/** Convenience: returns true if the flow has no validation issues. */
export function isFlowValid(flowDataJson: string): boolean {
  return validateFlow(flowDataJson).length === 0
}
