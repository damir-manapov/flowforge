export interface ConcurrentResult<T> {
  results: PromiseSettledResult<T>[]
  durationMs: number
  succeeded: number
  failed: number
}

export async function runConcurrent<T>(tasks: (() => Promise<T>)[], concurrency?: number | undefined): Promise<ConcurrentResult<T>> {
  const limit = concurrency ?? tasks.length
  const startedAt = Date.now()

  const results: PromiseSettledResult<T>[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const p = task()
      .then((value) => {
        results.push({ status: 'fulfilled', value })
      })
      .catch((reason: unknown) => {
        results.push({ status: 'rejected', reason })
      })
      .then(() => {
        executing.splice(executing.indexOf(p), 1)
      })

    executing.push(p)

    if (executing.length >= limit) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)

  const durationMs = Date.now() - startedAt
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return { results, durationMs, succeeded, failed }
}
