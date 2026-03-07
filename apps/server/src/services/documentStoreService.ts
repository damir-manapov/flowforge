import { randomUUID } from 'node:crypto'
import {
  type DocumentStore,
  deleteDocumentStore as deleteFromStore,
  getAllDocumentStores as getAllFromStore,
  getDocumentStoreById,
  setDocumentStore,
} from '../storage/documentStoreStore.js'

export type { DocumentStore } from '../storage/documentStoreStore.js'
export { clearDocumentStoreStore, getDocumentStoreById } from '../storage/documentStoreStore.js'

interface DocumentStoreInput {
  name: string
  description?: string
}

function now(): string {
  return new Date().toISOString()
}

/** List all document stores with parsed arrays and totals. */
export function getAllDocumentStores(): Array<
  Omit<DocumentStore, 'loaders' | 'whereUsed'> & {
    loaders: unknown[]
    whereUsed: unknown[]
    totalChars: number
    totalChunks: number
  }
> {
  return getAllFromStore().map((ds) => ({
    ...ds,
    loaders: safeParseArray(ds.loaders),
    whereUsed: safeParseArray(ds.whereUsed),
    totalChars: 0,
    totalChunks: 0,
  }))
}

/** Get a document store by ID with parsed arrays and totals. */
export function getDocumentStoreWithTotals(id: string) {
  const ds = getDocumentStoreById(id)
  if (!ds) return undefined

  return {
    ...ds,
    loaders: safeParseArray(ds.loaders),
    whereUsed: safeParseArray(ds.whereUsed),
    totalChars: 0,
    totalChunks: 0,
  }
}

/** Create a document store. Returns raw entity (loaders/whereUsed as strings). */
export function createDocumentStore(input: DocumentStoreInput): DocumentStore {
  const id = randomUUID()
  const timestamp = now()

  const docStore: DocumentStore = {
    id,
    name: input.name,
    description: input.description ?? '',
    loaders: '[]',
    whereUsed: '[]',
    status: 'EMPTY',
    createdDate: timestamp,
    updatedDate: timestamp,
  }

  setDocumentStore(docStore)
  return docStore
}

/** Update a document store. */
export function updateDocumentStore(id: string, input: Partial<DocumentStoreInput>) {
  const existing = getDocumentStoreById(id)
  if (!existing) return undefined

  const updated: DocumentStore = {
    ...existing,
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    updatedDate: now(),
  }

  setDocumentStore(updated)
  return getDocumentStoreWithTotals(id)
}

/** Delete a document store. */
export function deleteDocumentStore(id: string): { deleted: number } | undefined {
  const exists = getDocumentStoreById(id)
  if (!exists) return undefined

  deleteFromStore(id)
  return { deleted: 1 }
}

function safeParseArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
