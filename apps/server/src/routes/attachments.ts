import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { UploadedFile } from '../services/attachmentService.js'
import { buildUploadedFile } from '../services/attachmentService.js'
import { getChatflowById, isValidUUID } from '../services/chatflowService.js'

interface AttachmentParams {
  chatflowId: string
  chatId: string
}

export function registerAttachmentRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/attachments/:chatflowId/:chatId',
    async (request: FastifyRequest<{ Params: AttachmentParams }>, reply: FastifyReply) => {
      const { chatflowId, chatId } = request.params

      if (!isValidUUID(chatflowId)) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid chatflowId format: ${chatflowId}`,
        })
      }

      if (!chatId || chatId.trim().length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'chatId is required',
        })
      }

      const chatflow = getChatflowById(chatflowId)
      if (!chatflow) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Chatflow ${chatflowId} not found`,
        })
      }

      const parts = request.parts()
      const files: UploadedFile[] = []

      for await (const part of parts) {
        if (part.type === 'file') {
          // Stream-discard: count bytes without holding entire buffer in memory
          let size = 0
          for await (const chunk of part.file) {
            size += chunk.length
          }
          files.push(buildUploadedFile(part.filename, size, part.mimetype))
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
