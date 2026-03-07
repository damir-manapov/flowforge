export interface ApiKey {
  id: string
  keyName: string
  apiKey: string
  apiSecret: string
  createdAt: string
  chatFlows: string[]
}

const store = new Map<string, ApiKey>()

export function getAllApiKeys(): ApiKey[] {
  return Array.from(store.values())
}

export function getApiKeyById(id: string): ApiKey | undefined {
  return store.get(id)
}

export function setApiKey(apiKey: ApiKey): void {
  store.set(apiKey.id, apiKey)
}

export function deleteApiKey(id: string): boolean {
  return store.delete(id)
}

export function clearApiKeyStore(): void {
  store.clear()
}
