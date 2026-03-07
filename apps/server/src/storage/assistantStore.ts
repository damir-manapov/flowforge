export interface Assistant {
  id: string
  details: string
  credential: string
  iconSrc: string | null
  createdDate: string
  updatedDate: string
}

const store = new Map<string, Assistant>()

export function getAllAssistants(): Assistant[] {
  return Array.from(store.values())
}

export function getAssistantById(id: string): Assistant | undefined {
  return store.get(id)
}

export function setAssistant(assistant: Assistant): void {
  store.set(assistant.id, assistant)
}

export function deleteAssistant(id: string): boolean {
  return store.delete(id)
}

export function clearAssistantStore(): void {
  store.clear()
}
