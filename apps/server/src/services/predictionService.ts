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

export function generateStubResponse(question: string): string {
  return `This is a stub response from FlowForge for: ${question}`
}
