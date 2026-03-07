import { randomUUID } from 'node:crypto'
import {
  type Credential,
  deleteCredential as deleteFromStore,
  getAllCredentials as getAllFromStore,
  getCredentialById,
  setCredential,
} from '../storage/credentialStore.js'
import { decryptCredentialData, encryptCredentialData, redactPasswords } from '../utils/encryption.js'

export type { Credential } from '../storage/credentialStore.js'
export { clearCredentialStore, getCredentialById } from '../storage/credentialStore.js'

interface CredentialInput {
  name: string
  credentialName: string
  plainDataObj?: Record<string, unknown>
}

function now(): string {
  return new Date().toISOString()
}

/** List all credentials, omitting encryptedData. */
export function getAllCredentials(): Omit<Credential, 'encryptedData'>[] {
  return getAllFromStore().map(({ encryptedData: _enc, ...rest }) => rest)
}

/** Create a new credential. Returns the full entity (with encryptedData). */
export function createCredential(input: CredentialInput): Credential {
  const id = randomUUID()
  const timestamp = now()

  const encryptedData = input.plainDataObj ? encryptCredentialData(input.plainDataObj) : ''

  const credential: Credential = {
    id,
    name: input.name,
    credentialName: input.credentialName,
    encryptedData,
    createdDate: timestamp,
    updatedDate: timestamp,
  }

  setCredential(credential)
  return credential
}

/**
 * Get a credential by ID with decrypted+redacted plainDataObj.
 * Password fields are replaced with the Flowise redaction sentinel.
 */
export function getCredentialWithPlainData(
  id: string,
  credentialTypes: Array<{ name: string; inputs?: Array<{ name: string; type: string }> }>,
): (Omit<Credential, 'encryptedData'> & { plainDataObj: Record<string, unknown> }) | undefined {
  const credential = getCredentialById(id)
  if (!credential) return undefined

  const decrypted = decryptCredentialData(credential.encryptedData)
  const redacted = redactPasswords(decrypted, credential.credentialName, credentialTypes)

  const { encryptedData: _enc, ...rest } = credential
  return { ...rest, plainDataObj: redacted }
}

/** Update a credential. Returns the full entity (with encryptedData). */
export function updateCredential(id: string, input: CredentialInput): Credential | undefined {
  const existing = getCredentialById(id)
  if (!existing) return undefined

  const encryptedData = input.plainDataObj ? encryptCredentialData(input.plainDataObj) : existing.encryptedData

  const updated: Credential = {
    ...existing,
    name: input.name ?? existing.name,
    credentialName: input.credentialName ?? existing.credentialName,
    encryptedData,
    updatedDate: now(),
  }

  setCredential(updated)
  return updated
}

/** Delete a credential. Returns Flowise-compatible DeleteResult. */
export function deleteCredential(id: string): { raw: unknown[]; affected: number } {
  const deleted = deleteFromStore(id)
  return { raw: [], affected: deleted ? 1 : 0 }
}
