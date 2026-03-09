import { randomUUID } from 'node:crypto'
import type { FastifyReply } from 'fastify'
import { endSSE, initSSE, startKeepAlive, writeSSE } from '../sse/sseWriter.js'
import type { Chatflow } from '../storage/inMemoryStore.js'
import { sleep } from '../utils/sleep.js'
import { getCredentialById } from './credentialService.js'
import { executeFlow } from './flowRunner.js'
import { hasNode } from './nodeRegistry.js'
import type { FlowChain } from './nodes/conversationChain.js'

export interface PredictionResult {
  text: string
  question: string
  chatId: string
  chatMessageId: string
  sessionId: string
  sourceDocuments: unknown[]
  usedTools: unknown[]
  fileAnnotations: unknown[]
  agentReasoning: unknown[]
  memoryType: string | null
}

/** Runtime options passed from the prediction request body. */
export interface PredictionOptions {
  chatId?: string | undefined
  overrideConfig?: Record<string, unknown> | undefined
}

const STUB_TOKEN_DELAY_MS = Math.max(0, Number(process.env.STUB_TOKEN_DELAY_MS ?? 50) || 0)

export function getStubTokenDelayMs(): number {
  return STUB_TOKEN_DELAY_MS
}

export function generateStubResponse(question: string): PredictionResult {
  const text = 'This is a stub response from FlowForge.'
  return {
    text,
    question,
    chatId: randomUUID(),
    chatMessageId: randomUUID(),
    sessionId: randomUUID(),
    sourceDocuments: [],
    usedTools: [],
    fileAnnotations: [],
    agentReasoning: [],
    memoryType: null,
  }
}

export function getStubTokens(): string[] {
  return ['This ', 'is ', 'a ', 'stub ', 'response ', 'from ', 'FlowForge.']
}

/** Extract credential IDs referenced by nodes in the chatflow's flowData. */
export function extractCredentialIds(flowDataJson: string): string[] {
  try {
    const fd = JSON.parse(flowDataJson) as { nodes?: Array<{ data?: { credential?: string } }> }
    if (!fd.nodes) return []
    return fd.nodes.map((n) => n.data?.credential).filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    console.warn('[predictionService] Malformed flowData JSON, cannot extract credential IDs')
    return []
  }
}

/** Validate that all credential IDs exist. Returns the first missing ID, or undefined. */
export function findMissingCredential(credentialIds: string[]): string | undefined {
  return credentialIds.find((id) => !getCredentialById(id))
}

/** Stream an SSE error + end (Flowise error envelope). */
export async function streamError(reply: FastifyReply, message: string): Promise<void> {
  initSSE(reply)
  writeSSE(reply, 'error', message)
  writeSSE(reply, 'end', '[DONE]')
  endSSE(reply)
}

/** Check if all node types in a flowData JSON are supported by the registry. */
export function allNodesSupported(flowDataJson: string): boolean {
  try {
    const fd = JSON.parse(flowDataJson) as { nodes?: Array<{ data?: { name?: string } }> }
    if (!fd.nodes?.length) return false
    return fd.nodes.every((n) => {
      const name = n.data?.name
      return typeof name === 'string' && hasNode(name)
    })
  } catch {
    console.warn('[predictionService] Malformed flowData JSON, cannot check node support')
    return false
  }
}

/** Stream a real LLM prediction response via SSE.
 *  Builds the flow graph, invokes the ending chain, and streams tokens.
 */
async function streamRealPrediction(
  reply: FastifyReply,
  question: string,
  chatflow: Chatflow,
  opts: PredictionOptions = {},
): Promise<void> {
  initSSE(reply)
  const stopKeepAlive = startKeepAlive(reply)

  try {
    const chatId = opts.chatId || randomUUID()
    const chatMessageId = randomUUID()
    // In Flowise, sessionId can come from overrideConfig or defaults to chatId
    const sessionId = (opts.overrideConfig?.sessionId as string) || chatId

    // Merge overrideConfig + sessionId into the flow so memory nodes get the right session
    const overrideConfig: Record<string, unknown> = {
      ...opts.overrideConfig,
      sessionId,
    }

    const { flow, instances } = await executeFlow(chatflow.flowData, overrideConfig)
    const chain = instances.get(flow.endingNode.id) as FlowChain

    if (!chain?.stream) {
      throw new Error('Ending node does not support streaming')
    }

    // 1. start
    writeSSE(reply, 'start', '')

    // 2. stream tokens from real LLM
    const stream = await chain.stream(question)
    for await (const token of stream) {
      if (reply.raw.destroyed) break
      if (token) writeSSE(reply, 'token', token)
    }

    if (!reply.raw.destroyed) {
      // 3. metadata
      writeSSE(
        reply,
        'metadata',
        JSON.stringify({
          chatId,
          chatMessageId,
          sessionId,
          memoryType: null,
        }),
      )

      // 4. end
      writeSSE(reply, 'end', '[DONE]')
    }
  } finally {
    stopKeepAlive()
    endSSE(reply)
  }
}

/** Stream a prediction response via SSE. Owns the full SSE lifecycle.
 *
 *  Flowise event sequence: start → token* → metadata → end
 *  If a credential referenced in the chatflow is missing: error → end
 *
 *  Uses real LLM flow execution when all node types are supported.
 *  Falls back to stub tokens otherwise.
 */
export async function streamPrediction(
  reply: FastifyReply,
  question: string,
  chatflow: Chatflow,
  opts: PredictionOptions = {},
): Promise<void> {
  // Validate credentials before streaming
  const credIds = extractCredentialIds(chatflow.flowData)
  const missing = findMissingCredential(credIds)
  if (missing) {
    return streamError(
      reply,
      'Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.',
    )
  }

  // Try real flow execution if all nodes are supported
  if (allNodesSupported(chatflow.flowData)) {
    try {
      return await streamRealPrediction(reply, question, chatflow, opts)
    } catch (err) {
      // Fall through to stub on flow execution error
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[flowRunner] Real prediction failed, falling back to stub:', msg)
    }
  }

  // Fallback: stub response
  initSSE(reply)
  const stopKeepAlive = startKeepAlive(reply)

  try {
    const result = generateStubResponse(question)
    const tokens = getStubTokens()
    const delayMs = getStubTokenDelayMs()

    // 1. start
    writeSSE(reply, 'start', '')

    // 2. tokens
    for (const token of tokens) {
      if (reply.raw.destroyed) break
      writeSSE(reply, 'token', token)
      if (delayMs > 0) await sleep(delayMs)
    }

    if (!reply.raw.destroyed) {
      // 3. metadata
      writeSSE(
        reply,
        'metadata',
        JSON.stringify({
          chatId: result.chatId,
          chatMessageId: result.chatMessageId,
          sessionId: result.sessionId,
          memoryType: result.memoryType,
        }),
      )

      // 4. end
      writeSSE(reply, 'end', '[DONE]')
    }
  } finally {
    stopKeepAlive()
    endSSE(reply)
  }
}
