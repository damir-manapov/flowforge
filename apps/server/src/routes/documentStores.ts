import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  createDocumentStore,
  deleteDocumentStore,
  getAllDocumentStores,
  getDocumentStoreWithTotals,
  updateDocumentStore,
} from '../services/documentStoreService.js'
import { sendError } from '../utils/errors.js'
import { type PaginationQuery, paginate } from '../utils/pagination.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

interface DocumentStoreBody {
  name: string
  description?: string
}

// ── Static marketplace templates ─────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
let templatesCache: unknown[] | undefined

function loadTemplates(): unknown[] {
  if (templatesCache) return templatesCache
  const filePath = resolve(__dirname, '..', '..', 'data', 'marketplace-templates.json')
  templatesCache = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown[]
  return templatesCache
}

// ── Route registration ───────────────────────────────────────────────

export function registerDocumentStoreRoutes(app: FastifyInstance): void {
  // ── Document Store CRUD ────────────────────────────────────────────

  app.get('/api/v1/document-store/store', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    const stores = getAllDocumentStores()
    return reply.code(200).send(paginate(stores, request.query))
  })

  app.get('/api/v1/document-store/store/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid document store id format: ${id}`)
    }

    const store = getDocumentStoreWithTotals(id)

    if (!store) {
      return sendError(reply, 500, `Error: documentStoreServices.getDocumentStoreById - Document store ${id} not found`)
    }

    return reply.code(200).send(store)
  })

  app.post('/api/v1/document-store/store', async (request: FastifyRequest<{ Body: DocumentStoreBody }>, reply) => {
    const { body } = request

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.name || typeof body.name !== 'string') {
      return sendError(reply, 400, 'Name is required')
    }

    const store = createDocumentStore(body)
    return reply.code(200).send(store)
  })

  app.put(
    '/api/v1/document-store/store/:id',
    async (request: FastifyRequest<{ Params: IdParams; Body: Partial<DocumentStoreBody> }>, reply) => {
      const { id } = request.params
      const { body } = request

      if (!isValidUUID(id)) {
        return sendError(reply, 400, `Invalid document store id format: ${id}`)
      }

      if (!body || typeof body !== 'object') {
        return sendError(reply, 400, 'Request body is required')
      }

      const updated = updateDocumentStore(id, body)

      if (!updated) {
        return sendError(reply, 404, `Document store ${id} not found`)
      }

      return reply.code(200).send(updated)
    },
  )

  app.delete('/api/v1/document-store/store/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid document store id format: ${id}`)
    }

    const result = deleteDocumentStore(id)

    if (!result) {
      return sendError(reply, 500, `Error: documentStoreServices.deleteDocumentStore - Document store ${id} not found`)
    }

    return reply.code(200).send(result)
  })

  // ── Upsert History ─────────────────────────────────────────────────

  app.get('/api/v1/upsert-history/:id', async (_request: FastifyRequest<{ Params: IdParams }>, reply) => {
    // Stub: always return empty array
    return reply.code(200).send([])
  })

  // ── Marketplace Templates ──────────────────────────────────────────

  app.get('/api/v1/marketplaces/templates', async (_request: FastifyRequest, reply) => {
    const templates = loadTemplates()
    return reply.code(200).send(templates)
  })
}
