import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/db.integration.test.js'],
    testTimeout: 15000
  }
});
