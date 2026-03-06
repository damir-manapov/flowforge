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

export function createChatflow(data: Partial<Chatflow>): Chatflow {
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

  const updated: Chatflow = {
    ...existing,
    ...data,
    id,
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
