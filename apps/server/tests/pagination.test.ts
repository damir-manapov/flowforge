import { describe, expect, it } from 'vitest'
import { paginate } from '../src/utils/pagination.js'

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }))

  it('returns bare array when no page param', () => {
    const result = paginate(items, {})
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(25)
  })

  it('returns { data, total } when page param is present', () => {
    const result = paginate(items, { page: '1', limit: '10' })
    expect(Array.isArray(result)).toBe(false)
    expect(result).toEqual({ data: items.slice(0, 10), total: 25 })
  })

  it('paginates to page 2', () => {
    const result = paginate(items, { page: '2', limit: '10' })
    expect(result).toEqual({ data: items.slice(10, 20), total: 25 })
  })

  it('returns partial last page', () => {
    const result = paginate(items, { page: '3', limit: '10' })
    expect(result).toEqual({ data: items.slice(20, 25), total: 25 })
  })

  it('returns empty data for out-of-range page', () => {
    const result = paginate(items, { page: '100', limit: '10' })
    expect(result).toEqual({ data: [], total: 25 })
  })

  it('defaults limit to 12 when not specified', () => {
    const result = paginate(items, { page: '1' })
    expect(result).toEqual({ data: items.slice(0, 12), total: 25 })
  })
})
