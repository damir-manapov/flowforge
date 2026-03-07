import { randomUUID } from 'node:crypto'
import {
  type Assistant,
  deleteAssistant as deleteFromStore,
  getAssistantById,
  setAssistant,
} from '../storage/assistantStore.js'

export type { Assistant } from '../storage/assistantStore.js'
export { clearAssistantStore, getAllAssistants, getAssistantById } from '../storage/assistantStore.js'

interface AssistantInput {
  details: string
  credential: string
  iconSrc?: string | null
}

function now(): string {
  return new Date().toISOString()
}

/**
 * Create an assistant (local persistence only — no OpenAI API call).
 * In Flowise, this would call openai.beta.assistants.create() and store
 * the returned assistant ID back into details. We skip that for now.
 */
export function createAssistant(input: AssistantInput): Assistant {
  const id = randomUUID()
  const timestamp = now()

  const assistant: Assistant = {
    id,
    details: input.details,
    credential: input.credential,
    iconSrc: input.iconSrc ?? null,
    createdDate: timestamp,
    updatedDate: timestamp,
  }

  setAssistant(assistant)
  return assistant
}

export function updateAssistant(id: string, input: Partial<AssistantInput>): Assistant | undefined {
  const existing = getAssistantById(id)
  if (!existing) return undefined

  const updated: Assistant = {
    ...existing,
    details: input.details ?? existing.details,
    credential: input.credential ?? existing.credential,
    iconSrc: input.iconSrc !== undefined ? input.iconSrc : existing.iconSrc,
    updatedDate: now(),
  }

  setAssistant(updated)
  return updated
}

export function deleteAssistant(id: string): { raw: unknown[]; affected: number } {
  const deleted = deleteFromStore(id)
  return { raw: [], affected: deleted ? 1 : 0 }
}
