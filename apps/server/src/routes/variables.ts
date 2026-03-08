import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createVariable, deleteVariable, getAllVariables, updateVariable } from '../services/variableService.js'
import { sendError } from '../utils/errors.js'
import { type PaginationQuery, paginate } from '../utils/pagination.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

interface VariableBody {
  name: string
  value?: string
  type?: string
}

export function registerVariableRoutes(app: FastifyInstance): void {
  app.get('/api/v1/variables', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    const variables = getAllVariables()
    return reply.code(200).send(paginate(variables, request.query as PaginationQuery))
  })

  app.post('/api/v1/variables', async (request: FastifyRequest, reply) => {
    const body = request.body as VariableBody | null

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return sendError(reply, 400, 'Name is required')
    }

    const variable = createVariable(body)
    return reply.code(200).send(variable)
  })

  app.put('/api/v1/variables/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params
    const body = request.body as Partial<VariableBody> | null

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid variable id format: ${id}`)
    }

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    const updated = updateVariable(id, body)

    if (!updated) {
      return sendError(reply, 404, `Variable ${id} not found`)
    }

    return reply.code(200).send(updated)
  })

  app.delete('/api/v1/variables/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 400, `Invalid variable id format: ${id}`)
    }

    const result = deleteVariable(id)
    return reply.code(200).send(result)
  })
}
