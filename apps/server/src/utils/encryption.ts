import { randomBytes } from 'node:crypto'
import CryptoJS from 'crypto-js'

const { AES, enc } = CryptoJS

const REDACTED = '_FLOWISE_BLANK_07167752-1a71-43b1-bf8f-4f32252165db'

let encryptionKey: string | undefined

/** Resolve the encryption key (matches Flowise precedence). */
function getEncryptionKey(): string {
  if (encryptionKey) return encryptionKey

  // 1. Explicit override
  const override = process.env.FLOWISE_SECRETKEY_OVERWRITE
  if (override) {
    encryptionKey = override
    return encryptionKey
  }

  // 2. Auto-generate (in-memory only — no file persistence)
  encryptionKey = randomBytes(24).toString('base64')
  return encryptionKey
}

/** Encrypt a plain-data object. Returns ciphertext string. */
export function encryptCredentialData(plainDataObj: Record<string, unknown>): string {
  const key = getEncryptionKey()
  return AES.encrypt(JSON.stringify(plainDataObj), key).toString()
}

/** Decrypt ciphertext. Returns plain data object. */
export function decryptCredentialData(encryptedData: string): Record<string, unknown> {
  const key = getEncryptionKey()
  const decrypted = AES.decrypt(encryptedData, key)
  const str = decrypted.toString(enc.Utf8)
  if (!str) return {}
  try {
    return JSON.parse(str) as Record<string, unknown>
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.warn('[encryption] Failed to decrypt credential data:', detail)
    return {}
  }
}

/** Replace password-type fields with the Flowise redaction sentinel. */
export function redactPasswords(
  plainDataObj: Record<string, unknown>,
  credentialName: string,
  credentialTypes: Array<{ name: string; inputs?: Array<{ name: string; type: string }> }>,
): Record<string, unknown> {
  const credType = credentialTypes.find((c) => c.name === credentialName)
  if (!credType?.inputs) return { ...plainDataObj }

  const passwordFields = new Set(credType.inputs.filter((i) => i.type === 'password').map((i) => i.name))
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(plainDataObj)) {
    result[key] = passwordFields.has(key) ? REDACTED : value
  }

  return result
}

/** Reset encryption key (for testing). */
export function resetEncryptionKey(): void {
  encryptionKey = undefined
}
