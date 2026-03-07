export interface DocumentStore {
  id: string
  name: string
  description: string
  loaders: string
  whereUsed: string
  status: string
  createdDate: string
  updatedDate: string
}

const store = new Map<string, DocumentStore>()

export function getAllDocumentStores(): DocumentStore[] {
  return Array.from(store.values())
}

export function getDocumentStoreById(id: string): DocumentStore | undefined {
  return store.get(id)
}

export function setDocumentStore(docStore: DocumentStore): void {
  store.set(docStore.id, docStore)
}

export function deleteDocumentStore(id: string): boolean {
  return store.delete(id)
}

export function clearDocumentStoreStore(): void {
  store.clear()
}
