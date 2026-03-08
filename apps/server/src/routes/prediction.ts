import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getChatflowById } from '../services/chatflowService.js'
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
  async function handlePrediction(request: FastifyRequest<{ Params: PredictionParams }>, reply: FastifyReply) {
    const { flowId } = request.params

    if (!isValidUUID(flowId)) {
      return sendError(reply, 400, `Invalid flowId format: ${flowId}`)
    }

    const chatflow = getChatflowById(flowId)

    if (!chatflow) {
      return sendError(
        reply,
        500,
        `Error: chatflowsService.getChatflowById - Chatflow ${flowId} not found in the database!`,
      )
    }

    const body = request.body as PredictionBody | null

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
