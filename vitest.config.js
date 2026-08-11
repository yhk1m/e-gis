// © 2026 김용현
import { defineConfig } from 'vitest/config';

// eStoryMap/ is a separate sub-project with its own test suite and setup.
// 루트 npm test는 e-GIS 본체(src/)만 대상으로 한다.
export default defineConfig({
  test: {
    // api/는 Vercel 서버리스 함수. 순수 로직(정규화·허용목록)은 여기서 함께 검증한다.
    include: ['src/**/*.test.js', 'api/**/*.test.js']
  }
});
