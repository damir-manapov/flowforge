import type { Chatflow } from '../../src/storage/inMemoryStore.js'

/** UUID v4 regex — use in `expect(value).toMatch(UUID_RE)`. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4?[0-9a-f]{3}-[89ab]?[0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Build a minimal `Chatflow` object with sensible defaults.
 * Override any field via `overrides`.
 */
export function makeChatflow(overrides: Partial<Chatflow> = {}): Chatflow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'test',
    flowData: '{"nodes":[],"edges":[]}',
    deployed: false,
    isPublic: false,
    apikeyid: '',
    chatbotConfig: null,
    apiConfig: null,
    analytic: null,
    speechToText: null,
    category: null,
    type: 'CHATFLOW' as const,
    createdDate: '2024-01-01T00:00:00.000Z',
    updatedDate: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}
