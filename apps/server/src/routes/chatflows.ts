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
import { type PaginationQuery, paginate } from '../utils/pagination.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

interface ChatflowListQuery extends PaginationQuery {
  type?: string | undefined
}

export function registerChatflowRoutes(app: FastifyInstance): void {
  app.get('/api/v1/chatflows', async (request: FastifyRequest<{ Querystring: ChatflowListQuery }>, reply) => {
    let chatflows = getAllChatflows()
    const query = request.query as ChatflowListQuery

    // Filter by type (CHATFLOW or AGENTFLOW) if specified
    if (query.type) {
      chatflows = chatflows.filter((cf) => cf.type === query.type)
    }

    return reply.code(200).send(paginate(chatflows, query))
  })

  app.get('/api/v1/chatflows/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid chatflow id format: ${id}`)
    }

    const chatflow = getChatflowById(id)

    if (!chatflow) {
      return sendError(
        reply,
        500,
        `Error: chatflowsService.getChatflowById - Chatflow ${id} not found in the database!`,
      )
    }

    return reply.code(200).send(chatflow)
  })

  app.post('/api/v1/chatflows', async (request: FastifyRequest, reply) => {
    const body = request.body as Partial<Chatflow> | null

    if (!body || typeof body !== 'object') {
      return sendError(reply, 500, 'Error: chatflowsService.saveChatflow - Request body is required')
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return sendError(
        reply,
        500,
        'Error: chatflowsService.saveChatflow - SQLITE_CONSTRAINT: NOT NULL constraint failed: chat_flow.name',
      )
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

  app.get('/api/v1/chatflows-streaming/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid chatflow id format: ${id}`)
    }

    const chatflow = getChatflowById(id)

    if (!chatflow) {
      return sendError(
        reply,
        500,
        `Error: chatflowsService.checkIfChatflowIsValidForStreaming - Chatflow ${id} not found`,
      )
    }

    // Analyze flowData for ending nodes — Flowise returns 500 if none found
    let hasEndingNode = false
    try {
      const flowData = JSON.parse(chatflow.flowData ?? '{}')
      const nodes = Array.isArray(flowData.nodes) ? flowData.nodes : []
      hasEndingNode = nodes.length > 0
    } catch {
      // malformed JSON → no ending nodes
    }

    if (!hasEndingNode) {
      return sendError(
        reply,
        500,
        'Error: chatflowsService.checkIfChatflowIsValidForStreaming - Ending nodes not found',
      )
    }

    // Stub: return false. Real implementation would check if ending nodes support streaming.
    return reply.code(200).send({ isStreaming: false })
  })

  // Upload config — determines what the chat panel's input area shows
  // (mic button, file attach button, etc.)
  app.get('/api/v1/chatflows-uploads/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid chatflow id format: ${id}`)
    }

    const chatflow = getChatflowById(id)

    if (!chatflow) {
      return sendError(
        reply,
        500,
        `Error: chatflowsService.getChatflowById - Chatflow ${id} not found in the database!`,
      )
    }

    // Stub: no upload support. Real implementation would inspect flow nodes.
    return reply.code(200).send({
      isSpeechToTextEnabled: false,
      isImageUploadAllowed: false,
      isRAGFileUploadAllowed: false,
      imgUploadSizeAndTypes: [],
      fileUploadSizeAndTypes: [],
    })
  })
}
