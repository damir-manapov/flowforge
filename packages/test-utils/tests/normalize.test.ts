import { describe, expect, it } from 'vitest'
import { normalize, removeUnstableFields } from '../src/normalize.js'

describe('removeUnstableFields', () => {
  it('replaces known unstable keys with [NORMALIZED]', () => {
    const input = { id: '123', name: 'test', createdDate: '2024-01-01' }
    const result = removeUnstableFields(input) as Record<string, unknown>
    expect(result.id).toBe('[NORMALIZED]')
    expect(result.createdDate).toBe('[NORMALIZED]')
    expect(result.name).toBe('test')
  })

  it('handles nested objects', () => {
    const input = { nested: { id: 'abc', value: 42 } }
    const result = removeUnstableFields(input) as Record<string, Record<string, unknown>>
    expect(result.nested.id).toBe('[NORMALIZED]')
    expect(result.nested.value).toBe(42)
  })

  it('handles arrays of objects', () => {
    const input = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
    ]
    const result = removeUnstableFields(input) as Record<string, unknown>[]
    expect(result[0]?.id).toBe('[NORMALIZED]')
    expect(result[1]?.name).toBe('b')
  })

  it('returns null/undefined as-is', () => {
    expect(removeUnstableFields(null)).toBeNull()
    expect(removeUnstableFields(undefined)).toBeUndefined()
  })

  it('returns primitives as-is', () => {
    expect(removeUnstableFields('hello')).toBe('hello')
    expect(removeUnstableFields(42)).toBe(42)
    expect(removeUnstableFields(true)).toBe(true)
  })
})

describe('normalize', () => {
  it('sorts keys alphabetically at top level', () => {
    const input = { z: 1, a: 2, m: 3 }
    const result = normalize(input) as Record<string, unknown>
    expect(Object.keys(result)).toEqual(['a', 'm', 'z'])
  })

  it('sorts keys recursively in nested objects', () => {
    const input = { outer: { z: 1, a: 2 }, first: true }
    const result = normalize(input) as Record<string, unknown>
    expect(Object.keys(result)).toEqual(['first', 'outer'])
    expect(Object.keys(result.outer as object)).toEqual(['a', 'z'])
  })

  it('normalizes unstable fields and sorts keys', () => {
    const input = { name: 'test', id: 'abc123', createdDate: '2024-01-01' }
    const result = normalize(input) as Record<string, unknown>
    expect(Object.keys(result)).toEqual(['createdDate', 'id', 'name'])
    expect(result.id).toBe('[NORMALIZED]')
    expect(result.name).toBe('test')
  })
})
