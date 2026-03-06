import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getChatflowById } from '../storage/inMemoryStore.js'
import { initSSE, writeSSE, endSSE } from '../sse/sseWriter.js'
import { v4 as uuidv4 } from 'uuid'

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

      const isStreaming = body.streaming === true

      const chatId = uuidv4()
      const chatMessageId = uuidv4()
      const sessionId = uuidv4()

      if (isStreaming) {
        initSSE(reply)

        const stubTokens = ['This ', 'is ', 'a ', 'stub ', 'response ', 'from ', 'FlowForge.']

        for (const token of stubTokens) {
          writeSSE(reply, 'token', token)
          await sleep(50)
        }

        const fullText = stubTokens.join('')
        const endPayload = JSON.stringify({
          chatId,
          chatMessageId,
          text: fullText,
          question,
          sessionId,
        })

        writeSSE(reply, 'end', endPayload)
        endSSE(reply)
        return
      }

      const responseText = 'This is a stub response from FlowForge.'

      return reply.code(200).send({
        text: responseText,
        question,
        chatId,
        chatMessageId,
        sessionId,
        memoryType: null,
        sourceDocuments: [],
        usedTools: [],
        fileAnnotations: [],
        agentReasoning: [],
      })
    },
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
