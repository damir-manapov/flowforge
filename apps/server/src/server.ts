import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import { registerChatflowRoutes } from './routes/chatflows.js'
import { registerPingRoutes } from './routes/ping.js'
import { registerPredictionRoutes } from './routes/prediction.js'
import { registerAttachmentRoutes } from './routes/attachments.js'

const PORT = Number(process.env['PORT'] ?? 3000)
const HOST = process.env['HOST'] ?? '0.0.0.0'

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  })

  await app.register(fastifyCors, { origin: true })
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  })

  registerPingRoutes(app)
  registerChatflowRoutes(app)
  registerPredictionRoutes(app)
  registerAttachmentRoutes(app)

  return app
}

async function main() {
  const app = await buildServer()

  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`Server listening on ${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
