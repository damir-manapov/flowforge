import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  type Chatflow,
  createChatflow,
  deleteChatflow,
  getAllChatflows,
  getChatflowById,
  updateChatflow,
} from '../services/chatflowService.js'
import { sendError } from '../utils/errors.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

export function registerChatflowRoutes(app: FastifyInstance): void {
  app.get('/api/v1/chatflows', async (_request: FastifyRequest, reply) => {
    const chatflows = getAllChatflows()
    return reply.code(200).send(chatflows)
  })

  app.get('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid chatflow id format: ${id}`)
    }

    const chatflow = getChatflowById(id)

    if (!chatflow) {
      return sendError(reply, 404, `Chatflow ${id} not found`)
    }

    return reply.code(200).send(chatflow)
  })

  app.post('/api/v1/chatflows', async (request: FastifyRequest, reply) => {
    const body = request.body as Partial<Chatflow> | null

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return sendError(reply, 400, 'Name is required')
    }

    const chatflow = createChatflow(body, request.log)
    // 200 intentional — matches Flowise behavior (not 201)
    return reply.code(200).send(chatflow)
  })

  app.put('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params
    const body = request.body as Partial<Chatflow> | null

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid chatflow id format: ${id}`)
    }

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    const updated = updateChatflow(id, body)

    if (!updated) {
      return sendError(reply, 404, `Chatflow ${id} not found`)
    }

    return reply.code(200).send(updated)
  })

  app.delete('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid chatflow id format: ${id}`)
    }

    const deleted = deleteChatflow(id)

    if (!deleted) {
      return sendError(reply, 404, `Chatflow ${id} not found`)
    }

    return reply.code(200).send({ deleted: true })
  })
}
