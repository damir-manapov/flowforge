import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GoldenComparator } from '../src/golden-comparator.js'
import { cleanupTemp, createTempDir } from '../src/temp.js'

afterEach(() => cleanupTemp())

function setupGolden(data: unknown): { comparator: GoldenComparator; testName: string } {
  const dir = createTempDir('goldens-')
  const officialDir = join(dir, 'official')
  const { mkdirSync } = require('node:fs')
  mkdirSync(officialDir, { recursive: true })
  const testName = 'test-case'
  writeFileSync(join(officialDir, `${testName}.json`), JSON.stringify(data))
  return { comparator: new GoldenComparator(dir), testName }
}

describe('GoldenComparator', () => {
  describe('hasGolden', () => {
    it('returns false when no golden file exists', () => {
      const dir = createTempDir('goldens-')
      const { mkdirSync } = require('node:fs')
      mkdirSync(join(dir, 'official'), { recursive: true })
      const comparator = new GoldenComparator(dir)
      expect(comparator.hasGolden('nonexistent')).toBe(false)
    })

    it('returns true when golden file exists', () => {
      const { comparator, testName } = setupGolden({ key: 'value' })
      expect(comparator.hasGolden(testName)).toBe(true)
    })
  })

  describe('compare', () => {
    it('returns diff when no golden file exists', () => {
      const dir = createTempDir('goldens-')
      const { mkdirSync } = require('node:fs')
      mkdirSync(join(dir, 'official'), { recursive: true })
      const comparator = new GoldenComparator(dir)
      const diffs = comparator.compare('missing', { data: 1 })
      expect(diffs).toHaveLength(1)
      expect(diffs[0]?.expected).toBe('<no golden file>')
    })

    it('returns empty diffs for matching data', () => {
      const { comparator, testName } = setupGolden({ name: 'test', value: 42 })
      const diffs = comparator.compare(testName, { name: 'test', value: 42 })
      expect(diffs).toEqual([])
    })

    it('detects primitive differences', () => {
      const { comparator, testName } = setupGolden({ name: 'expected' })
      const diffs = comparator.compare(testName, { name: 'actual' })
      expect(diffs.length).toBeGreaterThan(0)
      expect(diffs[0]?.path).toBe('name')
    })

    it('detects missing and extra keys', () => {
      const { comparator, testName } = setupGolden({ a: 1, b: 2 })
      const diffs = comparator.compare(testName, { a: 1, c: 3 })
      const paths = diffs.map((d) => d.path)
      expect(paths).toContain('b')
      expect(paths).toContain('c')
    })

    it('detects array length differences', () => {
      const { comparator, testName } = setupGolden({ items: [1, 2, 3] })
      const diffs = comparator.compare(testName, { items: [1, 2] })
      expect(diffs.length).toBeGreaterThan(0)
    })
  })
})
