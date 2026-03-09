/**
 * Dataset CRUD endpoints for the evaluation system.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { DatasetItem } from '../storage/datasetStore.js'
import { addDatasetItems, createDataset, deleteDataset, getAllDatasets, getDataset } from '../storage/datasetStore.js'

interface IdParams {
  id: string
}

interface CreateBody {
  name: string
  description?: string
  items?: DatasetItem[]
}

interface AddItemsBody {
  items: DatasetItem[]
}

export function registerDatasetRoutes(app: FastifyInstance): void {
  app.get('/api/v1/datasets', async (_request, reply) => {
    return reply.code(200).send(getAllDatasets())
  })

  app.get('/api/v1/datasets/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const dataset = getDataset(request.params.id)
    if (!dataset) {
      return reply.code(404).send({ message: `Dataset ${request.params.id} not found` })
    }
    return reply.code(200).send(dataset)
  })

  app.post('/api/v1/datasets', async (request: FastifyRequest<{ Body: CreateBody }>, reply) => {
    const { body } = request
    if (!body?.name) {
      return reply.code(400).send({ message: 'name is required' })
    }
    const dataset = createDataset({
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.items !== undefined ? { items: body.items } : {}),
    })
    return reply.code(201).send(dataset)
  })

  app.post(
    '/api/v1/datasets/:id/items',
    async (request: FastifyRequest<{ Params: IdParams; Body: AddItemsBody }>, reply) => {
      const { body } = request
      if (!Array.isArray(body?.items)) {
        return reply.code(400).send({ message: 'items array is required' })
      }
      const dataset = addDatasetItems(request.params.id, body.items)
      if (!dataset) {
        return reply.code(404).send({ message: `Dataset ${request.params.id} not found` })
      }
      return reply.code(200).send(dataset)
    },
  )

  app.delete('/api/v1/datasets/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const deleted = deleteDataset(request.params.id)
    if (!deleted) {
      return reply.code(404).send({ message: `Dataset ${request.params.id} not found` })
    }
    return reply.code(200).send({ message: 'Deleted' })
  })
}
