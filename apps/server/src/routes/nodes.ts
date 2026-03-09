import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance, FastifyRequest } from 'fastify'

// data/nodes.json lives at apps/server/data/nodes.json (outside src/)
// In dev: __dirname = apps/server/src/routes → ../../data
// In prod: __dirname = apps/server/dist/routes → ../../data
const __dirname = dirname(fileURLToPath(import.meta.url))
const nodesPath = resolve(__dirname, '..', '..', 'data', 'nodes.json')
const loadMethodsPath = resolve(__dirname, '..', '..', 'data', 'node-load-methods.json')

let nodesCache: unknown[] | undefined

function loadNodes(): unknown[] {
  if (!nodesCache) {
    const raw = readFileSync(nodesPath, 'utf-8')
    nodesCache = JSON.parse(raw) as unknown[]
  }
  return nodesCache
}

let loadMethodsCache: Record<string, unknown[]> | undefined

function loadMethodsData(): Record<string, unknown[]> {
  if (!loadMethodsCache) {
    const raw = readFileSync(loadMethodsPath, 'utf-8')
    loadMethodsCache = JSON.parse(raw) as Record<string, unknown[]>
  }
  return loadMethodsCache
}

interface IconParams {
  name: string
}

export function registerNodeRoutes(app: FastifyInstance): void {
  app.get('/api/v1/nodes', async (_request: FastifyRequest, reply) => {
    const nodes = loadNodes()
    return reply.code(200).send(nodes)
  })

  app.get('/api/v1/node-icon/:name', async (request: FastifyRequest<{ Params: IconParams }>, reply) => {
    const nodes = loadNodes() as Array<{ name: string; icon?: string }>
    const node = nodes.find((n) => n.name === request.params.name)
    if (!node?.icon) {
      return reply
        .code(404)
        .send({ statusCode: 404, error: 'Not Found', message: `Icon ${request.params.name} not found` })
    }

    // Serve a minimal placeholder SVG.  Real Flowise reads the file from
    // flowise-components; we don't ship those assets so return a stub.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#ccc"/></svg>`
    return reply.code(200).type('image/svg+xml').send(svg)
  })

  // Serves pre-captured load-method results (model lists, region lists, etc.)
  // keyed by "{nodeName}/{methodName}" in data/node-load-methods.json.
  // Dynamic methods that depend on user context (listFlows, listStores, etc.)
  // return empty arrays when no data is available.
  app.post(
    '/api/v1/node-load-method/:name',
    async (request: FastifyRequest<{ Params: IconParams; Body: { loadMethod?: string } }>, reply) => {
      const { name } = request.params
      const loadMethod = (request.body as { loadMethod?: string } | undefined)?.loadMethod
      const methods = loadMethodsData()

      // Try exact match: nodeName/methodName
      if (loadMethod) {
        const key = `${name}/${loadMethod}`
        const result = methods[key]
        if (result) {
          return reply.code(200).send(result)
        }
      }

      // Fallback: find any entry for this node
      const prefix = `${name}/`
      for (const [key, value] of Object.entries(methods)) {
        if (key.startsWith(prefix)) {
          return reply.code(200).send(value)
        }
      }

      // No data at all — return empty array
      return reply.code(200).send([])
    },
  )
}
