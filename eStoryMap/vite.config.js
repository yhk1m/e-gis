// © 2026 김용현
// eStoryMap/vite.config.js
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    electron({
      main: { entry: 'electron/main.js' },
      // webviewPreload: e-GIS 웹앱 탭(<webview>) 저장 브릿지 — will-attach-webview에서 주입.
      // 다중 엔트리는 플러그인 기본 inlineDynamicImports와 충돌 → 명시적으로 끔.
      preload: {
        input: ['electron/preload.js', 'electron/webviewPreload.js'],
        vite: { build: { rollupOptions: { output: { inlineDynamicImports: false } } } },
      },
      // renderer 플러그인은 넣지 않는다: 렌더러는 Node API를 쓰지 않는 순수 웹이며
      // (sandbox + contextBridge IPC만 사용), vite-plugin-electron-renderer는
      // 의존성을 Node 엔트리(CJS)로 강제 해석해 geotiff의 require('http')가
      // dev에서 즉시 실행 코드로 남는 문제를 일으킨다.
    }),
  ],
  server: { port: 5173, strictPort: true },
});
