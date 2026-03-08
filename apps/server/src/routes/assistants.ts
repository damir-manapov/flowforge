import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  createAssistant,
  deleteAssistant,
  getAllAssistants,
  getAssistantById,
  updateAssistant,
} from '../services/assistantService.js'
import { sendError } from '../utils/errors.js'
import { type PaginationQuery, paginate } from '../utils/pagination.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

interface AssistantBody {
  details: string
  credential: string
  iconSrc?: string | null
}

interface AssistantListQuery extends PaginationQuery {
  type?: string | undefined
}

export function registerAssistantRoutes(app: FastifyInstance): void {
  app.get('/api/v1/assistants', async (request: FastifyRequest<{ Querystring: AssistantListQuery }>, reply) => {
    let assistants = getAllAssistants()
    const query = request.query as AssistantListQuery

    // Filter by type (CUSTOM, OPENAI, AZURE) if specified
    if (query.type) {
      assistants = assistants.filter((a) => {
        try {
          const details = JSON.parse(a.details || '{}') as { type?: string }
          return details.type === query.type
        } catch {
          return false
        }
      })
    }

    return reply.code(200).send(paginate(assistants, query))
  })

  app.get('/api/v1/assistants/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid assistant id format: ${id}`)
    }

    const assistant = getAssistantById(id)

    if (!assistant) {
      return sendError(reply, 404, `Assistant ${id} not found`)
    }

    return reply.code(200).send(assistant)
  })

  app.post('/api/v1/assistants', async (request: FastifyRequest, reply) => {
    const body = request.body as AssistantBody | null

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.details || typeof body.details !== 'string') {
      return sendError(reply, 400, 'Details is required')
    }

    const assistant = createAssistant({
      details: body.details,
      credential: body.credential ?? '',
      iconSrc: body.iconSrc ?? null,
    })
    return reply.code(200).send(assistant)
  })

  app.put('/api/v1/assistants/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params
    const body = request.body as Partial<AssistantBody> | null

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid assistant id format: ${id}`)
    }

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    const updated = updateAssistant(id, body)

    if (!updated) {
      return sendError(reply, 404, `Assistant ${id} not found`)
    }

    return reply.code(200).send(updated)
  })

  app.delete('/api/v1/assistants/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    const result = deleteAssistant(id)
    return reply.code(200).send(result)
  })
}
