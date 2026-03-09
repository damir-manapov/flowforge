import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getChatflowById } from '../services/chatflowService.js'
import { parseFlowData } from '../services/flowRunner.js'
import { generateStubResponse, streamPrediction } from '../services/predictionService.js'
import { sendError } from '../utils/errors.js'
import { isValidUUID } from '../utils/validation.js'

interface PredictionParams {
  flowId: string
}

interface PredictionBody {
  question?: string | undefined
  streaming?: boolean | undefined
  chatId?: string | undefined
  overrideConfig?: Record<string, unknown> | undefined
}

export function registerPredictionRoutes(app: FastifyInstance): void {
  // Shared handler for both public and internal prediction endpoints
  async function handlePrediction(
    request: FastifyRequest<{ Params: PredictionParams; Body: PredictionBody }>,
    reply: FastifyReply,
  ) {
    const { flowId } = request.params

    if (!isValidUUID(flowId)) {
      return sendError(reply, 400, `Invalid flowId format: ${flowId}`)
    }

    const chatflow = getChatflowById(flowId)

    if (!chatflow) {
      return sendError(
        reply,
        404,
        `Error: chatflowsService.getChatflowById - Chatflow ${flowId} not found in the database!`,
      )
    }

    // Validate graph structure before inspecting the request body.
    // Flowise 3.0 checks for ending nodes first — returns 500 for empty/invalid graphs
    // regardless of body content.
    try {
      const flow = parseFlowData(chatflow.flowData)
      // Flowise validates that the ending node is a Chain, Agent, or Engine.
      // baseClasses like 'ConversationChain', 'BaseChain', 'AutoGPT' match via suffix/substring.
      const bases = flow.endingNode.data.baseClasses ?? []
      const validEnd = bases.some((c) => c.includes('Chain') || c.includes('Agent') || c.includes('Engine'))
      if (!validEnd) {
        return sendError(
          reply,
          500,
          'Error: chatflowsService.checkIfChatflowIsValidForStreaming - Ending node must be either a Chain or Agent or Engine',
        )
      }
    } catch {
      return sendError(
        reply,
        500,
        'Error: chatflowsService.checkIfChatflowIsValidForStreaming - Ending nodes not found',
      )
    }

    const { body } = request

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    const question = body.question
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return sendError(reply, 400, 'Question is required')
    }

    if (body.streaming === true) {
      await streamPrediction(reply, question, chatflow, {
        chatId: body.chatId,
        overrideConfig: body.overrideConfig,
      })
      return
    }

    const result = generateStubResponse(question)
    return reply.code(200).send(result)
  }

  // Public prediction endpoint (API key access)
  app.post('/api/v1/prediction/:flowId', handlePrediction)

  // Internal prediction endpoint (authenticated UI sessions — Flowise 3.0)
  app.post('/api/v1/internal-prediction/:flowId', handlePrediction)

  // Chat message history for the UI chat panel
  app.get('/api/v1/internal-chatmessage/:id', async (_request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    // Stub: return empty array. Real implementation would query chat message store.
    return reply.code(200).send([])
  })
}
