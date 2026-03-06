import { describe, expect, it, vi } from 'vitest'
import { endSSE, initSSE, writeKeepAlive, writeSSE } from '../src/sse/sseWriter.js'

function mockReply(destroyed = false) {
  return {
    raw: {
      destroyed,
      write: vi.fn(),
      end: vi.fn(),
      writeHead: vi.fn(),
    },
  } as unknown as import('fastify').FastifyReply
}

describe('sseWriter', () => {
  describe('initSSE', () => {
    it('writes correct SSE headers', () => {
      const reply = mockReply()
      initSSE(reply)
      expect(reply.raw.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
    })
  })

  describe('writeSSE', () => {
    it('writes correctly formatted SSE payload', () => {
      const reply = mockReply()
      writeSSE(reply, 'token', 'hello')
      expect(reply.raw.write).toHaveBeenCalledWith('event: token\ndata: hello\n\n')
    })

    it('does not write if reply is destroyed', () => {
      const reply = mockReply(true)
      writeSSE(reply, 'token', 'hello')
      expect(reply.raw.write).not.toHaveBeenCalled()
    })
  })

  describe('writeKeepAlive', () => {
    it('writes SSE comment for keepalive', () => {
      const reply = mockReply()
      writeKeepAlive(reply)
      expect(reply.raw.write).toHaveBeenCalledWith(': keepalive\n\n')
    })

    it('does not write if reply is destroyed', () => {
      const reply = mockReply(true)
      writeKeepAlive(reply)
      expect(reply.raw.write).not.toHaveBeenCalled()
    })
  })

  describe('endSSE', () => {
    it('calls end on raw stream', () => {
      const reply = mockReply()
      endSSE(reply)
      expect(reply.raw.end).toHaveBeenCalled()
    })

    it('does not call end if destroyed', () => {
      const reply = mockReply(true)
      endSSE(reply)
      expect(reply.raw.end).not.toHaveBeenCalled()
    })
  })
})
