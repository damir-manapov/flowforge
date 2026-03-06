export interface RetryOptions {
  attempts?: number | undefined
  delayMs?: number | undefined
  backoff?: boolean | undefined
  jitter?: boolean | undefined
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3
  const delayMs = options.delayMs ?? 1000
  const backoff = options.backoff ?? true
  const jitter = options.jitter ?? true

  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        const baseMs = backoff ? delayMs * 2 ** i : delayMs
        const waitMs = jitter ? baseMs * (0.5 + Math.random() * 0.5) : baseMs
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }
  }

  throw lastError
}
