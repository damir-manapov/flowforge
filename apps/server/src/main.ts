import { buildServer } from './server.js'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

async function main() {
  const app = await buildServer()

  try {
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`Server listening on ${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  let closing = false
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      if (closing) return
      closing = true
      app.log.info(`Received ${signal}, shutting down`)
      await app.close()
      process.exit(0)
    })
  }
}

main()
