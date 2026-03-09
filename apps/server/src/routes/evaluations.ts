/**
 * Evaluation CRUD endpoints.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { ComparisonStrategy } from '../services/evaluationRunner.js'
import { runEvaluation } from '../services/evaluationRunner.js'
import { deleteEvaluation, getAllEvaluations, getEvaluation } from '../storage/evaluationStore.js'

interface IdParams {
  id: string
}

interface StartBody {
  datasetId: string
  chatflowId: string
  strategy?: ComparisonStrategy
}

export function registerEvaluationRoutes(app: FastifyInstance): void {
  app.get('/api/v1/evaluations', async (_request, reply) => {
    return reply.code(200).send(getAllEvaluations())
  })

  app.get('/api/v1/evaluations/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const run = getEvaluation(request.params.id)
    if (!run) {
      return reply.code(404).send({ message: `Evaluation ${request.params.id} not found` })
    }
    return reply.code(200).send(run)
  })

  app.post('/api/v1/evaluations', async (request: FastifyRequest<{ Body: StartBody }>, reply) => {
    const { body } = request
    if (!body?.datasetId || !body?.chatflowId) {
      return reply.code(400).send({ message: 'datasetId and chatflowId are required' })
    }

    try {
      const run = await runEvaluation({
        datasetId: body.datasetId,
        chatflowId: body.chatflowId,
        ...(body.strategy !== undefined ? { strategy: body.strategy } : {}),
      })
      return reply.code(201).send(run)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.code(400).send({ message })
    }
  })

  app.delete('/api/v1/evaluations/:id', async (request: FastifyRequest<{ Params: IdParams }>, reply) => {
    const deleted = deleteEvaluation(request.params.id)
    if (!deleted) {
      return reply.code(404).send({ message: `Evaluation ${request.params.id} not found` })
    }
    return reply.code(200).send({ message: 'Deleted' })
  })
}
