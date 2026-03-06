import type { FastifyReply } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { endSSE, initSSE, startKeepAlive, writeSSE } from '../sse/sseWriter.js'
import { sleep } from '../utils/sleep.js'

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

export function getStubTokenDelayMs(): number {
  return Number(process.env.STUB_TOKEN_DELAY_MS ?? 50)
}

export function generateStubResponse(question: string): PredictionResult {
  const text = 'This is a stub response from FlowForge.'
  return {
    text,
    question,
    chatId: uuidv4(),
    chatMessageId: uuidv4(),
    sessionId: uuidv4(),
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

/** Stream a stub prediction response via SSE. Owns the full SSE lifecycle. */
export async function streamPrediction(reply: FastifyReply, question: string): Promise<void> {
  initSSE(reply)
  const stopKeepAlive = startKeepAlive(reply)

  try {
    const tokens = getStubTokens()
    const delayMs = getStubTokenDelayMs()

    for (const token of tokens) {
      if (reply.raw.destroyed) break
      writeSSE(reply, 'token', token)
      if (delayMs > 0) await sleep(delayMs)
    }

    if (!reply.raw.destroyed) {
      const result = generateStubResponse(question)
      const endPayload = JSON.stringify({
        chatId: result.chatId,
        chatMessageId: result.chatMessageId,
        text: tokens.join(''),
        question,
        sessionId: result.sessionId,
      })
      writeSSE(reply, 'end', endPayload)
    }
  } finally {
    stopKeepAlive()
    endSSE(reply)
  }
}
