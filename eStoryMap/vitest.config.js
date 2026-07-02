// © 2026 김용현
// eStoryMap/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    setupFiles: ['src/test/setup.js'],
  },
});
