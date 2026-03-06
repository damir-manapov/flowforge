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
  },
})
