import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^cr-26\/test$/, replacement: path.resolve(__dirname, '../../src/component-test.ts') },
      { find: 'cr-26', replacement: path.resolve(__dirname, '../../src/cr-26.ts') }
    ]
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.spec.ts'],
  },
});

