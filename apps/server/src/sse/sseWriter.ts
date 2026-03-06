import type { FastifyReply } from 'fastify'

export function writeSSE(reply: FastifyReply, event: string, data: string): void {
  const payload = `event: ${event}\ndata: ${data}\n\n`
  reply.raw.write(payload)
}

export function endSSE(reply: FastifyReply): void {
  reply.raw.end()
}

export function initSSE(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
}
