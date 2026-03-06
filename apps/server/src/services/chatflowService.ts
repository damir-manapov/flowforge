import { randomUUID } from 'node:crypto'
import {
  type Chatflow,
  deleteChatflow as deleteFromStore,
  getChatflowById,
  oldestKey,
  setChatflow,
  storeSize,
} from '../storage/inMemoryStore.js'

export type { Chatflow } from '../storage/inMemoryStore.js'
export { clearStore, getAllChatflows, getChatflowById } from '../storage/inMemoryStore.js'

const MAX_STORE_SIZE = Math.max(1, Number(process.env.MAX_CHATFLOWS ?? 10_000) || 10_000)

function now(): string {
  return new Date().toISOString()
}

/** Create a chatflow with domain defaults and bounded-store eviction. */
export function createChatflow(data: Partial<Chatflow>, log?: { warn: (msg: string) => void }): Chatflow {
  if (storeSize() >= MAX_STORE_SIZE) {
    const evictKey = oldestKey()
    if (evictKey) {
      deleteFromStore(evictKey)
      log?.warn(`Store full (max=${MAX_STORE_SIZE}), evicted chatflow ${evictKey}`)
    }
  }

  const id = randomUUID()
  const timestamp = now()

  const chatflow: Chatflow = {
    id,
    name: data.name ?? '',
    flowData: data.flowData ?? '{}',
    deployed: data.deployed ?? false,
    isPublic: data.isPublic ?? false,
    apikeyid: data.apikeyid ?? '',
    chatbotConfig: data.chatbotConfig ?? null,
    apiConfig: data.apiConfig ?? null,
    analytic: data.analytic ?? null,
    speechToText: data.speechToText ?? null,
    category: data.category ?? null,
    type: data.type ?? 'CHATFLOW',
    createdDate: timestamp,
    updatedDate: timestamp,
  }

  setChatflow(chatflow)
  return chatflow
}

/** Update a chatflow, protecting immutable fields (id, createdDate). */
export function updateChatflow(id: string, data: Partial<Chatflow>): Chatflow | undefined {
  const existing = getChatflowById(id)
  if (!existing) return undefined

  const { id: _id, createdDate: _cd, ...safeData } = data
  const updated: Chatflow = {
    ...existing,
    ...safeData,
    id,
    createdDate: existing.createdDate,
    updatedDate: now(),
  }

  setChatflow(updated)
  return updated
}

export function deleteChatflow(id: string): boolean {
  return deleteFromStore(id)
}
