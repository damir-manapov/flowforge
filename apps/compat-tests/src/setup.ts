import { resolve } from 'node:path'
import { HttpClient, getConfig, GoldenRecorder, GoldenComparator, logger } from '@flowforge/test-utils'
import type { TestConfig } from '@flowforge/test-utils'

const config = getConfig()
const goldensDir = resolve(import.meta.dirname, '../../goldens')

export const client = new HttpClient(config.baseUrl, config.authToken)
export const recorder = new GoldenRecorder(goldensDir, config.targetName)
export const comparator = new GoldenComparator(goldensDir)
export const testConfig: TestConfig = config
export const log = logger

export function shouldRecord(): boolean {
  return config.recordGoldens
}
