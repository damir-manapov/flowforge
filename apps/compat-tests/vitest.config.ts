import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 15_000,
    passWithNoTests: true,
    sequence: {
      concurrent: false,
    },
    env: {
      ...(process.env.BASE_URL ? { BASE_URL: process.env.BASE_URL } : {}),
      ...(process.env.AUTH_TOKEN ? { AUTH_TOKEN: process.env.AUTH_TOKEN } : {}),
      TARGET_NAME: process.env.TARGET_NAME ?? 'reimpl',
      RECORD_GOLDENS: process.env.RECORD_GOLDENS ?? '0',
      ...(process.env.HAS_LLM ? { HAS_LLM: process.env.HAS_LLM } : {}),
    },
  },
})
