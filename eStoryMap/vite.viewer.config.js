// © 2026 김용현
// 웹뷰어 전용 빌드 — Electron 플러그인 없음(순수 웹). 산출물은 e-gis.kr/story/ 아래에서 서빙된다.
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/story/',
  build: {
    outDir: 'dist-viewer',
    emptyOutDir: false, // ⚠️ vite의 재귀 삭제가 CFA에 막혀 127로 죽음 — build-viewer.js가 rmdir로 선청소
    rollupOptions: { input: 'viewer.html' },
  },
});
