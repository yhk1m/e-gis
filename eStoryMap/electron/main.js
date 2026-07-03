// © 2026 김용현
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
    title: 'e-GIStory',
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 미리보기의 마크다운 링크 클릭 등으로 창이 다른 URL로 항해하면
  // 문서가 통째로 날아간다(M6 전엔 저장 없음). 창 내 항해는 차단하고
  // 외부 http(s) 링크는 기본 브라우저로 연다. dev 서버 리로드는 허용.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl && url.startsWith(devUrl)) return; // Vite 전체 리로드 허용
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    // dev 의존성 재최적화 리로드로 초기 로드가 중단(ERR_ABORTED)돼도
    // 메인 프로세스가 죽지 않게 방어 — webContents가 스스로 재로드한다.
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch((e) => {
      console.warn('[main] 초기 로드 중단(자동 재시도됨):', e.message);
    });
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

// 생 GeoTIFF 열기 (경로② — renderer가 geotiff.js로 파싱)
ipcMain.handle('tif:import', async () => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'GeoTIFF 파일 열기',
    filters: [{ name: 'GeoTIFF', extensions: ['tif', 'tiff', 'geotiff', 'img'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const buf = await fsp.readFile(r.filePaths[0]);
  return {
    filename: path.basename(r.filePaths[0]),
    // Node Buffer는 풀 ArrayBuffer의 뷰일 수 있어 정확한 구간만 잘라 전달
    data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
});

// 로컬 .esm 저장/목록 (M6에서 본격 사용 — 여기선 골격만 배선)
ipcMain.handle('project:list', () => listProjects());
ipcMain.handle('project:read', (_e, name) => readProject(name));
ipcMain.handle('project:save', (_e, name, json) => writeProject(name, json));
ipcMain.handle('project:openFolder', () => shell.openPath(baseDir()));
