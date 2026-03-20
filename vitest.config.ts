import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    globals: true,
    coverage: {
      exclude: [
        'server/index.js',
        'cli/index.js',
        'server/openapi.js',
      ],
    },
  },
});
