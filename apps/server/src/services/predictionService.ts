import { randomUUID } from 'node:crypto'
import type { FastifyReply } from 'fastify'
import { endSSE, initSSE, startKeepAlive, writeSSE } from '../sse/sseWriter.js'
import type { Chatflow } from '../storage/inMemoryStore.js'
import { sleep } from '../utils/sleep.js'
import { getCredentialById } from './credentialService.js'

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

/** Stream a stub prediction response via SSE. Owns the full SSE lifecycle.
 *
 *  Flowise event sequence: start → token* → metadata → end
 *  If a credential referenced in the chatflow is missing: error → end
 */
export async function streamPrediction(reply: FastifyReply, question: string, chatflow: Chatflow): Promise<void> {
  // Validate credentials before streaming
  const credIds = extractCredentialIds(chatflow.flowData)
  const missing = findMissingCredential(credIds)
  if (missing) {
    return streamError(
      reply,
      'Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.',
    )
  }

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
