import type { FastifyReply } from 'fastify'

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  413: 'Payload Too Large',
  500: 'Internal Server Error',
}

export function sendError(reply: FastifyReply, statusCode: number, message: string): FastifyReply {
  return reply.code(statusCode).send({
    statusCode,
    error: STATUS_TEXT[statusCode] ?? 'Error',
    message,
  })
}
