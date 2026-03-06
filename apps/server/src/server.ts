import { randomUUID } from 'node:crypto'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { registerAttachmentRoutes } from './routes/attachments.js'
import { registerChatflowRoutes } from './routes/chatflows.js'
import { registerPingRoutes } from './routes/ping.js'
import { registerPredictionRoutes } from './routes/prediction.js'

function parseCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN
  if (!raw || raw === '*') return true
  const origins = raw.split(',').map((s) => s.trim())
  return origins.length === 1 ? (origins[0] ?? true) : origins
}

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    bodyLimit: Number(process.env.BODY_LIMIT ?? 2 * 1024 * 1024),
    genReqId: () => randomUUID(),
  })

  await app.register(fastifyCors, { origin: parseCorsOrigin() })
  await app.register(fastifyRateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 200),
    timeWindow: '1 minute',
  })
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  })

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    })
  })

  registerPingRoutes(app)
  registerChatflowRoutes(app)
  registerPredictionRoutes(app)
  registerAttachmentRoutes(app)

  return app
}
