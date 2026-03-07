export interface Credential {
  id: string
  name: string
  credentialName: string
  encryptedData: string
  createdDate: string
  updatedDate: string
}

const store = new Map<string, Credential>()

export function getAllCredentials(): Credential[] {
  return Array.from(store.values())
}

export function getCredentialById(id: string): Credential | undefined {
  return store.get(id)
}

export function setCredential(credential: Credential): void {
  store.set(credential.id, credential)
}

export function deleteCredential(id: string): boolean {
  return store.delete(id)
}

export function clearCredentialStore(): void {
  store.clear()
}
