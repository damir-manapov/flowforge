import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { isValidUUID } from '../services/chatflowService.js'
import {
  generateStubResponse,
  getStubTokenDelayMs,
  getStubTokens,
  lookupChatflow,
} from '../services/predictionService.js'
import { endSSE, initSSE, writeSSE } from '../sse/sseWriter.js'

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

      const chatflow = lookupChatflow(flowId)

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

      const isStreaming = body.streaming === true

      if (isStreaming) {
        initSSE(reply)

        const tokens = getStubTokens()
        const delayMs = getStubTokenDelayMs()

        for (const token of tokens) {
          if (reply.raw.destroyed) break
          writeSSE(reply, 'token', token)
          if (delayMs > 0) await sleep(delayMs)
        }

        if (!reply.raw.destroyed) {
          const result = generateStubResponse(question)
          const endPayload = JSON.stringify({
            chatId: result.chatId,
            chatMessageId: result.chatMessageId,
            text: tokens.join(''),
            question,
            sessionId: result.sessionId,
          })

          writeSSE(reply, 'end', endPayload)
        }

        endSSE(reply)
        return
      }

      const result = generateStubResponse(question)
      return reply.code(200).send(result)
    },
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
