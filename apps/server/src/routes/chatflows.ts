import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  type Chatflow,
  createChatflow,
  deleteChatflow,
  getAllChatflows,
  getChatflowById,
  isValidUUID,
  updateChatflow,
} from '../services/chatflowService.js'

interface IdParams {
  id: string
}

export function registerChatflowRoutes(app: FastifyInstance): void {
  app.get('/api/v1/chatflows', async (_request: FastifyRequest, reply: FastifyReply) => {
    const chatflows = getAllChatflows()
    return reply.code(200).send(chatflows)
  })

  app.get('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid chatflow id format: ${id}`,
      })
    }

    const chatflow = getChatflowById(id)

    if (!chatflow) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Chatflow ${id} not found`,
      })
    }

    return reply.code(200).send(chatflow)
  })

  app.post('/api/v1/chatflows', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<Chatflow> | null

    if (!body || typeof body !== 'object') {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body is required',
      })
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Name is required',
      })
    }

    const chatflow = createChatflow(body, request.log)
    // 200 intentional — matches Flowise behavior (not 201)
    return reply.code(200).send(chatflow)
  })

  app.put('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = request.params
    const body = request.body as Partial<Chatflow>

    if (!isValidUUID(id)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid chatflow id format: ${id}`,
      })
    }

    const updated = updateChatflow(id, body)

    if (!updated) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Chatflow ${id} not found`,
      })
    }

    return reply.code(200).send(updated)
  })

  app.delete('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid chatflow id format: ${id}`,
      })
    }

    const deleted = deleteChatflow(id)

    if (!deleted) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Chatflow ${id} not found`,
      })
    }

    return reply.code(200).send({ deleted: true })
  })
}
