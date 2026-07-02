// © 2026 김용현
// eStoryMap/vite.config.js
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    electron({
      main: { entry: 'electron/main.js' },
      preload: { input: 'electron/preload.js' },
      // renderer 플러그인은 넣지 않는다: 렌더러는 Node API를 쓰지 않는 순수 웹이며
      // (sandbox + contextBridge IPC만 사용), vite-plugin-electron-renderer는
      // 의존성을 Node 엔트리(CJS)로 강제 해석해 geotiff의 require('http')가
      // dev에서 즉시 실행 코드로 남는 문제를 일으킨다.
    }),
  ],
  server: { port: 5173, strictPort: true },
});
