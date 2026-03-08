import type { FastifyReply } from 'fastify'
import { vi } from 'vitest'

export interface MockReplyResult {
  /** The mock reply object (cast to `FastifyReply` where needed). */
  reply: FastifyReply
  /** Direct access to the `raw` mock for assertions. */
  raw: {
    destroyed: boolean
    write: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
    flushHeaders: ReturnType<typeof vi.fn>
  }
  /** All chunks written via `raw.write`. */
  chunks: string[]
}

/**
 * Create a mock Fastify reply suitable for SSE tests.
 *
 * @param destroyed — initial value for `raw.destroyed` (default `false`)
 */
export function createMockReply(destroyed = false): MockReplyResult {
  const chunks: string[] = []
  const raw = {
    destroyed,
    write: vi.fn((data: string) => chunks.push(data)),
    end: vi.fn(() => {
      raw.destroyed = true
    }),
    flushHeaders: vi.fn(),
  }
  const reply = {
    raw,
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply
  return { reply, raw, chunks }
}
