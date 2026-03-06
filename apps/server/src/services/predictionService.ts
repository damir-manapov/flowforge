import { v4 as uuidv4 } from 'uuid'
import type { Chatflow } from '../storage/inMemoryStore.js'
import { getChatflowById } from '../storage/inMemoryStore.js'

export interface PredictionInput {
  question: string
  streaming: boolean
  overrideConfig?: Record<string, unknown> | undefined
  history?: unknown[] | undefined
}

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

const STUB_TOKEN_DELAY_MS = Number(process.env.STUB_TOKEN_DELAY_MS ?? 50)

export function getStubTokenDelayMs(): number {
  return STUB_TOKEN_DELAY_MS
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

export function lookupChatflow(flowId: string): Chatflow | undefined {
  return getChatflowById(flowId)
}

export function getStubTokens(): string[] {
  return ['This ', 'is ', 'a ', 'stub ', 'response ', 'from ', 'FlowForge.']
}
