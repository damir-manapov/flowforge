import { describe, expect, it, vi } from 'vitest'
import { endSSE, initSSE, writeKeepAlive, writeSSE } from '../src/sse/sseWriter.js'

function mockReply(destroyed = false) {
  const self = {
    raw: {
      destroyed,
      write: vi.fn(),
      end: vi.fn(),
      flushHeaders: vi.fn(),
    },
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as import('fastify').FastifyReply
  return self
}

describe('sseWriter', () => {
  describe('initSSE', () => {
    it('sets correct SSE headers via Fastify API', () => {
      const reply = mockReply()
      initSSE(reply)
      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
      expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'no-cache')
      expect(reply.header).toHaveBeenCalledWith('Connection', 'keep-alive')
      expect(reply.header).toHaveBeenCalledWith('X-Accel-Buffering', 'no')
      expect(reply.status).toHaveBeenCalledWith(200)
      expect(reply.raw.flushHeaders).toHaveBeenCalled()
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
