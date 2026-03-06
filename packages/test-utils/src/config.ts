export interface TestConfig {
  baseUrl: string
  authToken: string | undefined
  targetName: string
  recordGoldens: boolean
}

export function getConfig(): TestConfig {
  const baseUrl = process.env.BASE_URL
  if (!baseUrl) {
    throw new Error('BASE_URL environment variable is required')
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    authToken: process.env.AUTH_TOKEN || undefined,
    targetName: process.env.TARGET_NAME ?? 'reimpl',
    recordGoldens: process.env.RECORD_GOLDENS === '1',
  }
}
