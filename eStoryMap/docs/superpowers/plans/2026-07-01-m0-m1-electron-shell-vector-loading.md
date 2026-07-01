# eStoryMap M0–M1: Electron 셸 + 벡터 .egis 로딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빈 화면에서 시작해, Electron 데스크톱 셸을 띄우고 로컬 `.egis` 파일을 열어 그 안의 벡터 레이어를 OpenLayers 지도에 그려 "e-GIS 코어 이식이 성립함"을 검증한다.

**Architecture:** Electron 3-프로세스(main / preload / renderer). main은 파일시스템(`~/Desktop/eStoryMap/` 생성·`.egis` 열기)만 담당하고, renderer는 e-GIS 코어의 순수 로직(`.egis` 파싱, GeoJSON→OL 피처, 벡터 스타일)을 이식해 지도를 그린다. `.egis` 파싱/스타일 생성은 **OL·DOM에 의존하지 않는 순수 함수**로 분리해 Vitest로 단위 테스트하고, OL `Map` 접착부(`MapView`)는 얇게 유지해 수동 스모크로 검증한다.

**Tech Stack:** Electron 30 + Vite 5 (vite-plugin-electron) + Vanilla JS + OpenLayers 9 + Vitest. (React·TypeScript 없음 — 상위 스펙 `eStoryMap-PLAN.md`의 스택 결정.)

---

## 이 계획의 범위 (중요)

이 계획은 상위 스펙 `eStoryMap-PLAN.md`(repo 루트)의 **M0 + M1만** 다룬다. 다음은 **의도적으로 이후 계획으로 미룸(YAGNI)**:

- `SourceRegistry`(여러 소스 관리) — 페이지가 생기는 M3부터 의미 있음. M1은 단일 로드로 이식만 검증.
- DEM/래스터(M2), 문서·페이지 모델(M3), 카메라 캡처(M4), 콘텐츠(M5), 로컬 자동저장(M6), 로그인·클라우드(M7–M8), 뷰어(M9–M10), 패키징(M11).
- `overrides`(페이지별 스타일), 마크다운 본문 — 각 해당 마일스톤에서.

M1의 완료 기준은 "**로컬 `.egis`를 열면 벡터가 지도에 보인다**"까지.

## 이식 원본과 확정 사실 (실측 완료)

아래는 e-GIS 소스를 직접 읽어 확인한 사실이다. 계획의 코드는 이 사실에 맞춰 작성되었다.

1. **`.egis` = JSON**. 구조(`src/core/ProjectManager.js` `serialize()`):
   ```jsonc
   {
     "version": "1.0",
     "name": "프로젝트명",
     "created": "ISO8601",
     "view": { "center": [lon, lat], "zoom": 7.2 },   // ★ EPSG:4326 경위도!
     "displayCRS": "EPSG:3857",
     "layers": [
       { "id","name","type":"vector","geometryType","visible","color","opacity",
         "features": { /* GeoJSON FeatureCollection, EPSG:4326 */ } },
       { "id","name","type":"raster","rasterKind":"dem|analysis|unknown","raster": {…} }
     ]
   }
   ```
2. **★ 좌표계 정정:** 상위 스펙 §1·§8은 `view.center`를 "EPSG:3857"이라 적었으나 **틀렸다.** e-GIS `MapManager.getCenter()`가 `toLonLat(center)`를 반환하므로 `.egis`의 `view.center`는 **EPSG:4326(경도, 위도)**다. 지도 투영은 3857이므로 카메라 복원 시 반드시 `fromLonLat(center)`를 거쳐야 한다. (이 계획은 그렇게 구현한다.)
3. **벡터 피처 복원**(`ProjectManager.deserialize()`): `new GeoJSON().readFeatures(layerData.features, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' })`.
4. **벡터 스타일**(`LayerManager.createStyle()` + `hexToRgba()`):
   - `Point`/`MultiPoint` → `CircleStyle`(반지름 6, fill=색, stroke 흰색 2)
   - `LineString`/`MultiLineString` → `Stroke`(색, 두께 3)
   - 그 외(폴리곤) → `Fill`(hexToRgba(색, 0.3)) + `Stroke`(색, 두께 2)
