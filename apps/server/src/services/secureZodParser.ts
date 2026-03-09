/**
 * Secure Zod schema parser — prevents arbitrary code execution.
 *
 * Accepts Zod schema strings (e.g. `z.object({name: z.string()})`)
 * and converts them to actual Zod schema objects using a whitelist
 * approach. Dangerous methods like `transform`, `refine`, `superRefine`,
 * `pipe` are blocked.
 *
 * Based on Flowise's secureZodParser.ts (602 lines) but reimplemented
 * in idiomatic TypeScript.
 */

import { z } from 'zod/v3'

// ── Whitelist ────────────────────────────────────────────────────────

const ALLOWED_BASE_TYPES = new Set(['string', 'number', 'boolean', 'date', 'enum'])

const ALLOWED_MODIFIERS = new Set(['optional', 'nullable', 'array', 'int', 'max', 'min', 'describe', 'default'])

// ── Internal types ───────────────────────────────────────────────────

interface Modifier {
  readonly name: string
  readonly args: readonly unknown[]
}

interface BaseType {
  readonly kind: 'base'
  readonly base: string
  readonly baseArgs?: readonly unknown[]
  readonly modifiers: readonly Modifier[]
}

interface NestedObject {
  readonly kind: 'object'
  readonly properties: Readonly<Record<string, TypeInfo>>
  readonly modifiers?: readonly Modifier[]
}

interface ArrayOfObjects {
  readonly kind: 'arrayOfObjects'
  readonly properties: Readonly<Record<string, TypeInfo>>
  readonly modifiers?: readonly Modifier[]
}

interface SimpleArray {
  readonly kind: 'simpleArray'
  readonly innerType: TypeInfo
  readonly modifiers?: readonly Modifier[]
}

type TypeInfo = BaseType | NestedObject | ArrayOfObjects | SimpleArray

// ── Public API ───────────────────────────────────────────────────────

/**
 * Safely parse a Zod schema string into a Zod schema object.
 * Only allows whitelisted Zod methods — no eval, no Function constructor.
 *
 * @param schemaString  e.g. `z.object({name: z.string(), age: z.number().optional()})`
 * @returns A `z.ZodTypeAny` schema object
 * @throws If the schema is invalid or contains unsafe patterns
 */
export function parseZodSchema(schemaString: string): z.ZodTypeAny {
  const cleaned = cleanSchemaString(schemaString)
  const parsed = parseSchemaStructure(cleaned)
  return buildZodSchema(parsed)
}

// ── Cleaning ─────────────────────────────────────────────────────────

function cleanSchemaString(schema: string): string {
  return schema
    .replace(/\/\/.*$/gm, '') // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim()
}

// ── Top-level parsing ────────────────────────────────────────────────

function parseSchemaStructure(schema: string): Readonly<Record<string, TypeInfo>> {
  if (!schema.startsWith('z.object(')) {
    throw new Error('Schema must start with z.object()')
  }
  const objectMatch = schema.match(/z\.object\(\s*\{([\s\S]*)\}\s*\)/)
  if (!objectMatch) {
    throw new Error('Invalid z.object() syntax')
  }
  const content = objectMatch[1] ?? ''
  return parseObjectProperties(content)
}

// ── Property parsing ─────────────────────────────────────────────────

