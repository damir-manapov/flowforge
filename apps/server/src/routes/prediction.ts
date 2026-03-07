import type { FastifyInstance, FastifyRequest } from 'fastify'
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
}

export function registerPredictionRoutes(app: FastifyInstance): void {
  app.post('/api/v1/prediction/:flowId', async (request: FastifyRequest<{ Params: PredictionParams }>, reply) => {
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
      await streamPrediction(reply, question)
      return
    }

    const result = generateStubResponse(question)
    return reply.code(200).send(result)
  })
}
