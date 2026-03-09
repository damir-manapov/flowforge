import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createApiKey, deleteApiKey, getAllApiKeys, updateApiKey } from '../services/apiKeyService.js'
import { sendError } from '../utils/errors.js'
import { type PaginationQuery, paginate } from '../utils/pagination.js'

interface IdParams {
  id: string
}

interface ApiKeyBody {
  keyName: string
  permissions?: string[]
}

// API key IDs are 32 hex chars, not UUIDs
const HEX_ID_RE = /^[0-9a-f]{16,64}$/i

export function registerApiKeyRoutes(app: FastifyInstance): void {
  app.get('/api/v1/apikey', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    const keys = getAllApiKeys()
    return reply.code(200).send(paginate(keys, request.query))
  })

  app.post('/api/v1/apikey', async (request: FastifyRequest<{ Body: ApiKeyBody }>, reply) => {
    const { body } = request

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.keyName || typeof body.keyName !== 'string' || body.keyName.trim().length === 0) {
      return sendError(reply, 400, 'Key name is required')
    }

    const permissions = Array.isArray(body.permissions) ? body.permissions : []
    const keys = createApiKey(body.keyName, permissions)
    return reply.code(200).send(keys)
  })

  app.put('/api/v1/apikey/:id', async (request: FastifyRequest<{ Params: IdParams; Body: ApiKeyBody }>, reply) => {
    const { id } = request.params
    const { body } = request

    if (!HEX_ID_RE.test(id)) {
      return sendError(reply, 400, `Invalid API key id format: ${id}`)
    }

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    const keys = updateApiKey(id, body.keyName)

    if (!keys) {
      return sendError(reply, 404, `API key ${id} not found`)
    }

    return reply.code(200).send(keys)
  })

  app.delete('/api/v1/apikey/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!HEX_ID_RE.test(id)) {
      return sendError(reply, 400, `Invalid API key id format: ${id}`)
    }

    const keys = deleteApiKey(id)
    return reply.code(200).send(keys)
  })
}
