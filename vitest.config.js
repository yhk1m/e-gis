// © 2026 김용현
import { defineConfig } from 'vitest/config';

// eStoryMap/ is a separate sub-project with its own test suite and setup.
// 루트 npm test는 e-GIS 본체(src/)만 대상으로 한다.
export default defineConfig({
  test: {
    include: ['src/**/*.test.js']
  }
});
