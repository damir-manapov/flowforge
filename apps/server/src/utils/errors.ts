import type { FastifyReply } from 'fastify'

/**
 * Send an error response matching Flowise's InternalFlowiseError shape:
 * `{ statusCode, success: false, message, stack: {} }`
 */
export function sendError(reply: FastifyReply, statusCode: number, message: string): FastifyReply {
  return reply.code(statusCode).send({
    statusCode,
    success: false,
    message,
    stack: {},
  })
}
