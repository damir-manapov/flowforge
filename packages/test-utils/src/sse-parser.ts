export interface SSEEvent {
  event: string | undefined
  data: string
  id: string | undefined
  retry: number | undefined
}

export interface SSEOptions {
  headers?: Record<string, string>
  body?: string
  method?: string
  timeout?: number
}

export interface SSECollectResult {
  events: SSEEvent[]
  raw: string
  startedAt: number
  endedAt: number
  durationMs: number
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE spec parsing requires branching
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const blocks = chunk.split(/\n\n+/)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    let event: string | undefined
    let data = ''
    let id: string | undefined
    let retry: number | undefined

    const lines = trimmed.split('\n')
    for (const line of lines) {
      if (line.startsWith('event:')) {
        const raw = line.slice(6)
        event = raw.startsWith(' ') ? raw.slice(1) : raw
      } else if (line.startsWith('data:')) {
        const raw = line.slice(5)
        const value = raw.startsWith(' ') ? raw.slice(1) : raw
        data += data ? `\n${value}` : value
      } else if (line.startsWith('id:')) {
        const raw = line.slice(3)
        id = raw.startsWith(' ') ? raw.slice(1) : raw
      } else if (line.startsWith('retry:')) {
        const val = Number.parseInt(line.slice(6).trim(), 10)
        if (!Number.isNaN(val)) {
          retry = val
        }
      }
    }

    if (data || event) {
      events.push({ event, data, id, retry })
    }
  }

  return events
}

export async function collectSSE(url: string, options: SSEOptions = {}): Promise<SSECollectResult> {
  const method = options.method ?? 'POST'
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    ...options.headers,
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const controller = new AbortController()
  const timeoutMs = options.timeout ?? 60_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body ?? null,
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`SSE request failed with status ${response.status}: ${body.slice(0, 200)}`)
    }

    if (!response.body) {
      throw new Error(`SSE response has no body (status=${response.status})`)
    }

    const allEvents: SSEEvent[] = []
    let rawText = ''

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let buffer = ''
    let done = false

    while (!done) {
      const result = await reader.read()
      done = result.done

      if (result.value) {
        const text = decoder.decode(result.value, { stream: !done })
        rawText += text
        buffer += text

        const lastDoubleNewline = buffer.lastIndexOf('\n\n')
        if (lastDoubleNewline !== -1) {
          const complete = buffer.slice(0, lastDoubleNewline + 2)
          buffer = buffer.slice(lastDoubleNewline + 2)
          const parsed = parseSSEChunk(complete)
          allEvents.push(...parsed)
        }
      }
    }

    if (buffer.trim()) {
      const parsed = parseSSEChunk(buffer)
      allEvents.push(...parsed)
    }

    const endedAt = Date.now()

    return {
      events: allEvents,
      raw: rawText,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
    }
  } finally {
    clearTimeout(timer)
  }
}