function parseObjectProperties(content: string): Record<string, TypeInfo> {
  const properties: Record<string, TypeInfo> = {}
  for (const prop of splitAtTopLevelCommas(content)) {
    const colonIdx = prop.indexOf(':')
    if (colonIdx === -1) continue
    const key = prop.slice(0, colonIdx).trim().replace(/['"]/g, '')
    const value = prop.slice(colonIdx + 1).trim()
    properties[key] = parseZodType(value)
  }
  return properties
}

// ── Type string parsing ──────────────────────────────────────────────

function parseZodType(typeStr: string): TypeInfo {
  // Nested z.object({...})
  if (typeStr.startsWith('z.object(')) {
    return parseObjectType(typeStr)
  }
  // z.array(...)
  if (typeStr.startsWith('z.array(')) {
    return parseArrayType(typeStr)
  }
  // Simple: z.string().optional(), z.number().int(), etc.
  return parseSimpleType(typeStr)
}

function parseObjectType(typeStr: string): NestedObject {
  const { main, modifiers } = extractModifiers(typeStr, 'z.object(')
  const objectMatch = main.match(/z\.object\(\s*\{([\s\S]*)\}\s*\)/)
  if (!objectMatch?.[1]) throw new Error('Invalid object syntax')
  return {
    kind: 'object',
    properties: parseObjectProperties(objectMatch[1]),
    modifiers,
  }
}

function parseArrayType(typeStr: string): ArrayOfObjects | SimpleArray {
  const { main, modifiers } = extractModifiers(typeStr, 'z.array(')

  const contentMatch = main.match(/z\.array\(\s*([\s\S]*)\s*\)$/)
  if (!contentMatch?.[1]) throw new Error('Invalid array syntax')
  const inner = contentMatch[1].trim()

  if (inner.startsWith('z.object(')) {
    const objMatch = inner.match(/z\.object\(\s*\{([\s\S]*)\}\s*\)/)
    if (!objMatch?.[1]) throw new Error('Invalid object syntax inside array')
    const properties = parseObjectProperties(objMatch[1])
    validateProperties(properties)
    return { kind: 'arrayOfObjects', properties, modifiers }
  }

  const innerType = parseZodType(inner)
  return { kind: 'simpleArray', innerType, modifiers }
}

function parseSimpleType(typeStr: string): BaseType {
  const parts = typeStr.split('.')
  const modifiers: Modifier[] = []
  let base = ''
  let baseArgs: unknown[] | undefined

  for (let i = 0; i < parts.length; i++) {
    const part = (parts[i] ?? '').trim()
    if (i === 0) {
      if (part !== 'z') throw new Error(`Expected 'z' but got '${part}'`)
      continue
    }
    const match = part.match(/^(\w+)(\(.*\))?$/)
    if (!match) throw new Error(`Invalid type segment: ${part}`)
    const name = match[1] ?? ''
    const args = match[2] ? parseArgs(match[2]) : []

    if (i === 1) {
      base = name
      if (args.length > 0) baseArgs = args
    } else {
      modifiers.push({ name, args })
    }
  }

  if (!ALLOWED_BASE_TYPES.has(base)) {
    throw new Error(`Unsupported base type: ${base}`)
  }
  for (const mod of modifiers) {
    if (!ALLOWED_MODIFIERS.has(mod.name)) {
      throw new Error(`Unsupported modifier: ${mod.name}`)
    }
  }

  const result: BaseType = { kind: 'base', base, modifiers }
  if (baseArgs) {
    return { ...result, baseArgs }
  }
  return result
}

// ── Modifier extraction (for composite types with trailing .optional() etc.)

function extractModifiers(typeStr: string, prefix: string): { main: string; modifiers: Modifier[] } {
  const startIdx = typeStr.indexOf(prefix) + prefix.length - 1
  let depth = 0
  let endIdx = -1

  for (let i = startIdx; i < typeStr.length; i++) {
    if (typeStr[i] === '(') depth++
    else if (typeStr[i] === ')') {
      depth--
      if (depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }

  if (endIdx === -1) return { main: typeStr, modifiers: [] }

  const main = typeStr.slice(0, endIdx)
  const rest = typeStr.slice(endIdx)

  if (!rest.startsWith('.')) return { main, modifiers: [] }

  const modifiers: Modifier[] = []
  for (const part of rest.slice(1).split('.')) {
    const match = part.match(/^(\w+)(\(.*\))?$/)
    if (!match) throw new Error(`Invalid modifier: ${part}`)
    const name = match[1] ?? ''
    if (!ALLOWED_MODIFIERS.has(name)) {
      throw new Error(`Unsupported modifier: ${name}`)
    }
    const args = match[2] ? parseArgs(match[2]) : []
    modifiers.push({ name, args })
  }

  return { main, modifiers }
}

// ── Argument parsing ─────────────────────────────────────────────────

function parseArgs(argsStr: string): unknown[] {
  const inner = argsStr.slice(1, -1).trim()
  if (!inner) return []

  // Array argument: [...]
  if (inner.startsWith('[') && inner.endsWith(']')) {
    const items = inner
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
    return [items]
  }

  // Number
  if (/^\d+$/.test(inner)) return [Number.parseInt(inner, 10)]

  // Quoted string
  if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
    return [inner.slice(1, -1)]
  }

  // Object literal for .default({...})
  if (inner.startsWith('{') && inner.endsWith('}')) {
    return [parseObjectLiteral(inner)]
  }

  // Comma-separated values
  return inner.split(',').map((arg) => {
    const s = arg.trim()
    if (/^\d+$/.test(s)) return Number.parseInt(s, 10)
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1)
    }
    return s
  })
}

function parseObjectLiteral(objStr: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const content = objStr.slice(1, -1).trim()
  if (!content) return obj

  for (const prop of splitAtTopLevelCommas(content)) {
    const colonIdx = prop.indexOf(':')
    if (colonIdx === -1) continue
    const key = prop.slice(0, colonIdx).trim().replace(/['"]/g, '')
    const valStr = prop.slice(colonIdx + 1).trim()

    if (valStr.startsWith('[') && valStr.endsWith(']')) {
      obj[key] = valStr
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    } else if (/^\d+$/.test(valStr)) {
      obj[key] = Number.parseInt(valStr, 10)
    } else if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
      obj[key] = valStr.slice(1, -1)
    } else {
      obj[key] = valStr
    }
  }
  return obj
}

// ── Comma splitting (respects nesting) ───────────────────────────────

function splitAtTopLevelCommas(content: string): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  let inString = false
  let strChar = ''

  for (let i = 0; i < content.length; i++) {
    const ch = content[i] ?? ''

    if (!inString && (ch === '"' || ch === "'")) {
      inString = true
      strChar = ch
    } else if (inString && ch === strChar && content[i - 1] !== '\\') {
      inString = false
    } else if (!inString) {
      if (ch === '(' || ch === '[' || ch === '{') depth++
      else if (ch === ')' || ch === ']' || ch === '}') depth--
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
        continue
      }
    }
    current += ch
  }

  if (current.trim()) parts.push(current.trim())
  return parts
}

