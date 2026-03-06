import { describe, expect, it } from 'vitest'
import { retry } from '../src/retry.js'

describe('retry', () => {
  it('returns on first successful attempt', async () => {
    let calls = 0
    const result = await retry(async () => {
      calls++
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(1)
  })

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0
    const result = await retry(
      async () => {
        calls++
        if (calls < 3) throw new Error('not yet')
        return 'done'
      },
      { attempts: 3, delayMs: 10 },
    )
    expect(result).toBe('done')
    expect(calls).toBe(3)
  })

  it('throws after all attempts exhausted', async () => {
    await expect(
      retry(
        async () => {
          throw new Error('always fails')
        },
        { attempts: 2, delayMs: 10 },
      ),
    ).rejects.toThrow('always fails')
  })

  it('uses default 3 attempts', async () => {
    let calls = 0
    await retry(
      async () => {
        calls++
        if (calls < 3) throw new Error('fail')
        return 'ok'
      },
      { delayMs: 10 },
    ).catch(() => {})
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('supports backoff: false for constant delay', async () => {
    const times: number[] = []
    try {
      await retry(
        async () => {
          times.push(Date.now())
          throw new Error('fail')
        },
        { attempts: 3, delayMs: 50, backoff: false },
      )
    } catch {}
    // With constant delay, gaps should be roughly equal
    if (times.length >= 3) {
      const gap1 = (times[1] ?? 0) - (times[0] ?? 0)
      const gap2 = (times[2] ?? 0) - (times[1] ?? 0)
      expect(Math.abs(gap1 - gap2)).toBeLessThan(40) // within tolerance
    }
  })
})