5. **OL 지도 초기화**(`MapManager.init()`): 투영 기본(EPSG:3857), 베이스맵 `TileLayer`+`OSM`, `View({ center: fromLonLat([127.5, 36.5]), zoom: 7, minZoom: 2, maxZoom: 19 })`.
6. **Electron 패턴**은 형제 프로젝트 `SHcore`(`electron/main.ts`, `preload.ts`, `vite-plugin-electron/simple`)를 따르되 Vanilla JS(`.js`)로 작성. `package.json`에 `"type": "module"`을 두지 않아 번들된 main이 CJS로 실행되게 한다(SHcore와 동일).

## File Structure

앱 루트: `C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/` (이하 경로는 이 루트 기준 상대경로).

| 파일 | 책임 |
|---|---|
| `package.json` | 의존성·스크립트. `main: dist-electron/main.js`. `"type": "module"` 없음. |
| `vite.config.js` | `vite-plugin-electron/simple`로 main·preload·renderer 연결. |
| `vitest.config.js` | 단위 테스트 설정(jsdom 환경, `src/**/*.test.js`). |
| `.gitignore` | node_modules·빌드 산출물 제외. |
| `index.html` | renderer 진입 HTML. 툴바 + `#map`. |
| `src/style.css` | 최소 레이아웃/다크 스타일. |
| `src/main.js` | renderer 진입점. 지도 생성 + "열기" 버튼 배선. |
| `electron/main.js` | BrowserWindow, 앱 생명주기, IPC 핸들러. |
| `electron/preload.js` | `contextBridge`로 `window.egisFS` 화이트리스트 API 노출. |
| `electron/fileService.js` | `~/Desktop/eStoryMap/` 생성·`.esm` 목록/읽기/쓰기. |
| `src/core/egisParse.js` | **순수**: `.egis` JSON 검증·정규화. |
| `src/core/egisLayers.js` | **순수/OL**: 벡터 스타일·GeoJSON→OL 피처·OL 벡터 레이어 빌드. |
| `src/core/MapView.js` | OL `Map` 얇은 래퍼(접착부). |
| `src/core/EgisLoader.js` | 파싱→레이어 빌드→지도 반영 오케스트레이션. |
| `src/core/egisParse.test.js` | egisParse 단위 테스트. |
| `src/core/egisLayers.test.js` | egisLayers 단위 테스트. |
| `fixtures/sample.egis` | 수동 스모크용 최소 벡터 `.egis`. |

핵심 경계: **순수 로직(`egisParse`, `egisLayers`)** ↔ **OL 접착부(`MapView`)** ↔ **오케스트레이션(`EgisLoader`)**. 테스트는 순수부에 집중하고, OL 렌더링은 수동 스모크로 확인한다.

---

## Task 1: 프로젝트 스캐폴드 & 설정

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `.gitignore`
- Create: `index.html`
- Create: `src/style.css`
- Create: `src/main.js` (임시 stub — Task 6에서 완성)

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "estorymap",
  "version": "0.1.0",
  "description": "지도 스토리텔링 데스크톱 앱 (e-GIS 연동)",
  "main": "dist-electron/main.js",
  "author": "김용현",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build && electron-builder",
    "build:unpack": "vite build && electron-builder --dir",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ol": "^9.0.0"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.13.3",
    "vite": "^5.2.0",
    "vite-plugin-electron": "^0.28.6",
    "vite-plugin-electron-renderer": "^0.14.5",
    "vitest": "^1.6.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: `vite.config.js` 작성**

```js
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
```

- [ ] **Step 3: `vitest.config.js` 작성**

jsdom 환경으로 두어 OL 모듈이 `document`를 참조해도 안전하게 한다(단위 테스트는 렌더링을 하지 않지만 방어적으로).

```js
// eStoryMap/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
  },
});
```

- [ ] **Step 4: `.gitignore` 작성**

```gitignore
node_modules/
dist/
dist-electron/
release/
*.log
```

- [ ] **Step 5: `index.html` 작성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>eStoryMap</title>
    <link rel="stylesheet" href="./src/style.css" />
  </head>
  <body>
    <div id="app">
      <header id="toolbar">
        <strong class="brand">eStoryMap</strong>
        <button id="btn-import" type="button">.egis 열기</button>
        <button id="btn-folder" type="button">저장 폴더 열기</button>
        <span id="status"></span>
      </header>
      <div id="map"></div>
    </div>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: `src/style.css` 작성**

