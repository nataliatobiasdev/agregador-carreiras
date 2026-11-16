import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/main/domain/**', 'src/main/services/**', 'src/shared/**'],
      thresholds: { 'src/main/domain/**': { lines: 80, functions: 80, branches: 80, statements: 80 } }
    }
  }
})
