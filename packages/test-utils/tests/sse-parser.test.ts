import { describe, expect, it } from 'vitest'
import { parseSSEChunk } from '../src/sse-parser.js'

describe('parseSSEChunk', () => {
  it('parses a simple data-only event', () => {
    const chunk = 'data: hello world\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(1)
    expect(events[0]?.data).toBe('hello world')
    expect(events[0]?.event).toBeUndefined()
  })

  it('parses an event with event type', () => {
    const chunk = 'event: token\ndata: hi\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(1)
    expect(events[0]?.event).toBe('token')
    expect(events[0]?.data).toBe('hi')
  })

  it('parses multiple events in one chunk', () => {
    const chunk = 'data: first\n\ndata: second\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(2)
    expect(events[0]?.data).toBe('first')
    expect(events[1]?.data).toBe('second')
  })

  it('parses event with id field', () => {
    const chunk = 'id: 42\ndata: msg\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe('42')
  })

  it('parses event with retry field', () => {
    const chunk = 'retry: 3000\ndata: msg\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(1)
    expect(events[0]?.retry).toBe(3000)
  })

  it('ignores invalid retry field', () => {
    const chunk = 'retry: notanumber\ndata: msg\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(1)
    expect(events[0]?.retry).toBeUndefined()
  })

  it('handles multi-line data', () => {
    const chunk = 'data: line1\ndata: line2\n\n'
    const events = parseSSEChunk(chunk)
    expect(events).toHaveLength(1)
    expect(events[0]?.data).toContain('line1')
    expect(events[0]?.data).toContain('line2')
  })

  it('returns empty array for empty string', () => {
    expect(parseSSEChunk('')).toEqual([])
  })

  it('returns empty array for whitespace-only', () => {
    expect(parseSSEChunk('   \n\n  ')).toEqual([])
  })
})
