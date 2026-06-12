import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Core logic is pure (no DOM) — Node environment is enough and fast.
    environment: 'node',
    include: ['src/core/**/*.test.ts'],
  },
});