```css
/* eStoryMap/src/style.css */
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
#app { display: flex; flex-direction: column; font-family: system-ui, "Segoe UI", sans-serif; }
#toolbar { display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: #0b0f14; color: #e5e7eb; }
#toolbar .brand { margin-right: 8px; }
#toolbar button { padding: 6px 12px; border: 1px solid #334155; background: #1e293b; color: #e5e7eb; border-radius: 6px; cursor: pointer; }
#toolbar button:hover { background: #334155; }
#status { margin-left: auto; font-size: 13px; color: #94a3b8; }
#map { flex: 1; background: #0b0f14; }
```

- [ ] **Step 7: `src/main.js` 임시 stub 작성** (Task 6에서 완성)

```js
// eStoryMap/src/main.js
console.log('eStoryMap renderer booted');
```

- [ ] **Step 8: 의존성 설치**

Run: `npm install`
Expected: 에러 없이 완료. `node_modules/`, `package-lock.json` 생성.

- [ ] **Step 9: Vitest가 동작하는지 확인(아직 테스트 없음)**

Run: `npm test`
Expected: "No test files found" 유사 메시지로 정상 종료(설정이 로드됨을 확인). 실패 아님.

- [ ] **Step 10: 커밋**

```bash
git add eStoryMap/package.json eStoryMap/vite.config.js eStoryMap/vitest.config.js eStoryMap/.gitignore eStoryMap/index.html eStoryMap/src/style.css eStoryMap/src/main.js
git commit -m "chore(eStoryMap): M0 프로젝트 스캐폴드(Vite+Electron+Vitest 설정)"
```

---

## Task 2: Electron 셸 — 빈 창 + 저장 폴더 자동 생성 (M0)

**Files:**
- Create: `electron/fileService.js`
- Create: `electron/main.js`
- Create: `electron/preload.js`

- [ ] **Step 1: `electron/fileService.js` 작성** — `~/Desktop/eStoryMap/` 관리

```js
// eStoryMap/electron/fileService.js
// ~/Desktop/eStoryMap/ 폴더 관리 + .esm 프로젝트 파일 목록/읽기/쓰기.
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

export function baseDir() {
  return path.join(app.getPath('desktop'), 'eStoryMap');
}

export function ensureBaseDir() {
  const dir = baseDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitize(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'untitled';
}

export async function listProjects() {
  const dir = ensureBaseDir();
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.esm'))
    .map((e) => e.name.replace(/\.esm$/, ''));
}

export async function readProject(name) {
  const file = path.join(ensureBaseDir(), sanitize(name) + '.esm');
  return await fsp.readFile(file, 'utf-8');
}

export async function writeProject(name, json) {
  const file = path.join(ensureBaseDir(), sanitize(name) + '.esm');
  await fsp.writeFile(file, json, 'utf-8');
  return path.basename(file);
}
```

- [ ] **Step 2: `electron/main.js` 작성** — BrowserWindow + IPC (SHcore 패턴 이식, Vanilla JS)

```js
// eStoryMap/electron/main.js
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fsp from 'node:fs/promises';
import {
  ensureBaseDir, baseDir, listProjects, readProject, writeProject,
} from './fileService.js';

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'eStoryMap',
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ensureBaseDir();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// .egis 열기 (Task 6에서 renderer가 사용)
ipcMain.handle('egis:import', async () => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, {
    title: '.egis 파일 열기',
    filters: [{ name: 'e-GIS Project', extensions: ['egis', 'json'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const text = await fsp.readFile(r.filePaths[0], 'utf-8');
  return { filename: path.basename(r.filePaths[0]), text };
});

// 로컬 .esm 저장/목록 (M6에서 본격 사용 — 여기선 골격만 배선)
ipcMain.handle('project:list', () => listProjects());
ipcMain.handle('project:read', (_e, name) => readProject(name));
ipcMain.handle('project:save', (_e, name, json) => writeProject(name, json));
ipcMain.handle('project:openFolder', () => shell.openPath(baseDir()));
```

- [ ] **Step 3: `electron/preload.js` 작성** — `window.egisFS` 노출

```js
// eStoryMap/electron/preload.js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('egisFS', {
  importEgis: () => ipcRenderer.invoke('egis:import'),          // → {filename, text} | null
  listProjects: () => ipcRenderer.invoke('project:list'),       // → string[]
  loadProject: (name) => ipcRenderer.invoke('project:read', name),
  saveProject: (name, json) => ipcRenderer.invoke('project:save', name, json),
  openFolder: () => ipcRenderer.invoke('project:openFolder'),
});
```

