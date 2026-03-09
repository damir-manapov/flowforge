/**
 * In-memory store for evaluation datasets.
 * Each dataset contains input/expected-output pairs for testing flow quality.
 */

import { randomUUID } from 'node:crypto'

export interface DatasetItem {
  readonly input: string
  readonly expectedOutput: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface Dataset {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly items: readonly DatasetItem[]
  readonly createdDate: string
  readonly updatedDate: string
}

interface CreateDatasetInput {
  readonly name: string
  readonly description?: string
  readonly items?: readonly DatasetItem[]
}

const store = new Map<string, Dataset>()

export function getAllDatasets(): Dataset[] {
  return [...store.values()]
}

export function getDataset(id: string): Dataset | undefined {
  return store.get(id)
}

export function createDataset(input: CreateDatasetInput): Dataset {
  const now = new Date().toISOString()
  const dataset: Dataset = {
    id: randomUUID(),
    name: input.name,
    description: input.description ?? '',
    items: input.items ?? [],
    createdDate: now,
    updatedDate: now,
  }
  store.set(dataset.id, dataset)
  return dataset
}

export function addDatasetItems(id: string, newItems: readonly DatasetItem[]): Dataset | undefined {
  const existing = store.get(id)
  if (!existing) return undefined
  const updated: Dataset = {
    ...existing,
    items: [...existing.items, ...newItems],
    updatedDate: new Date().toISOString(),
  }
  store.set(id, updated)
  return updated
}

export function deleteDataset(id: string): boolean {
  return store.delete(id)
}

/** Reset for testing. */
export function _resetDatasets(): void {
  store.clear()
}
