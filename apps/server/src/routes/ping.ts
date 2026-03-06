import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function registerPingRoutes(app: FastifyInstance): void {
  app.get('/api/v1/ping', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send('pong')
  })
}
