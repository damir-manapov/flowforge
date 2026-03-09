import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createTool, deleteTool, getAllTools, getToolById, updateTool } from '../services/toolService.js'
import { sendError } from '../utils/errors.js'
import { type PaginationQuery, paginate } from '../utils/pagination.js'
import { isValidUUID } from '../utils/validation.js'

interface IdParams {
  id: string
}

interface ToolBody {
  name: string
  description?: string
  color?: string
  iconSrc?: string | null
  schema?: string | null
  func?: string | null
}

export function registerToolRoutes(app: FastifyInstance): void {
  app.get('/api/v1/tools', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    const tools = getAllTools()
    return reply.code(200).send(paginate(tools, request.query))
  })

  app.get('/api/v1/tools/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    if (!isValidUUID(id)) {
      return sendError(reply, 500, `Error: toolsService.getToolById - Tool ${id} not found`)
    }

    const tool = getToolById(id)

    if (!tool) {
      return sendError(reply, 500, `Error: toolsService.getToolById - Tool ${id} not found`)
    }

    return reply.code(200).send(tool)
  })

  app.post('/api/v1/tools', async (request: FastifyRequest<{ Body: ToolBody }>, reply) => {
    const { body } = request

    if (!body || typeof body !== 'object') {
      return sendError(reply, 400, 'Request body is required')
    }

    if (!body.name || typeof body.name !== 'string') {
      return sendError(reply, 400, 'Name is required')
    }

    const tool = createTool({
      name: body.name,
      description: body.description ?? '',
      color: body.color ?? '#000',
      iconSrc: body.iconSrc ?? null,
      schema: body.schema ?? null,
      func: body.func ?? null,
    })
    return reply.code(200).send(tool)
  })

  app.put(
    '/api/v1/tools/:id',
    async (request: FastifyRequest<{ Params: IdParams; Body: Partial<ToolBody> }>, reply) => {
      const { id } = request.params
      const { body } = request

      if (!isValidUUID(id)) {
        return sendError(reply, 400, `Invalid tool id format: ${id}`)
      }

      if (!body || typeof body !== 'object') {
        return sendError(reply, 400, 'Request body is required')
      }

      const updated = updateTool(id, body)

      if (!updated) {
        return sendError(reply, 404, `Tool ${id} not found`)
      }

      return reply.code(200).send(updated)
    },
  )

  app.delete('/api/v1/tools/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const { id } = request.params

    // Flowise always returns 200 with affected count, even for invalid IDs
    const result = deleteTool(id)
    return reply.code(200).send(result)
  })
}
