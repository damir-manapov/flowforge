import { describe, expect, it } from 'vitest'
import { runConcurrent } from '../src/concurrency.js'

describe('runConcurrent', () => {
  it('runs all tasks and returns results', async () => {
    const tasks = [() => Promise.resolve('a'), () => Promise.resolve('b'), () => Promise.resolve('c')]
    const { results, succeeded, failed } = await runConcurrent(tasks)
    expect(succeeded).toBe(3)
    expect(failed).toBe(0)
    expect(results).toHaveLength(3)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('preserves result order matching input order', async () => {
    const tasks = [
      () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 50)),
      () => Promise.resolve('fast'),
    ]
    const { results } = await runConcurrent(tasks)
    expect((results[0] as PromiseFulfilledResult<string>).value).toBe('slow')
    expect((results[1] as PromiseFulfilledResult<string>).value).toBe('fast')
  })

  it('handles rejected tasks without throwing', async () => {
    const tasks = [() => Promise.resolve('ok'), () => Promise.reject(new Error('fail'))]
    const { succeeded, failed, results } = await runConcurrent(tasks)
    expect(succeeded).toBe(1)
    expect(failed).toBe(1)
    expect(results[0]?.status).toBe('fulfilled')
    expect(results[1]?.status).toBe('rejected')
  })

  it('respects concurrency limit', async () => {
    let maxParallel = 0
    let current = 0

    const tasks = Array.from({ length: 6 }, () => async () => {
      current++
      maxParallel = Math.max(maxParallel, current)
      await new Promise((r) => setTimeout(r, 20))
      current--
      return 'done'
    })

    await runConcurrent(tasks, 2)
    expect(maxParallel).toBeLessThanOrEqual(2)
  })

  it('returns timing information', async () => {
    const { durationMs } = await runConcurrent([() => Promise.resolve(1)])
    expect(durationMs).toBeGreaterThanOrEqual(0)
  })
})
