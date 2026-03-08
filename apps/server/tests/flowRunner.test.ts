import { describe, expect, it } from 'vitest'
import {
  extractInputName,
  type FlowEdge,
  type FlowNode,
  findEndingNode,
  parseFlowData,
  topologicalSort,
} from '../src/services/flowRunner.js'

// ── Helpers ──────────────────────────────────────────────────────────

function makeNode(id: string, name: string): FlowNode {
  return {
    id,
    data: {
      name,
      type: name,
      label: name,
      inputs: {},
    },
  }
}

function makeEdge(
  source: string,
  target: string,
  sourceHandle = `${source}-output`,
  targetHandle = `${target}-input-model-BaseChatModel`,
): FlowEdge {
  return { source, target, sourceHandle, targetHandle }
}

// ── parseFlowData ────────────────────────────────────────────────────

describe('parseFlowData', () => {
  it('parses a simple two-node flow', () => {
    const json = JSON.stringify({
      nodes: [makeNode('a', 'chatDeepseek'), makeNode('b', 'conversationChain')],
      edges: [makeEdge('a', 'b')],
    })

    const flow = parseFlowData(json)
    expect(flow.nodes).toHaveLength(2)
    expect(flow.edges).toHaveLength(1)
    expect(flow.sorted).toHaveLength(2)
    expect(flow.endingNode.id).toBe('b')
  })

  it('throws on empty nodes', () => {
    const json = JSON.stringify({ nodes: [], edges: [] })
    expect(() => parseFlowData(json)).toThrow('Flow has no nodes')
  })

  it('parses flow with no edges (single node)', () => {
    const json = JSON.stringify({
      nodes: [makeNode('a', 'chatDeepseek')],
      edges: [],
    })
    const flow = parseFlowData(json)
    expect(flow.endingNode.id).toBe('a')
    expect(flow.sorted).toHaveLength(1)
  })
})

// ── topologicalSort ──────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('sorts upstream before downstream', () => {
    const nodes = [makeNode('c', 'chain'), makeNode('a', 'model'), makeNode('b', 'memory')]
    const edges = [makeEdge('a', 'c'), makeEdge('b', 'c')]

    const sorted = topologicalSort(nodes, edges)
    const ids = sorted.map((n) => n.id)

    // a and b should come before c
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'))
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'))
  })

  it('handles a linear chain', () => {
    const nodes = [makeNode('a', 'n1'), makeNode('b', 'n2'), makeNode('c', 'n3')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]

    const sorted = topologicalSort(nodes, edges)
    expect(sorted.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('throws on cyclic graph', () => {
    const nodes = [makeNode('a', 'n1'), makeNode('b', 'n2')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')]

    expect(() => topologicalSort(nodes, edges)).toThrow('cycle')
  })

  it('handles disconnected graph', () => {
    const nodes = [makeNode('a', 'n1'), makeNode('b', 'n2')]
    const edges: FlowEdge[] = []

    const sorted = topologicalSort(nodes, edges)
    expect(sorted).toHaveLength(2)
  })
})

// ── findEndingNode ───────────────────────────────────────────────────

describe('findEndingNode', () => {
  it('finds node with incoming but no outgoing edges', () => {
    const nodes = [makeNode('a', 'model'), makeNode('b', 'chain')]
    const edges = [makeEdge('a', 'b')]

    const end = findEndingNode(nodes, edges)
    expect(end.id).toBe('b')
  })

  it('returns single node when no edges exist', () => {
    const nodes = [makeNode('a', 'model')]
    const end = findEndingNode(nodes, [])
    expect(end.id).toBe('a')
  })

  it('picks first terminal when multiple exist', () => {
    const nodes = [makeNode('a', 'src'), makeNode('b', 'sink1'), makeNode('c', 'sink2')]
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')]

    const end = findEndingNode(nodes, edges)
    expect(['b', 'c']).toContain(end.id)
  })

  it('throws when cannot determine ending node', () => {
    const nodes = [makeNode('a', 'n1'), makeNode('b', 'n2')]
    // Multiple disconnected → no targets at all
    expect(() => findEndingNode(nodes, [])).toThrow('Cannot determine ending node')
  })
})

// ── extractInputName ─────────────────────────────────────────────────

describe('extractInputName', () => {
  it('extracts input name from Flowise targetHandle format', () => {
    expect(extractInputName('conversationChain_0-input-model-BaseChatModel')).toBe('model')
  })

  it('extracts memory input name', () => {
    expect(extractInputName('conversationChain_0-input-memory-BaseMemory')).toBe('memory')
  })

  it('returns undefined for handle without input keyword', () => {
    expect(extractInputName('foo')).toBeUndefined()
    expect(extractInputName('just-some-handle')).toBeUndefined()
  })

  it('extracts from handle that contains input keyword', () => {
    // 'no-input-here' splits to ['no', 'input', 'here'] → returns 'here'
    expect(extractInputName('no-input-here')).toBe('here')
  })

  it('handles handle with input keyword', () => {
    expect(extractInputName('node_0-input-cache-BaseCache')).toBe('cache')
  })
})
