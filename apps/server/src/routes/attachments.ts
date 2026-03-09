import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { UploadedFile } from '../services/attachmentService.js'
import { buildUploadedFile } from '../services/attachmentService.js'
import { getChatflowById } from '../services/chatflowService.js'
import { sendError } from '../utils/errors.js'
import { isValidUUID } from '../utils/validation.js'

interface AttachmentParams {
  chatflowId: string
  chatId: string
}

/** Check whether a chatflow's flowData contains any nodes. */
function chatflowHasNodes(flowDataJson: string | undefined): boolean {
  try {
    const flowData = JSON.parse(flowDataJson ?? '{}')
    const nodes = Array.isArray(flowData.nodes) ? flowData.nodes : []
    return nodes.length > 0
  } catch {
    return false
  }
}

export function registerAttachmentRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/attachments/:chatflowId/:chatId',
    async (request: FastifyRequest<{ Params: AttachmentParams }>, reply) => {
      const { chatflowId, chatId } = request.params

      if (!isValidUUID(chatflowId)) {
        return sendError(reply, 400, `Invalid chatflowId format: ${chatflowId}`)
      }

      if (!chatId || chatId.trim().length === 0) {
        return sendError(reply, 400, 'chatId is required')
      }

      const chatflow = getChatflowById(chatflowId)
      if (!chatflow) {
        return sendError(
          reply,
          500,
          'Error: attachmentService.createAttachment - Invalid chatflowId format - must be a valid UUID',
        )
      }

      // Flowise 3.0 rejects uploads when the chatflow has no file-handling nodes
      if (!chatflowHasNodes(chatflow.flowData)) {
        return sendError(
          reply,
          500,
          'Error: attachmentService.createAttachment - File upload is not enabled for this chatflow',
        )
      }

      const parts = request.parts()
      const files: UploadedFile[] = []

      try {
        for await (const part of parts) {
          if (part.type === 'file') {
            let size = 0
            for await (const chunk of part.file) {
              size += chunk.length
            }
            files.push(buildUploadedFile(part.filename, size, part.mimetype))
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        const code = message.includes('Too Large') ? 413 : 400
        return sendError(reply, code, message)
      }

      if (files.length === 0) {
        return sendError(reply, 400, 'No files uploaded')
      }

      return reply.code(200).send({
        chatflowId,
        chatId,
        files,
      })
    },
  )
}
