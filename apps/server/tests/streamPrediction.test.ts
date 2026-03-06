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

describe('streamPrediction', () => {
  it('sends token events followed by an end event', async () => {
    vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
    vi.resetModules()
    const mod = await import('../src/services/predictionService.js')

    const { reply, chunks } = createMockReply()
    // biome-ignore lint/suspicious/noExplicitAny: mock reply
    await mod.streamPrediction(reply as any, 'Hello')

    const allOutput = chunks.join('')
    expect(allOutput).toContain('event: token')
    expect(allOutput).toContain('event: end')

    const tokenCount = (allOutput.match(/event: token/g) ?? []).length
    expect(tokenCount).toBe(7) // 7 stub tokens

    // End payload is valid JSON with expected fields
    const endLine = allOutput.split('\n').find((line) => line.startsWith('data: ') && line.includes('"question"'))
    expect(endLine).toBeDefined()
    const payload = JSON.parse(endLine?.replace('data: ', '') ?? '')
    expect(payload.question).toBe('Hello')
    expect(payload.chatId).toBeDefined()

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
    await mod.streamPrediction(reply as any, 'Hello')

    // Should have stopped early — fewer than all 7 tokens + end
    const allOutput = chunks.join('')
    const tokenCount = (allOutput.match(/event: token/g) ?? []).length
    expect(tokenCount).toBeLessThan(7)
    // No end event since stream was destroyed
    expect(allOutput).not.toContain('event: end')

    vi.unstubAllEnvs()
  })

  it('calls endSSE in finally (cleanup)', async () => {
    vi.stubEnv('STUB_TOKEN_DELAY_MS', '0')
    vi.resetModules()
    const mod = await import('../src/services/predictionService.js')

    const { reply, raw } = createMockReply()
    // biome-ignore lint/suspicious/noExplicitAny: mock reply
    await mod.streamPrediction(reply as any, 'test')

    // raw.end should have been called (endSSE)
    expect(raw.end).toHaveBeenCalled()

    vi.unstubAllEnvs()
  })
})
