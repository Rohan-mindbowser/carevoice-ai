import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Keep logs quiet and skip the pretty-print transport worker during tests.
    env: { NODE_ENV: 'test' },
  },
});
