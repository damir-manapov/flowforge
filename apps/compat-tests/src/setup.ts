import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestConfig } from '@flowforge/test-utils'
import { GoldenComparator, GoldenRecorder, getConfig, HttpClient, logger } from '@flowforge/test-utils'

const config = getConfig()
const __dirname = dirname(fileURLToPath(import.meta.url))
const goldensDir = resolve(__dirname, '../../goldens')

export const client = new HttpClient(config.baseUrl, config.authToken)
export const recorder = new GoldenRecorder(goldensDir, config.targetName)
export const comparator = new GoldenComparator(goldensDir)
export const testConfig: TestConfig = config
export const log = logger

export function shouldRecord(): boolean {
  return config.recordGoldens
}

/**
 * Whether the target has LLM nodes configured, meaning prediction endpoints
 * can return real responses. Our reimpl always has a stub, but real Flowise
 * needs actual nodes + LLM API keys.
 */
export const hasLLM: boolean = process.env.HAS_LLM === '1' || config.targetName === 'reimpl'
