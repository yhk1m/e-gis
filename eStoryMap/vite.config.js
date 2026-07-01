// © 2026 김용현
// eStoryMap/vite.config.js
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    electron({
      main: { entry: 'electron/main.js' },
      preload: { input: 'electron/preload.js' },
      renderer: {},
    }),
  ],
  server: { port: 5173, strictPort: true },
});
