import { describe, expect, it, vi } from 'vitest'

function createMockReply() {
  const chunks: string[] = []
  const raw = {
    destroyed: false,
    write: vi.fn((data: string) => chunks.push(data)),
    end: vi.fn(() => {
      raw.destroyed = true
    }),
    flushHeaders: vi.fn(),
  }
  const reply = {
    raw,
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  }
  return { reply, raw, chunks }
}

/** Minimal chatflow stub with no credential references. */
const stubChatflow = {
  id: '00000000-0000-0000-0000-000000000000',
  name: 'test',
  flowData: '{"nodes":[],"edges":[]}',
  deployed: false,
  isPublic: false,
  apikeyid: '',
  chatbotConfig: null,
  apiConfig: null,
  analytic: null,
  speechToText: null,
  category: null,
  type: 'CHATFLOW' as const,
  createdDate: '',
  updatedDate: '',
}

describe('streamPrediction', () => {
  it('sends start, token, metadata, and end events in Flowise JSON-envelope format', async () => {
    vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
    vi.resetModules()
    const mod = await import('../src/services/predictionService.js')

    const { reply, chunks } = createMockReply()
    // biome-ignore lint/suspicious/noExplicitAny: mock reply
    await mod.streamPrediction(reply as any, 'Hello', stubChatflow)

    const allOutput = chunks.join('')

    // All events use JSON-envelope format: data: {"event":"...","data":"..."}
    const parsed = chunks
      .map((c) => c.trim())
      .filter((c) => c.startsWith('data: '))
      .map((c) => JSON.parse(c.replace('data: ', '')) as { event: string; data: string })

    const eventTypes = parsed.map((e) => e.event)
    expect(eventTypes[0]).toBe('start')
    expect(eventTypes.at(-1)).toBe('end')

    const tokenEvents = parsed.filter((e) => e.event === 'token')
    expect(tokenEvents.length).toBe(7) // 7 stub tokens

    const metaEvent = parsed.find((e) => e.event === 'metadata')
    expect(metaEvent).toBeDefined()
    const meta = JSON.parse(metaEvent?.data ?? '{}')
    expect(meta.chatId).toBeDefined()
    expect(meta.chatMessageId).toBeDefined()

    // No standard SSE event: field should appear (Flowise uses JSON envelope)
    expect(allOutput).not.toContain('event: token')

    vi.unstubAllEnvs()
  })

  it('stops writing when stream is destroyed mid-flight', async () => {
    vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
    vi.resetModules()
    const mod = await import('../src/services/predictionService.js')

    const { reply, raw, chunks } = createMockReply()
    // Destroy after first write
    raw.write = vi.fn((data: string) => {
      chunks.push(data)
      if (chunks.length >= 2) raw.destroyed = true
      return data.length
    })

    // biome-ignore lint/suspicious/noExplicitAny: mock reply
    await mod.streamPrediction(reply as any, 'Hello', stubChatflow)

    // Should have stopped early — fewer than all events (start + 7 tokens + metadata + end = 10)
    expect(chunks.length).toBeLessThan(10)
    // No end event since stream was destroyed
    const allOutput = chunks.join('')
    expect(allOutput).not.toContain('"event":"end"')

    vi.unstubAllEnvs()
  })

  it('calls endSSE in finally (cleanup)', async () => {
    vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
    vi.resetModules()
    const mod = await import('../src/services/predictionService.js')

    const { reply, raw } = createMockReply()
    // biome-ignore lint/suspicious/noExplicitAny: mock reply
    await mod.streamPrediction(reply as any, 'test', stubChatflow)

    // raw.end should have been called (endSSE)
    expect(raw.end).toHaveBeenCalled()

    vi.unstubAllEnvs()
  })
})
