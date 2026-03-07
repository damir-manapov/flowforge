import type { FastifyInstance, FastifyRequest } from 'fastify'

/**
 * Boot-time stub routes.
 *
 * These return empty arrays so the Flowise UI loads without errors.
 * Each will be upgraded to a real implementation in later steps.
 */
export function registerStubRoutes(app: FastifyInstance): void {
  const emptyArray = async (_request: FastifyRequest, reply: { code: (n: number) => { send: (b: unknown) => void } }) =>
    reply.code(200).send([])

  app.get('/api/v1/document-store/stores', emptyArray)
  app.get('/api/v1/marketplaces/templates', emptyArray)
}
