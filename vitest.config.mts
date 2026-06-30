import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    retry: 3,
    projects: [
      'packages/*',
    ],
    coverage: {
      provider: 'istanbul',
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/vite.config.mts',
        '**/vitest.config.mts',
      ],
    },
    reporters: process.env.GITHUB_ACTIONS ? ['dot', 'junit', 'github-actions'] : ['dot'],
  },
})
