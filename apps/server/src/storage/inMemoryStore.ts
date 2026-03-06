import { v4 as uuidv4 } from 'uuid'

export interface Chatflow {
  id: string
  name: string
  flowData: string
  deployed: boolean
  isPublic: boolean
  apikeyid: string
  chatbotConfig: string | null
  apiConfig: string | null
  analytic: string | null
  speechToText: string | null
  category: string | null
  type: string
  createdDate: string
  updatedDate: string
}

const store = new Map<string, Chatflow>()

function now(): string {
  return new Date().toISOString()
}

export function getAllChatflows(): Chatflow[] {
  return Array.from(store.values())
}

export function getChatflowById(id: string): Chatflow | undefined {
  return store.get(id)
}

const MAX_STORE_SIZE = Math.max(1, Number(process.env.MAX_CHATFLOWS ?? 10_000) || 10_000)

export function createChatflow(data: Partial<Chatflow>, log?: { warn: (msg: string) => void }): Chatflow {
  if (store.size >= MAX_STORE_SIZE) {
    const oldestKey = store.keys().next().value
    if (oldestKey) {
      store.delete(oldestKey)
      log?.warn(`Store full (max=${MAX_STORE_SIZE}), evicted chatflow ${oldestKey}`)
    }
  }

  const id = uuidv4()
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

  store.set(id, chatflow)
  return chatflow
}

export function updateChatflow(id: string, data: Partial<Chatflow>): Chatflow | undefined {
  const existing = store.get(id)
  if (!existing) return undefined

  const { id: _id, createdDate: _cd, ...safeData } = data
  const updated: Chatflow = {
    ...existing,
    ...safeData,
    id,
    createdDate: existing.createdDate,
    updatedDate: now(),
  }

  store.set(id, updated)
  return updated
}

export function deleteChatflow(id: string): boolean {
  return store.delete(id)
}

export function clearStore(): void {
  store.clear()
}
