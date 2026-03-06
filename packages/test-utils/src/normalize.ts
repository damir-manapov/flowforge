type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const UNSTABLE_KEYS = new Set([
  'id',
  'createdDate',
  'updatedDate',
  'date',
  'timestamp',
  'chatId',
  'chatMessageId',
  'sessionId',
  'tokenCount',
  'totalTokens',
  'completionTokens',
  'promptTokens',
])

export function removeUnstableFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => removeUnstableFields(item))
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (UNSTABLE_KEYS.has(key)) {
      result[key] = '[NORMALIZED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = removeUnstableFields(value)
    } else {
      result[key] = value
    }
  }
  return result
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || value === undefined || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeysDeep)

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
  }
  return sorted
}

export function normalize(data: unknown): JsonValue {
  const cleaned = removeUnstableFields(data)
  return sortKeysDeep(cleaned) as JsonValue
}
