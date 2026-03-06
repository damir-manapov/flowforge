import type { FastifyReply } from 'fastify'

export function writeSSE(reply: FastifyReply, event: string, data: string): void {
  if (reply.raw.destroyed) return
  const payload = `event: ${event}\ndata: ${data}\n\n`
  reply.raw.write(payload)
}

export function writeKeepAlive(reply: FastifyReply): void {
  if (reply.raw.destroyed) return
  reply.raw.write(': keepalive\n\n')
}

export function endSSE(reply: FastifyReply): void {
  if (!reply.raw.destroyed) {
    reply.raw.end()
  }
}

export function initSSE(reply: FastifyReply): void {
  reply
    .header('Content-Type', 'text/event-stream')
    .header('Cache-Control', 'no-cache')
    .header('Connection', 'keep-alive')
    .header('X-Accel-Buffering', 'no')
    .status(200)
  reply.raw.flushHeaders()
}
