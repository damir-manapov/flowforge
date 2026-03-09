import { describe, expect, it } from 'vitest'
import { parseZodSchema } from '../src/services/secureZodParser.js'

describe('secureZodParser', () => {
  // ── Valid schemas ────────────────────────────────────────────────

  it('parses a simple z.object with string and number', () => {
    const schema = parseZodSchema('z.object({name: z.string(), age: z.number()})')
    const result = schema.parse({ name: 'Alice', age: 30 })
    expect(result).toEqual({ name: 'Alice', age: 30 })
  })

  it('handles optional fields', () => {
    const schema = parseZodSchema('z.object({name: z.string(), bio: z.string().optional()})')
    expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' })
    expect(schema.parse({ name: 'Alice', bio: 'hi' })).toEqual({
      name: 'Alice',
      bio: 'hi',
    })
  })

  it('handles boolean fields', () => {
    const schema = parseZodSchema('z.object({active: z.boolean()})')
    expect(schema.parse({ active: true })).toEqual({ active: true })
  })

  it('handles enum fields', () => {
    const schema = parseZodSchema('z.object({role: z.enum(["admin", "user"])})')
    expect(schema.parse({ role: 'admin' })).toEqual({ role: 'admin' })
    expect(() => schema.parse({ role: 'god' })).toThrow()
  })

  it('handles nested objects', () => {
    const schema = parseZodSchema('z.object({user: z.object({name: z.string(), age: z.number()})})')
    const result = schema.parse({ user: { name: 'Bob', age: 25 } })
    expect(result).toEqual({ user: { name: 'Bob', age: 25 } })
  })

  it('handles arrays of primitives', () => {
    const schema = parseZodSchema('z.object({tags: z.array(z.string())})')
    expect(schema.parse({ tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] })
  })

  it('handles arrays of objects', () => {
    const schema = parseZodSchema('z.object({items: z.array(z.object({id: z.number(), label: z.string()}))})')
    const result = schema.parse({ items: [{ id: 1, label: 'x' }] })
    expect(result).toEqual({ items: [{ id: 1, label: 'x' }] })
  })

  it('handles .describe() modifier', () => {
    const schema = parseZodSchema('z.object({name: z.string().describe("The name")})')
    expect(schema.parse({ name: 'test' })).toEqual({ name: 'test' })
  })

  it('handles .int() modifier on number', () => {
    const schema = parseZodSchema('z.object({count: z.number().int()})')
    expect(schema.parse({ count: 5 })).toEqual({ count: 5 })
    expect(() => schema.parse({ count: 3.14 })).toThrow()
  })

  it('strips comments from schema string', () => {
    const schema = parseZodSchema(`
      z.object({
        // this is a comment
        name: z.string()
      })
    `)
    expect(schema.parse({ name: 'test' })).toEqual({ name: 'test' })
  })

  // ── Rejected schemas ─────────────────────────────────────────────

  it('rejects schemas not starting with z.object()', () => {
    expect(() => parseZodSchema('z.string()')).toThrow('Schema must start with z.object()')
  })

  it('rejects transform (code execution)', () => {
    expect(() => parseZodSchema('z.object({name: z.string().transform((val) => val.toUpperCase())})')).toThrow()
  })

  it('rejects refine (code execution)', () => {
    expect(() => parseZodSchema('z.object({age: z.number().refine((val) => val > 0)})')).toThrow()
  })

  it('rejects superRefine', () => {
    expect(() => parseZodSchema('z.object({x: z.string().superRefine(() => {})})')).toThrow()
  })

  it('rejects pipe', () => {
    expect(() => parseZodSchema('z.object({x: z.string().pipe(z.number())})')).toThrow()
  })

  it('rejects arbitrary code in schema string', () => {
    expect(() => parseZodSchema('process.exit(1); z.object({name: z.string()})')).toThrow()
  })

  // ── Edge cases ────────────────────────────────────────────────────

  it('handles empty object', () => {
    const schema = parseZodSchema('z.object({})')
    expect(schema.parse({})).toEqual({})
  })

  it('rejects invalid base types', () => {
    expect(() => parseZodSchema('z.object({x: z.bigint()})')).toThrow(/[Uu]nsupported/)
  })
})
