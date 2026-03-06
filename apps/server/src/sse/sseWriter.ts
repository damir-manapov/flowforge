import type { FastifyReply } from 'fastify'

const KEEPALIVE_INTERVAL_MS = 15_000

export function writeSSE(reply: FastifyReply, event: string, data: string): void {
  if (reply.raw.destroyed) return
  const payload = `event: ${event}\ndata: ${data}\n\n`
  reply.raw.write(payload)
}

export function writeKeepAlive(reply: FastifyReply): void {
  if (reply.raw.destroyed) return
  reply.raw.write(': keepalive\n\n')
}

/** Start a periodic keepalive comment to prevent proxy/LB idle-timeout disconnects. Returns cleanup function. */
export function startKeepAlive(reply: FastifyReply): () => void {
  const timer = setInterval(() => writeKeepAlive(reply), KEEPALIVE_INTERVAL_MS)
  return () => clearInterval(timer)
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
