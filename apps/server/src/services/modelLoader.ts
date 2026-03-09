import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Model loader service — mirrors flowise-components/src/modelLoader.ts.
 *
 * Reads data/models.json and exposes getModels() / getRegions() to look up
 * model and region lists by category + provider name.
 */

export const MODEL_TYPE = {
  CHAT: 'chat',
  LLM: 'llm',
  EMBEDDING: 'embedding',
} as const

export type ModelType = (typeof MODEL_TYPE)[keyof typeof MODEL_TYPE]

export interface ModelEntry {
  label: string
  name: string
  description?: string
  input_cost?: number
  output_cost?: number
}

export interface RegionEntry {
  label: string
  name: string
}

interface ProviderConfig {
  name: string
  models?: ModelEntry[]
  regions?: RegionEntry[]
}

type ModelsFile = Record<string, ProviderConfig[]>

const __dirname = dirname(fileURLToPath(import.meta.url))
const modelsPath = resolve(__dirname, '..', '..', 'data', 'models.json')

let modelsCache: ModelsFile | undefined

function loadModelsFile(): ModelsFile {
  if (!modelsCache) {
    const raw = readFileSync(modelsPath, 'utf-8')
    modelsCache = JSON.parse(raw) as ModelsFile
  }
  return modelsCache
}

function getProviderConfig(category: ModelType, providerName: string): ProviderConfig | undefined {
  const models = loadModelsFile()
  const categoryProviders = models[category]
  if (!categoryProviders) return undefined
  return categoryProviders.find((p) => p.name === providerName)
}

/**
 * Returns the model list for a given category + provider.
 * Mirrors Flowise's `getModels(category, name)`.
 */
export function getModels(category: ModelType, providerName: string): ModelEntry[] {
  const config = getProviderConfig(category, providerName)
  return config?.models ?? []
}

/**
 * Returns the region list for a given category + provider.
 * Mirrors Flowise's `getRegions(category, name)`.
 */
export function getRegions(category: ModelType, providerName: string): RegionEntry[] {
  const config = getProviderConfig(category, providerName)
  return config?.regions ?? []
}

/** Visible for testing — clears the in-memory cache so next call re-reads from disk. */
export function _resetCache(): void {
  modelsCache = undefined
}
