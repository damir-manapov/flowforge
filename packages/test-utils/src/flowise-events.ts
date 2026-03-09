import type { SSEEvent } from './sse-parser.js'

export interface FlowiseSSEEvent {
  /** Event type: `"start"`, `"token"`, `"metadata"`, `"end"`, `"error"`, … */
  event: string
  /** Event payload (token text, JSON string, `"[DONE]"`, etc.) */
  data: string
}

/**
 * Parse the Flowise JSON-envelope SSE format.
 *
 * Flowise wraps the logical event type inside the `data:` field:
 * ```
 * data: {"event":"token","data":"Hello"}
 * ```
 *
 * This helper accepts the `SSEEvent[]` returned by `collectSSE()` and
 * extracts the inner `{ event, data }` objects.  Non-JSON data lines
 * (heartbeats, etc.) are silently skipped.
 */
export function parseFlowiseEvents(sseEvents: Pick<SSEEvent, 'data'>[]): FlowiseSSEEvent[] {
  const out: FlowiseSSEEvent[] = []
  for (const e of sseEvents) {
    if (!e.data) continue
    try {
      const parsed = JSON.parse(e.data) as { event?: string; data?: unknown }
      if (parsed.event) {
        const d = parsed.data ?? ''
        out.push({ event: parsed.event, data: typeof d === 'string' ? d : JSON.stringify(d) })
      }
    } catch {
      // non-JSON data lines (keepalives, etc.) — skip
    }
  }
  return out
}
