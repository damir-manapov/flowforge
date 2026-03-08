import { randomUUID } from 'node:crypto'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError } from 'fastify'
import { registerApiKeyRoutes } from './routes/apikeys.js'
import { registerAssistantRoutes } from './routes/assistants.js'
import { registerAttachmentRoutes } from './routes/attachments.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerChatflowRoutes } from './routes/chatflows.js'
import { registerCredentialRoutes } from './routes/credentials.js'
import { registerDocumentStoreRoutes } from './routes/documentStores.js'
import { registerNodeRoutes } from './routes/nodes.js'
import { registerPingRoutes } from './routes/ping.js'
import { registerPredictionRoutes } from './routes/prediction.js'
import { registerToolRoutes } from './routes/tools.js'
import { registerUserRoutes } from './routes/users.js'
import { registerVariableRoutes } from './routes/variables.js'

function parseCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN
  if (!raw || raw === '*') return true
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (origins.length === 0) return true
  return origins.length === 1 ? (origins[0] as string) : origins
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

  // Flowise has no rate limiting; keep a generous default to avoid
  // throttling test suites while still providing basic DoS protection.
  const rateMax = Number(process.env.RATE_LIMIT_MAX ?? 0)
  if (rateMax > 0) {
    await app.register(fastifyRateLimit, {
      max: rateMax,
      timeWindow: '1 minute',
    })
  }
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  })

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const code = error.statusCode ?? 500
    if (code >= 500) {
      request.log.error(error)
    }
    const msg = error.message ?? 'Something went wrong'
    reply.status(code).send({
      statusCode: code,
      error: code < 500 ? msg : 'Internal Server Error',
      message: code < 500 ? msg : 'Something went wrong',
    })
  })

  registerPingRoutes(app)
  registerAuthRoutes(app)
  registerUserRoutes(app)
  registerChatflowRoutes(app)
  registerPredictionRoutes(app)
  registerAttachmentRoutes(app)
  registerNodeRoutes(app)
  registerCredentialRoutes(app)
  registerVariableRoutes(app)
  registerApiKeyRoutes(app)
  registerToolRoutes(app)
  registerAssistantRoutes(app)
  registerDocumentStoreRoutes(app)

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    })
  })

  return app
}
