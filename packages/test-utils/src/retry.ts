export interface RetryOptions {
  attempts?: number | undefined
  delayMs?: number | undefined
  backoff?: boolean | undefined
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3
  const delayMs = options.delayMs ?? 1000
  const backoff = options.backoff ?? true

  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        const waitMs = backoff ? delayMs * 2 ** i : delayMs
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }
  }

  throw lastError
}