- [ ] **Step 4: 앱 실행(수동 스모크)**

Run: `npm run dev`
Expected:
1. Electron 창이 뜨고 상단 툴바(eStoryMap · `.egis 열기` · `저장 폴더 열기`)와 검은 지도 영역이 보인다.
2. DevTools 콘솔에 `eStoryMap renderer booted`.
3. **`~/Desktop/eStoryMap/` 폴더가 새로 생성**된다(파일 탐색기로 확인).
4. `저장 폴더 열기` 클릭 시 그 폴더가 파일 탐색기에 열린다.

수동 확인 항목이므로 결과(창·폴더 생성 여부)를 육안으로 확인한 뒤 다음 단계로.

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/electron/main.js eStoryMap/electron/preload.js eStoryMap/electron/fileService.js
git commit -m "feat(eStoryMap): M0 Electron 셸 — 빈 창 + ~/Desktop/eStoryMap 자동 생성 + fs IPC"
```

---

## Task 3: `.egis` 파싱·정규화 (순수, TDD)

**Files:**
- Test: `src/core/egisParse.test.js`
- Create: `src/core/egisParse.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/egisParse.test.js`

```js
import { describe, it, expect } from 'vitest';
import { parseEgisDoc } from './egisParse.js';

const SAMPLE = {
  version: '1.0',
  name: '부산 인구',
  view: { center: [129.0, 35.1], zoom: 8.5 },
  displayCRS: 'EPSG:3857',
  layers: [
    {
      id: 'L_a', name: '인구', type: 'vector', geometryType: 'Polygon',
      visible: true, color: '#ef4444', opacity: 1,
      features: { type: 'FeatureCollection', features: [] },
    },
  ],
};

describe('parseEgisDoc', () => {
  it('유효한 .egis를 정규화한다', () => {
    const doc = parseEgisDoc(SAMPLE);
    expect(doc.name).toBe('부산 인구');
    expect(doc.view.center).toEqual([129.0, 35.1]); // EPSG:4326 경위도 그대로
    expect(doc.view.zoom).toBe(8.5);
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0].id).toBe('L_a');
    expect(doc.layers[0].type).toBe('vector');
  });

  it('version이 없으면 에러', () => {
    expect(() => parseEgisDoc({ name: 'x' })).toThrow(/version/);
  });

  it('객체가 아니면 에러', () => {
    expect(() => parseEgisDoc(null)).toThrow();
  });

  it('view가 없으면 한국 중심 기본값(4326)', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [] });
    expect(doc.view.center).toEqual([127.5, 36.5]);
    expect(doc.view.zoom).toBe(7);
  });

  it('레이어 id/visible 누락 시 채운다', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'vector' }] });
    expect(doc.layers[0].id).toBe('L_0');
    expect(doc.layers[0].visible).toBe(true);
    expect(doc.layers[0].color).toBe('#3b82f6');
  });

  it('알 수 없는 type은 vector로 정규화', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'weird' }] });
    expect(doc.layers[0].type).toBe('vector');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/egisParse.test.js`
Expected: FAIL — `parseEgisDoc` 미정의(모듈 없음).

- [ ] **Step 3: 최소 구현** — `src/core/egisParse.js`

```js
// eStoryMap/src/core/egisParse.js
// .egis(JSON) 검증·정규화 — 순수 함수. OL·DOM 의존 없음.
// 이식 원본: e-GIS src/core/ProjectManager.js deserialize()의 형식 규약.

const SUPPORTED_LAYER_TYPES = new Set(['vector', 'raster']);

/**
 * .egis 원본 JSON을 검증하고 정규화한다.
 * @param {object} raw - JSON.parse된 .egis 객체
 * @returns {{version:string, name:string, view:{center:number[], zoom:number},
 *            displayCRS:string, layers:object[]}}
 * @throws {Error} 객체가 아니거나 version이 없으면
 */
