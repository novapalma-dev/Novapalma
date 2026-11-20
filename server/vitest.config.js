import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules/**', 'tests/integration/db.integration.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: ['src/config/db.js'],
      thresholds: {
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60
      }
    }
  }
});