// ── Validation ───────────────────────────────────────────────────────

function validateProperties(props: Record<string, TypeInfo>): void {
  for (const typeInfo of Object.values(props)) {
    validateTypeInfo(typeInfo)
  }
}

function validateTypeInfo(typeInfo: TypeInfo): void {
  if (typeInfo.kind === 'object' || typeInfo.kind === 'arrayOfObjects') {
    validateProperties(typeInfo.properties as Record<string, TypeInfo>)
    return
  }
  if (typeInfo.kind === 'simpleArray') {
    validateTypeInfo(typeInfo.innerType)
    return
  }
  // BaseType
  if (!ALLOWED_BASE_TYPES.has(typeInfo.base)) {
    throw new Error(`Unsupported type: ${typeInfo.base}`)
  }
  for (const mod of typeInfo.modifiers) {
    if (!ALLOWED_MODIFIERS.has(mod.name)) {
      throw new Error(`Unsupported modifier: ${mod.name}`)
    }
  }
}

// ── Schema construction ──────────────────────────────────────────────

function buildZodSchema(parsed: Readonly<Record<string, TypeInfo>>): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {}
  for (const [key, typeInfo] of Object.entries(parsed)) {
    shape[key] = buildZodType(typeInfo)
  }
  return z.object(shape)
}

function buildZodType(typeInfo: TypeInfo): z.ZodTypeAny {
  if (typeInfo.kind === 'object') {
    let schema: z.ZodTypeAny = buildZodSchema(typeInfo.properties as Record<string, TypeInfo>)
    if (typeInfo.modifiers) schema = applyModifiers(schema, typeInfo.modifiers)
    return schema
  }

  if (typeInfo.kind === 'arrayOfObjects') {
    const objectSchema = buildZodSchema(typeInfo.properties as Record<string, TypeInfo>)
    let schema: z.ZodTypeAny = z.array(objectSchema)
    if (typeInfo.modifiers) schema = applyModifiers(schema, typeInfo.modifiers)
    return schema
  }

  if (typeInfo.kind === 'simpleArray') {
    const inner = buildZodType(typeInfo.innerType)
    let schema: z.ZodTypeAny = z.array(inner)
    if (typeInfo.modifiers) schema = applyModifiers(schema, typeInfo.modifiers)
    return schema
  }

  // BaseType
  let zodType = buildBaseType(typeInfo)
  zodType = applyModifiers(zodType, typeInfo.modifiers)
  return zodType
}

function buildBaseType(typeInfo: BaseType): z.ZodTypeAny {
  switch (typeInfo.base) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'date':
      return z.date()
    case 'enum': {
      const values = typeInfo.baseArgs?.[0]
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('enum requires a non-empty array of values')
      }
      return z.enum(values as [string, ...string[]])
    }
    default:
      throw new Error(`Unsupported base type: ${typeInfo.base}`)
  }
}

function applyNumericConstraint(result: z.ZodTypeAny, method: 'max' | 'min', value: unknown): z.ZodTypeAny {
  if (typeof value !== 'number') return result
  if (result instanceof z.ZodString) return result[method](value)
  if (result instanceof z.ZodArray) return result[method](value)
  return result
}

function applySingleModifier(result: z.ZodTypeAny, mod: Modifier): z.ZodTypeAny {
  switch (mod.name) {
    case 'optional':
      return result.optional()
    case 'nullable':
      return result.nullable()
    case 'int':
      return result instanceof z.ZodNumber ? result.int() : result
    case 'max':
      return applyNumericConstraint(result, 'max', mod.args[0])
    case 'min':
      return applyNumericConstraint(result, 'min', mod.args[0])
    case 'describe':
      return typeof mod.args[0] === 'string' ? result.describe(mod.args[0]) : result
    case 'default':
      return mod.args[0] !== undefined ? result.default(mod.args[0]) : result
    case 'array':
      return z.array(result)
    default:
      return result
  }
}

function applyModifiers(schema: z.ZodTypeAny, modifiers: readonly Modifier[]): z.ZodTypeAny {
  let result = schema
  for (const mod of modifiers) {
    result = applySingleModifier(result, mod)
  }
  return result
}
