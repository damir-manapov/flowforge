import { existsSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupTemp, createTempDir, createTempFile } from '../src/temp.js'

afterEach(() => cleanupTemp())

describe('temp', () => {
  describe('createTempDir', () => {
    it('creates a directory that exists', () => {
      const dir = createTempDir()
      expect(existsSync(dir)).toBe(true)
    })

    it('uses the provided prefix', () => {
      const dir = createTempDir('myprefix-')
      expect(dir).toContain('myprefix-')
    })
  })

  describe('createTempFile', () => {
    it('creates a file with string content', () => {
      const path = createTempFile('hello world')
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path, 'utf-8')).toBe('hello world')
    })

    it('creates a file with Buffer content', () => {
      const buf = Buffer.from([1, 2, 3])
      const path = createTempFile(buf, 'binary.bin')
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path)).toEqual(buf)
    })

    it('uses custom filename', () => {
      const path = createTempFile('data', 'custom.json')
      expect(path).toContain('custom.json')
    })
  })

  describe('cleanupTemp', () => {
    it('removes all created temp dirs', () => {
      const dir1 = createTempDir()
      const dir2 = createTempDir()
      cleanupTemp()
      expect(existsSync(dir1)).toBe(false)
      expect(existsSync(dir2)).toBe(false)
    })

    it('is safe to call multiple times', () => {
      createTempDir()
      cleanupTemp()
      cleanupTemp() // should not throw
    })
  })
})