export function parseEgisDoc(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('유효하지 않은 .egis 파일입니다: 객체가 아님');
  }
  if (!raw.version) {
    throw new Error('유효하지 않은 .egis 파일입니다: version 누락');
  }

  // ★ view.center는 EPSG:4326(경도, 위도). 기본값도 경위도.
  const view = raw.view && Array.isArray(raw.view.center)
    ? { center: raw.view.center, zoom: Number(raw.view.zoom) || 7 }
    : { center: [127.5, 36.5], zoom: 7 };

  const layers = Array.isArray(raw.layers) ? raw.layers.map(normalizeLayer) : [];

  return {
    version: String(raw.version),
    name: raw.name || '불러온 프로젝트',
    view,
    displayCRS: raw.displayCRS || 'EPSG:3857',
    layers,
  };
}

function normalizeLayer(layer, i) {
  const type = SUPPORTED_LAYER_TYPES.has(layer.type) ? layer.type : 'vector';
  return {
    id: layer.id || `L_${i}`,
    name: layer.name || `레이어 ${i + 1}`,
    type,
    geometryType: layer.geometryType || null,
    visible: layer.visible !== false,
    color: layer.color || '#3b82f6',
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
    features: layer.features || null,      // 벡터: GeoJSON FC (EPSG:4326)
    rasterKind: layer.rasterKind || null,  // 래스터: 'dem'|'analysis'|'unknown' (M2)
    raster: layer.raster || null,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/egisParse.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/egisParse.js eStoryMap/src/core/egisParse.test.js
git commit -m "feat(eStoryMap): M1 .egis 파싱·정규화 parseEgisDoc(순수, view.center는 4326)"
```

---

## Task 4: 벡터 스타일·피처 이식 (순수/OL, TDD)

**Files:**
- Test: `src/core/egisLayers.test.js`
- Create: `src/core/egisLayers.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/egisLayers.test.js`

```js
import { describe, it, expect } from 'vitest';
import { hexToRgba, createVectorStyle, readVectorFeatures, buildVectorLayer } from './egisLayers.js';

describe('hexToRgba', () => {
  it('hex를 rgba로 변환', () => {
    expect(hexToRgba('#ef4444', 0.3)).toBe('rgba(239, 68, 68, 0.3)');
  });
  it('잘못된 값은 회색', () => {
    expect(hexToRgba(null, 1)).toBe('rgba(128, 128, 128, 1)');
  });
  it('이미 rgb(a) 문자열이면 그대로', () => {
    expect(hexToRgba('rgba(1,2,3,0.5)')).toBe('rgba(1,2,3,0.5)');
  });
});

describe('createVectorStyle', () => {
  it('Point는 image(원) 스타일, fill 없음', () => {
    const s = createVectorStyle('#3b82f6', 'Point');
    expect(s.getImage()).toBeTruthy();
    expect(s.getFill()).toBeFalsy();
  });
  it('LineString은 stroke만', () => {
    const s = createVectorStyle('#3b82f6', 'LineString');
    expect(s.getStroke()).toBeTruthy();
    expect(s.getFill()).toBeFalsy();
    expect(s.getImage()).toBeFalsy();
  });
  it('Polygon은 fill+stroke', () => {
    const s = createVectorStyle('#3b82f6', 'Polygon');
    expect(s.getFill()).toBeTruthy();
    expect(s.getStroke()).toBeTruthy();
  });
});

describe('readVectorFeatures', () => {
  const FC = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: '부산' },
        geometry: { type: 'Point', coordinates: [129.0, 35.1] } },
    ],
  };
  it('GeoJSON(4326) → OL Feature[] (좌표는 3857로 변환)', () => {
    const feats = readVectorFeatures(FC);
    expect(feats).toHaveLength(1);
    const [x] = feats[0].getGeometry().getCoordinates();
    // 129°E는 웹메르카토르에서 약 1.436e7 m
    expect(x).toBeGreaterThan(1.4e7);
    expect(x).toBeLessThan(1.5e7);
  });
  it('features가 null이면 빈 배열', () => {
    expect(readVectorFeatures(null)).toEqual([]);
  });
});

