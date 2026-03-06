import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalize } from './normalize.js'

export interface GoldenDiff {
  path: string
  expected: unknown
  actual: unknown
}

export class GoldenComparator {
  private readonly officialDir: string

  constructor(goldensDir: string) {
    this.officialDir = join(goldensDir, 'official')
  }

  compare(testName: string, actualData: unknown): GoldenDiff[] {
    const filePath = join(this.officialDir, `${testName}.json`)

    if (!existsSync(filePath)) {
      return [{ path: '<root>', expected: '<no golden file>', actual: actualData }]
    }

    const expectedContent = readFileSync(filePath, 'utf-8')
    const expected = JSON.parse(expectedContent) as unknown
    const normalizedActual = normalize(actualData)

    return deepDiff('', expected, normalizedActual)
  }

  hasGolden(testName: string): boolean {
    return existsSync(join(this.officialDir, `${testName}.json`))
  }
}

function deepDiff(path: string, expected: unknown, actual: unknown): GoldenDiff[] {
  const diffs: GoldenDiff[] = []

  if (expected === actual) return diffs

  if (typeof expected !== typeof actual) {
    diffs.push({ path: path || '<root>', expected, actual })
    return diffs
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const maxLen = Math.max(expected.length, actual.length)
    for (let i = 0; i < maxLen; i++) {
      const childPath = `${path}[${i}]`
      if (i >= expected.length) {
        diffs.push({ path: childPath, expected: undefined, actual: actual[i] })
      } else if (i >= actual.length) {
        diffs.push({ path: childPath, expected: expected[i], actual: undefined })
      } else {
        diffs.push(...deepDiff(childPath, expected[i], actual[i]))
      }
    }
    return diffs
  }

  if (typeof expected === 'object' && expected !== null && typeof actual === 'object' && actual !== null) {
    const allKeys = new Set([
      ...Object.keys(expected as Record<string, unknown>),
      ...Object.keys(actual as Record<string, unknown>),
    ])
    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key
      const expectedObj = expected as Record<string, unknown>
      const actualObj = actual as Record<string, unknown>
      diffs.push(...deepDiff(childPath, expectedObj[key], actualObj[key]))
    }
    return diffs
  }

  if (expected !== actual) {
    diffs.push({ path: path || '<root>', expected, actual })
  }

  return diffs
}
