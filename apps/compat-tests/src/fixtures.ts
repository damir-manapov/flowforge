/**
 * Minimal flowData with one stub node — passes graph validation
 * (single node with no outgoing edges = valid ending node).
 *
 * Use this for chatflows that need successful predictions.
 * For error-path tests (empty graph → 500), use '{"nodes":[],"edges":[]}'.
 */
export const VALID_FLOW_DATA = JSON.stringify({
  nodes: [
    {
      id: 'node_0',
      data: { name: 'stubNode', type: 'CustomNode', label: 'Stub', inputs: {}, baseClasses: ['Chain'] },
    },
  ],
  edges: [],
})