describe('buildVectorLayer', () => {
  it('정규화된 벡터 레이어 → OL VectorLayer(egisLayerId 부여, visible 반영)', () => {
    const layerData = {
      id: 'L_a', name: '인구', type: 'vector', geometryType: 'Polygon',
      visible: false, color: '#ef4444', opacity: 1,
      features: { type: 'FeatureCollection', features: [] },
    };
    const layer = buildVectorLayer(layerData);
    expect(layer.get('egisLayerId')).toBe('L_a');
    expect(layer.getVisible()).toBe(false);
    expect(layer.getSource()).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/egisLayers.test.js`
Expected: FAIL — `egisLayers.js` 없음.

- [ ] **Step 3: 최소 구현** — `src/core/egisLayers.js`

```js
// eStoryMap/src/core/egisLayers.js
// .egis 벡터 레이어 → OpenLayers. 이식 원본: e-GIS src/core/LayerManager.js
// (createStyle, hexToRgba) + ProjectManager.js(readFeatures 투영 규약).
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

/** hex 색을 rgba 문자열로. e-GIS LayerManager.hexToRgba 이식. */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(128, 128, 128, ${alpha})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  if (!hex.startsWith('#')) hex = '#' + hex;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 색 + 지오메트리 타입 → OL Style. e-GIS LayerManager.createStyle 이식. */
export function createVectorStyle(color, geometryType = 'Polygon') {
  if (geometryType === 'Point' || geometryType === 'MultiPoint') {
    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    });
  }
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
    return new Style({ stroke: new Stroke({ color, width: 3 }) });
  }
  return new Style({
    fill: new Fill({ color: hexToRgba(color, 0.3) }),
    stroke: new Stroke({ color, width: 2 }),
  });
}

/** .egis features(GeoJSON FC, EPSG:4326) → OL Feature[] (지도 투영 EPSG:3857). */
export function readVectorFeatures(featuresGeoJSON) {
  if (!featuresGeoJSON) return [];
  return new GeoJSON().readFeatures(featuresGeoJSON, {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326',
  });
}

/** 정규화된 벡터 레이어 데이터(egisParse 산출) → OL VectorLayer. */
export function buildVectorLayer(layerData) {
  const features = readVectorFeatures(layerData.features);
  const firstGeom = features[0] && features[0].getGeometry();
  const geometryType = layerData.geometryType || (firstGeom && firstGeom.getType()) || 'Polygon';
  const layer = new VectorLayer({
    source: new VectorSource({ features }),
    style: createVectorStyle(layerData.color, geometryType),
    visible: layerData.visible,
  });
  layer.set('egisLayerId', layerData.id);
  layer.set('egisLayerName', layerData.name);
  return layer;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/egisLayers.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/core/egisLayers.js eStoryMap/src/core/egisLayers.test.js
git commit -m "feat(eStoryMap): M1 벡터 스타일·피처 이식(createVectorStyle/readVectorFeatures/buildVectorLayer)"
```

---

## Task 5: OL 지도 래퍼 + 로더 오케스트레이션

**Files:**
- Create: `src/core/MapView.js`
- Create: `src/core/EgisLoader.js`

> `MapView`는 OL `Map`(캔버스 렌더)을 감싸는 접착부라 단위 테스트하지 않고 Task 6의 수동 스모크로 검증한다. `EgisLoader`는 순수부를 조립만 하므로 별도 테스트 없이 스모크로 검증(로직은 Task 3·4에서 이미 커버됨).

- [ ] **Step 1: `src/core/MapView.js` 작성** — OL Map 얇은 래퍼 (e-GIS MapManager 초기화부 발췌)

```js
// eStoryMap/src/core/MapView.js
// OpenLayers 지도 얇은 래퍼. e-GIS src/core/MapManager.js의 init/좌표변환만 발췌.
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { createEmpty, extend, isEmpty } from 'ol/extent';

export class MapView {
  /** @param {string} target - 지도 컨테이너 DOM id */
  constructor(target) {
    this.baseLayer = new TileLayer({ source: new OSM(), properties: { type: 'base' } });
    this.map = new Map({
      target,
      layers: [this.baseLayer],
      view: new View({
        center: fromLonLat([127.5, 36.5]), // 한국 중심(경위도 → 3857)
        zoom: 7,
        minZoom: 2,
        maxZoom: 19,
      }),
    });
  }

  addLayer(olLayer) {
    this.map.addLayer(olLayer);
  }

  /** center: [경도, 위도] (EPSG:4326, .egis view.center 포맷). */
  setView(center, zoom) {
    const view = this.map.getView();
    if (Array.isArray(center)) view.setCenter(fromLonLat(center));
    if (typeof zoom === 'number' && !Number.isNaN(zoom)) view.setZoom(zoom);
  }

  /** 주어진 OL 벡터 레이어들의 합집합 범위로 맞춤. */
  fitToLayers(olLayers) {
    const ext = createEmpty();
    for (const l of olLayers) {
      const src = l.getSource && l.getSource();
      if (src && src.getExtent) extend(ext, src.getExtent());
    }
    if (!isEmpty(ext) && Number.isFinite(ext[0])) {
      this.map.getView().fit(ext, { padding: [40, 40, 40, 40], duration: 300 });
    }
  }

  updateSize() {
    this.map.updateSize();
  }
}
```

- [ ] **Step 2: `src/core/EgisLoader.js` 작성** — 파싱→빌드→지도 반영

```js
// eStoryMap/src/core/EgisLoader.js
// .egis 원본 JSON → 지도에 벡터 레이어 반영. (M1: 벡터만. 래스터는 M2에서 확장.)
import { parseEgisDoc } from './egisParse.js';
import { buildVectorLayer } from './egisLayers.js';

/**
 * @param {object} rawJson - JSON.parse된 .egis
 * @param {import('./MapView.js').MapView} mapView
 * @returns {{name:string, vectorCount:number, skipped:number, layers:object[]}}
 */
export function loadEgisIntoMap(rawJson, mapView) {
  const doc = parseEgisDoc(rawJson);
  const olLayers = [];
  let skipped = 0;

  for (const layerData of doc.layers) {
    if (layerData.type !== 'vector') { skipped++; continue; } // 래스터는 M2
    const olLayer = buildVectorLayer(layerData);
    mapView.addLayer(olLayer);
    olLayers.push(olLayer);
  }

  mapView.setView(doc.view.center, doc.view.zoom);
  if (olLayers.length) mapView.fitToLayers(olLayers);

  return { name: doc.name, vectorCount: olLayers.length, skipped, layers: olLayers };
}
```

- [ ] **Step 3: 전체 테스트가 여전히 통과하는지 확인**

Run: `npm test`
Expected: PASS (Task 3·4의 15 tests). 새 파일은 import 에러 없이 로드됨.

- [ ] **Step 4: 커밋**

```bash
git add eStoryMap/src/core/MapView.js eStoryMap/src/core/EgisLoader.js
git commit -m "feat(eStoryMap): M1 OL 지도 래퍼 MapView + .egis 로더 EgisLoader"
```

---

## Task 6: renderer 배선 + 수동 스모크 (M1 완료)

**Files:**
- Modify: `src/main.js` (Task 1의 stub 전체 교체)
- Create: `fixtures/sample.egis`

- [ ] **Step 1: `src/main.js` 완성** (stub을 아래로 교체)

```js
// eStoryMap/src/main.js
import 'ol/ol.css';
import { MapView } from './core/MapView.js';
import { loadEgisIntoMap } from './core/EgisLoader.js';

const mapView = new MapView('map');
const status = document.getElementById('status');

document.getElementById('btn-import').addEventListener('click', async () => {
  const picked = await window.egisFS.importEgis();
  if (!picked) return;
  try {
    const raw = JSON.parse(picked.text);
    const result = loadEgisIntoMap(raw, mapView);
    const rasterNote = result.skipped ? ` (래스터 ${result.skipped}개는 M2에서)` : '';
    status.textContent = `${picked.filename} — 벡터 ${result.vectorCount}개 로드${rasterNote}`;
  } catch (e) {
    status.textContent = `불러오기 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});
```

- [ ] **Step 2: 스모크용 최소 `.egis` 픽스처 작성** — `fixtures/sample.egis`

부산 부근의 작은 폴리곤 1개 + 포인트 1개. (실제 e-GIS에서 내보낸 `.egis`가 있으면 그걸 써도 됨.)

```json
{
  "version": "1.0",
  "name": "샘플 부산",
  "created": "2026-07-01T00:00:00.000Z",
  "view": { "center": [129.05, 35.16], "zoom": 11 },
  "displayCRS": "EPSG:3857",
  "layers": [
    {
      "id": "L_area",
      "name": "예시 폴리곤",
      "type": "vector",
      "geometryType": "Polygon",
      "visible": true,
      "color": "#ef4444",
      "opacity": 1,
      "features": {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": { "name": "구역 A" },
            "geometry": {
              "type": "Polygon",
              "coordinates": [[[129.00,35.12],[129.10,35.12],[129.10,35.20],[129.00,35.20],[129.00,35.12]]]
            }
          }
        ]
      }
    },
    {
      "id": "L_pt",
      "name": "예시 지점",
      "type": "vector",
      "geometryType": "Point",
      "visible": true,
      "color": "#3b82f6",
      "opacity": 1,
      "features": {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": { "name": "지점 1" },
            "geometry": { "type": "Point", "coordinates": [129.05, 35.16] }
          }
        ]
      }
    }
  ]
}
```

- [ ] **Step 3: 앱 실행 후 수동 스모크**

Run: `npm run dev`
Expected(육안 확인):
1. 창이 뜨고 지도(OSM 배경)가 보인다.
2. `.egis 열기` → `fixtures/sample.egis` 선택.
3. 지도가 부산 부근(줌 11)으로 이동하고, **빨간 폴리곤 구역 + 파란 점**이 보인다.
4. 상단 상태줄: `sample.egis — 벡터 2개 로드`.
5. (선택) 실제 e-GIS에서 내보낸 `.egis`를 열어 벡터 레이어가 제대로 그려지는지 추가 확인. 래스터가 포함된 파일이면 `(래스터 N개는 M2에서)` 문구가 함께 표시되고 벡터만 그려지면 정상.

- [ ] **Step 4: 자동 테스트 최종 확인**

Run: `npm test`
Expected: PASS (15 tests).

- [ ] **Step 5: 커밋**

```bash
git add eStoryMap/src/main.js eStoryMap/fixtures/sample.egis
git commit -m "feat(eStoryMap): M1 renderer 배선 — .egis 열어 벡터 렌더 + 스모크 픽스처"
```

---

## Self-Review

**1. 스펙 커버리지 (M0–M1 범위):**
- M0 "main/preload/renderer 골격" → Task 2. ✓
- M0 "~/Desktop/eStoryMap/ 자동 생성" → `fileService.ensureBaseDir` + `app.whenReady`에서 호출(Task 2 Step 1·2). ✓
- M0 "contextBridge fs API" → `preload.js` `window.egisFS`(Task 2 Step 3). ✓
- M0 "빈 창 + Vite 연동" → Task 2 Step 4 스모크. ✓
- M1 "EgisLoader" → Task 5. ✓ ("SourceRegistry"는 범위 노트대로 M3로 연기 — 명시함.)
- M1 "로컬 .egis 열기 → OL 지도 표시, 벡터 이식 검증" → Task 6 스모크. ✓
- 스펙 §8.1 "좌표계 정렬(view.center)" → 4326으로 정정해 `MapView.setView`가 `fromLonLat` 적용. ✓ (다른 displayCRS로 저장된 `.egis` 검증은 실제 파일 확보 시 — Task 6 Step 3 (5)에서 실제 파일로 확인.)

**2. 플레이스홀더 스캔:** "TODO/적절히 처리/에러 핸들링 추가" 등 없음. 모든 코드 단계에 실제 코드 포함. ✓

**3. 타입/이름 일관성:** `loadEgisIntoMap`(EgisLoader) · `parseEgisDoc`(egisParse) · `buildVectorLayer`/`createVectorStyle`/`readVectorFeatures`/`hexToRgba`(egisLayers) · `MapView.addLayer/setView/fitToLayers`(MapView) · preload `window.egisFS.importEgis/openFolder` ↔ main `egis:import`/`project:openFolder` 채널 일치. ✓

**미해결(구현 중 실측 — 스펙 §8과 일치):**
- OL 모듈이 Vitest(jsdom)에서 import·구성만으로 문제없이 동작하는지 → Task 3에서 처음 실행 시 확인. 만약 import 단계에서 DOM 관련 에러가 나면 해당 테스트 파일 상단에 필요한 최소 스텁을 두기보다, 문제 모듈을 순수부에서 분리(이미 분리됨)해 회피. 현재 설계상 `egisLayers`는 렌더 없이 구성만 하므로 통과가 기대됨.
- `npm run dev` 시 vite-plugin-electron이 `electron/main.js`를 CJS로 번들해 실행하는지 → Task 2 스모크에서 확인. `package.json`에 `"type":"module"`을 넣지 않은 것이 핵심(SHcore와 동일 조건).
