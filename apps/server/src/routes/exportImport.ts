import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getAllAssistants } from '../storage/assistantStore.js'
import { addCustomTemplate, deleteCustomTemplate, getCustomTemplates } from '../storage/customTemplateStore.js'
import { getAllDocumentStores } from '../storage/documentStoreStore.js'
import { getAllChatflows } from '../storage/inMemoryStore.js'
import { getAllTools } from '../storage/toolStore.js'
import { getAllVariables } from '../storage/variableStore.js'

interface ExportBody {
  agentflow?: boolean
  agentflowv2?: boolean
  assistantCustom?: boolean
  assistantOpenAI?: boolean
  assistantAzure?: boolean
  chatflow?: boolean
  chat_message?: boolean
  chat_feedback?: boolean
  custom_template?: boolean
  document_store?: boolean
  execution?: boolean
  tool?: boolean
  variable?: boolean
}

export function registerExportImportRoutes(app: FastifyInstance): void {
  // ── Export ─────────────────────────────────────────────────────────
  app.post('/api/v1/export-import/export', async (request: FastifyRequest<{ Body: ExportBody }>, reply) => {
    const body = request.body ?? ({} as ExportBody)

    const result: Record<string, unknown> = {
      FileDefaultName: 'ExportData.json',
    }

    // Chatflows (split by type)
    const allChatflows = getAllChatflows()
    if (body.chatflow) {
      result.ChatFlow = allChatflows.filter((cf) => cf.type === 'CHATFLOW')
    } else {
      result.ChatFlow = []
    }
    if (body.agentflow) {
      result.AgentFlow = allChatflows.filter((cf) => cf.type === 'MULTIAGENT')
    } else {
      result.AgentFlow = []
    }
    result.AgentFlowV2 = []

    // Assistants
    result.AssistantCustom = body.assistantCustom ? getAllAssistants() : []
    result.AssistantFlow = []
    result.AssistantOpenAI = body.assistantOpenAI ? [] : []
    result.AssistantAzure = body.assistantAzure ? [] : []

    // Messages & feedback (not persisted yet)
    result.ChatMessage = []
    result.ChatMessageFeedback = []

    // Custom templates (not persisted yet)
    result.CustomTemplate = []

    // Document stores
    result.DocumentStore = body.document_store ? getAllDocumentStores() : []
    result.DocumentStoreFileChunk = []

    // Executions (not persisted yet)
    result.Execution = []

    // Tools & variables
    result.Tool = body.tool ? getAllTools() : []
    result.Variable = body.variable ? getAllVariables() : []

    return reply.code(200).send(result)
  })

  // ── Import ─────────────────────────────────────────────────────────
  app.post('/api/v1/export-import/import', async (request: FastifyRequest, reply) => {
    // Stub: accept the import but don't process it
    // Real implementation would parse the export JSON and insert entities
    const body = request.body

    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ message: 'Request body is required' })
    }

    return reply.code(200).send({ message: 'Import completed' })
  })

  // ── Custom marketplace ─────────────────────────────────────────────

  app.get('/api/v1/marketplaces/custom', async (_request, reply) => {
    return reply.code(200).send(getCustomTemplates())
  })

  app.post('/api/v1/marketplaces/custom', async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
    const { body } = request
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ message: 'Request body is required' })
    }
    const name =
      typeof body.name === 'string' ? body.name : typeof body.templateName === 'string' ? body.templateName : ''
    if (!name) {
      return reply.code(400).send({ message: 'Template name is required' })
    }
    const template = addCustomTemplate({
      templateName: name,
      flowData: typeof body.flowData === 'string' ? body.flowData : JSON.stringify(body.flowData ?? {}),
      description: typeof body.description === 'string' ? body.description : name,
      framework: Array.isArray(body.framework) ? (body.framework as string[]) : [],
      usecases: Array.isArray(body.usecases) ? (body.usecases as string[]) : [],
      type: typeof body.type === 'string' ? body.type : 'Chatflow',
    })
    return reply.code(201).send(template)
  })

  app.delete('/api/v1/marketplaces/custom/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const { id } = request.params
    const deleted = deleteCustomTemplate(id)
    if (!deleted) {
      return reply.code(404).send({ message: `Custom template ${id} not found` })
    }
    return reply.code(200).send({ message: 'Deleted' })
  })

  // ── Chatflow has-changed ───────────────────────────────────────────
  app.get('/api/v1/chatflows/has-changed/:id', async (_request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    // Stub: always return false (no change detection yet)
    return reply.code(200).send({ hasChanged: false })
  })
}
