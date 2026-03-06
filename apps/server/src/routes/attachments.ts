import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getChatflowById } from '../storage/inMemoryStore.js'
import { v4 as uuidv4 } from 'uuid'

interface AttachmentParams {
  chatflowId: string
  chatId: string
}

export function registerAttachmentRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/attachments/:chatflowId/:chatId',
    async (request: FastifyRequest<{ Params: AttachmentParams }>, reply: FastifyReply) => {
      const { chatflowId, chatId } = request.params

      const chatflow = getChatflowById(chatflowId)
      if (!chatflow) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Chatflow ${chatflowId} not found`,
        })
      }

      const parts = request.parts()
      const files: { name: string; size: number; type: string; id: string }[] = []

      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer()
          const id = uuidv4()
          files.push({
            name: part.filename,
            size: buffer.length,
            type: part.mimetype,
            id,
          })
        }
      }

      if (files.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'No files uploaded',
        })
      }

      return reply.code(200).send({
        chatflowId,
        chatId,
        files,
      })
    },
  )
}
