import { randomUUID } from 'node:crypto'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyError } from 'fastify'
import { getAuthenticatedUserId, isPublicRoute } from './middleware/auth.js'
import { registerApiKeyRoutes } from './routes/apikeys.js'
import { registerAssistantRoutes } from './routes/assistants.js'
import { registerAttachmentRoutes } from './routes/attachments.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerChatflowRoutes } from './routes/chatflows.js'
import { registerCredentialRoutes } from './routes/credentials.js'
import { registerDatasetRoutes } from './routes/datasets.js'
import { registerDocumentStoreRoutes } from './routes/documentStores.js'
import { registerEvaluationRoutes } from './routes/evaluations.js'
import { registerExportImportRoutes } from './routes/exportImport.js'
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
    // Match Express behaviour: normalise /ping/ → /ping and //ping → /ping
    routerOptions: {
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
    },
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

  // Accept unknown content types (e.g. text/xml) so requests reach route
  // handlers instead of being rejected with 415 by Fastify's built-in
  // content-type parser.  Flowise (Express) never rejects on content type —
  // the request reaches the handler where graph validation returns 500.
  app.addContentTypeParser('*', (_request, payload, done) => {
    let data = ''
    payload.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })
    payload.on('end', () => {
      try {
        done(null, data ? JSON.parse(data) : null)
      } catch {
        // Not valid JSON — pass raw string so handler gets *something*
        done(null, data)
      }
    })
  })

  // ── Auth middleware ──────────────────────────────────────────────
  // Enforce session-cookie auth on all protected routes.
  // Public routes (ping, login, register, prediction) bypass this hook.
  app.addHook('onRequest', async (request, reply) => {
    if (isPublicRoute(request.method, request.url)) return

    const userId = getAuthenticatedUserId(request.headers.cookie)
    if (!userId) {
      reply.status(401).send({ message: 'Invalid or Missing token' })
      return
    }
  })

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const code = error.statusCode ?? 500
    if (code >= 500) {
      request.log.error(error)
    }
    // Match Flowise InternalFlowiseError shape: { statusCode, success, message, stack }
    const msg = error.message ?? 'Something went wrong'
    reply.status(code).send({
      statusCode: code,
      success: false,
      message: msg,
      stack: {},
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
  registerExportImportRoutes(app)
  registerDatasetRoutes(app)
  registerEvaluationRoutes(app)

  // Flowise (Express) serves index.html for any unknown GET route (SPA
  // fallback).  Match that behaviour so compat tests see the same 200.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET') {
      reply
        .status(200)
        .type('text/html')
        .send('<!DOCTYPE html><html><head><title>FlowForge</title></head><body></body></html>')
      return
    }
    reply.status(404).send({
      statusCode: 404,
      success: false,
      message: 'Route not found',
      stack: {},
    })
  })

  return app
}
