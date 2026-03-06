export interface ConcurrentResult<T> {
  results: PromiseSettledResult<T>[]
  durationMs: number
  succeeded: number
  failed: number
}

export async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency?: number | undefined,
): Promise<ConcurrentResult<T>> {
  const limit = concurrency ?? tasks.length
  const startedAt = Date.now()

  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  const executing = new Set<Promise<void>>()

  for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
    const idx = taskIdx
    const task = tasks[idx]
    if (!task) continue

    const p: Promise<void> = (async () => {
      try {
        const value = await task()
        results[idx] = { status: 'fulfilled', value }
      } catch (reason: unknown) {
        results[idx] = { status: 'rejected', reason }
      }
    })()

    executing.add(p)
    void p.then(() => executing.delete(p))

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)

  const durationMs = Date.now() - startedAt
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return { results, durationMs, succeeded, failed }
}
