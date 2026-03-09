import { randomBytes, scryptSync } from 'node:crypto'
import {
  type ApiKey,
  deleteApiKey as deleteFromStore,
  getAllApiKeys as getAllFromStore,
  getApiKeyById,
  setApiKey,
} from '../storage/apiKeyStore.js'

export type { ApiKey } from '../storage/apiKeyStore.js'
export { clearApiKeyStore, getApiKeyById } from '../storage/apiKeyStore.js'

/** Format date as ISO string (matches Flowise 3.0 updatedDate format). */
function formatDate(): string {
  return new Date().toISOString()
}

/** Generate a random API key (32 bytes, base64url encoded). */
function generateApiKey(): string {
  return randomBytes(32).toString('base64url')
}

/** Generate an API secret (scrypt hash of the API key). */
function generateApiSecret(apiKey: string): string {
  const salt = randomBytes(8).toString('hex')
  const hash = scryptSync(apiKey, salt, 64).toString('hex')
  return `${hash}.${salt}`
}

/** List all API keys with chatFlows enrichment (stub: always empty). */
export function getAllApiKeys(): ApiKey[] {
  return getAllFromStore().map((key) => ({
    ...key,
    chatFlows: [], // stub: no chatflow association tracking yet
  }))
}

/** Create a new API key. Returns the full array of all keys. */
export function createApiKey(keyName: string, permissions: string[] = []): ApiKey[] {
  const id = randomBytes(16).toString('hex')
  const apiKey = generateApiKey()
  const apiSecret = generateApiSecret(apiKey)

  const entry: ApiKey = {
    id,
    keyName,
    apiKey,
    apiSecret,
    updatedDate: formatDate(),
    permissions,
    chatFlows: [],
  }

  setApiKey(entry)
  return getAllApiKeys()
}

/** Update an API key's name. Returns the full array (or undefined if not found). */
export function updateApiKey(id: string, keyName: string): ApiKey[] | undefined {
  const existing = getApiKeyById(id)
  if (!existing) return undefined

  const updated: ApiKey = {
    ...existing,
    keyName,
  }

  setApiKey(updated)
  return getAllApiKeys()
}

/** Delete an API key. Returns { raw: [], affected: count }. */
export function deleteApiKey(id: string): { raw: unknown[]; affected: number } {
  const deleted = deleteFromStore(id)
  return { raw: [], affected: deleted ? 1 : 0 }
}
