import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  createCredential,
  deleteCredential,
  getAllCredentials,
  getCredentialWithPlainData,
  updateCredential,
} from '../services/credentialService.js'
import { sendError } from '../utils/errors.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

interface NameParams {
  name: string
}

interface CredentialBody {
  name: string
  credentialName: string
  plainDataObj?: Record<string, unknown>
}

// ── Static components-credentials catalog ────────────────────────────

interface CredentialType {
  label: string
  name: string
  version: number
  description?: string
  optional?: boolean
  inputs?: Array<{ name: string; type: string; label: string; [k: string]: unknown }>
  icon?: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
let credentialTypesCache: CredentialType[] | undefined

function loadCredentialTypes(): CredentialType[] {
  if (credentialTypesCache) return credentialTypesCache
  const filePath = resolve(__dirname, '..', '..', 'data', 'components-credentials.json')
  credentialTypesCache = JSON.parse(readFileSync(filePath, 'utf-8')) as CredentialType[]
  return credentialTypesCache
}

// ── Route registration ───────────────────────────────────────────────

export function registerCredentialRoutes(app: FastifyInstance): void {
  // ── Credentials CRUD ───────────────────────────────────────────────

  app.get(
    '/api/v1/credentials',
    async (request: FastifyRequest<{ Querystring: { credentialName?: string } }>, reply) => {
      let credentials = getAllCredentials()

      const { credentialName } = request.query as { credentialName?: string }
      if (credentialName) {
        credentials = credentials.filter((c) => c.credentialName === credentialName)
      }

      return reply.code(200).send(credentials)
    },
  )

  app.get('/api/v1/credentials/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid credential id format: ${id}`)
    }

    const credentialTypes = loadCredentialTypes()
    const credential = getCredentialWithPlainData(id, credentialTypes)

    if (!credential) {
      return sendError(reply, 404, `Credential ${id} not found`)
    }

    return reply.code(200).send(credential)
  })

  app.post('/api/v1/credentials', async (request: FastifyRequest, reply) => {
    const body = request.body as CredentialBody | null

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return sendError(reply, 400, 'Name is required')
    }

    if (!body.credentialName || typeof body.credentialName !== 'string') {
      return sendError(reply, 400, 'Credential name is required')
    }

    const credential = createCredential(body)
    return reply.code(200).send(credential)
  })

  app.put('/api/v1/credentials/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params
    const body = request.body as CredentialBody | null

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid credential id format: ${id}`)
    }

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    const updated = updateCredential(id, body)

    if (!updated) {
      return sendError(reply, 404, `Credential ${id} not found`)
    }

    return reply.code(200).send(updated)
  })

  app.delete('/api/v1/credentials/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid credential id format: ${id}`)
    }

    const result = deleteCredential(id)
    return reply.code(200).send(result)
  })

  // ── Components-credentials catalog ─────────────────────────────────

  app.get('/api/v1/components-credentials', async (_request: FastifyRequest, reply) => {
    const types = loadCredentialTypes()
    return reply.code(200).send(types)
  })

  app.get('/api/v1/components-credentials/:name', async (request: FastifyRequest<{ Params: NameParams }>, reply) => {
    const { name } = request.params
    const types = loadCredentialTypes()
    const found = types.find((t) => t.name === name)

    if (!found) {
      return sendError(reply, 404, `Credential component ${name} not found`)
    }

    return reply.code(200).send(found)
  })

  app.get(
    '/api/v1/components-credentials-icon/:name',
    async (_request: FastifyRequest<{ Params: NameParams }>, reply) => {
      // Stub: icons not served yet (same as node-icon)
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Icon not available' })
    },
  )
}
