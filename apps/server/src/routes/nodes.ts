import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { resolveFirstLoadMethod, resolveLoadMethod } from '../services/nodeLoadMethods.js'

// data/nodes.json lives at apps/server/data/nodes.json (outside src/)
// In dev: __dirname = apps/server/src/routes → ../../data
// In prod: __dirname = apps/server/dist/routes → ../../data
const __dirname = dirname(fileURLToPath(import.meta.url))
const nodesPath = resolve(__dirname, '..', '..', 'data', 'nodes.json')

let nodesCache: unknown[] | undefined

function loadNodes(): unknown[] {
  if (!nodesCache) {
    const raw = readFileSync(nodesPath, 'utf-8')
    nodesCache = JSON.parse(raw) as unknown[]
  }
  return nodesCache
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

  // Node load methods — resolves model lists, region lists, etc. via the
  // modelLoader service and nodeLoadMethods registry, mirroring how each
  // Flowise node class defines its own loadMethods.
  app.post(
    '/api/v1/node-load-method/:name',
    async (request: FastifyRequest<{ Params: IconParams; Body: { loadMethod?: string } }>, reply) => {
      const { name } = request.params
      const loadMethod = (request.body as { loadMethod?: string } | undefined)?.loadMethod
      const nodesData = loadNodes()

      // Try exact match: nodeName + methodName
      if (loadMethod) {
        const method = resolveLoadMethod(name, loadMethod)
        if (method) {
          return reply.code(200).send(method(nodesData))
        }
      }

      // Fallback: first registered method for this node
      const fallback = resolveFirstLoadMethod(name)
      if (fallback) {
        return reply.code(200).send(fallback(nodesData))
      }

      // No registry entry at all — return empty array
      return reply.code(200).send([])
    },
  )
}
