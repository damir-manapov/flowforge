import { describe, expect, it } from 'vitest'
import { isValidUUID } from '../src/services/chatflowService.js'

describe('isValidUUID', () => {
  it('accepts a valid v4 UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts uppercase UUID', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('accepts a zero UUID', () => {
    expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidUUID('')).toBe(false)
  })

  it('rejects random text', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
  })

  it('rejects UUID without dashes', () => {
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
  })

  it('rejects UUID with wrong length', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
  })

  it('rejects UUID with invalid characters', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false)
  })
})
