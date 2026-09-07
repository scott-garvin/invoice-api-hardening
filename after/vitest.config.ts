import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    hookTimeout: 20000,
    // one shared Postgres, so don't run test files in parallel
    fileParallelism: false,
  },
});
