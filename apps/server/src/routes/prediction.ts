import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { getChatflowById } from '../services/chatflowService.js'
import { generateStubResponse, streamPrediction } from '../services/predictionService.js'
import { isValidUUID } from '../utils/validation.js'

interface PredictionParams {
  flowId: string
}

interface PredictionBody {
  question?: string | undefined
  streaming?: boolean | undefined
  overrideConfig?: Record<string, unknown> | undefined
  history?: unknown[] | undefined
}

export function registerPredictionRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/prediction/:flowId',
    async (request: FastifyRequest<{ Params: PredictionParams }>, reply: FastifyReply) => {
      const { flowId } = request.params

      if (!isValidUUID(flowId)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid flowId format: ${flowId}`,
        })
      }

      const chatflow = getChatflowById(flowId)

      if (!chatflow) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Chatflow ${flowId} not found`,
        })
      }

      const body = request.body as PredictionBody | null

      if (!body || typeof body !== 'object') {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Request body is required',
        })
      }

      const question = body.question
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Question is required',
        })
      }

      if (body.streaming === true) {
        await streamPrediction(reply, question)
        return
      }

      const result = generateStubResponse(question)
      return reply.code(200).send(result)
    },
  )
}
