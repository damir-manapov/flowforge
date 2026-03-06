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

export function getAllChatflows(): Chatflow[] {
  return Array.from(store.values())
}

export function getChatflowById(id: string): Chatflow | undefined {
  return store.get(id)
}

export function setChatflow(chatflow: Chatflow): void {
  store.set(chatflow.id, chatflow)
}

export function deleteChatflow(id: string): boolean {
  return store.delete(id)
}

export function storeSize(): number {
  return store.size
}

export function oldestKey(): string | undefined {
  return store.keys().next().value ?? undefined
}

export function clearStore(): void {
  store.clear()
}
