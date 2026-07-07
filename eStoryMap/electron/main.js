// © 2026 김용현
// eStoryMap/electron/main.js
import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import fsp from 'node:fs/promises';
import https from 'node:https';
import {
  ensureBaseDir, baseDir, listProjects, readProject, writeProject, backupProject,
} from './fileService.js';
import { isNewerVersion } from '../src/shared/version.js';

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const UPDATE_REPO = 'yhk1m/e-gis'; // 업데이트 확인 대상 GitHub 저장소(릴리스)
let mainWindow = null;

// 켤 때 1회: GitHub 최신 릴리스와 현재 버전 비교 → 새 버전이면 렌더러에 알림 전송.
// CSP는 렌더러에만 적용되므로 확인은 메인 프로세스(Node https)에서. 네트워크 실패는 조용히 무시.
function checkForUpdate(win) {
  const req = https.get({
    hostname: 'api.github.com',
    path: `/repos/${UPDATE_REPO}/releases/latest`,
    headers: { 'User-Agent': 'e-GIS-app', Accept: 'application/vnd.github+json' },
    timeout: 8000,
  }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return; } // 릴리스 없음(404) 등 → 무시
    let data = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { data += c; });
    res.on('end', () => {
      try {
        const rel = JSON.parse(data);
        const latest = rel.tag_name || rel.name;
        if (latest && isNewerVersion(latest, app.getVersion()) && win && !win.isDestroyed()) {
          // 릴리스에 첨부된 설치 파일(.exe)이 있으면 그 직접 다운로드 URL도 전달
          const exe = Array.isArray(rel.assets) ? rel.assets.find((a) => /\.exe$/i.test(a.name || '')) : null;
          win.webContents.send('update-available', {
            version: String(latest).replace(/^v/i, ''),
            name: rel.name || String(latest),
            notes: rel.body || '',
            url: rel.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`,
            downloadUrl: exe ? exe.browser_download_url : null,
          });
        }
      } catch { /* 파싱 실패 무시 */ }
    });
  });
  req.on('error', () => {}); // 오프라인 등 무시
  req.on('timeout', () => req.destroy());
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'e-GIS',
    icon: isDev ? path.join(__dirname, '../build/icon.ico') : undefined, // dev 창 아이콘=e-GIS(prod는 exe 아이콘)
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // e-GIS 웹앱을 앱 내 탭(<webview>)으로 임베드하기 위함(우리 사이트만 로드)
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

  // 켤 때 한 번 업데이트 확인(렌더러 로드 완료 후 → 리스너가 준비된 뒤 알림)
  mainWindow.webContents.once('did-finish-load', () => checkForUpdate(mainWindow));

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
  Menu.setApplicationMenu(null); // 기본 메뉴바(File/Edit/View/…) 제거. 복사/붙여넣기 등은 Chromium이 기본 처리
  ensureBaseDir();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// e-GIS 웹앱(<webview>) 안에서 새 창(target=_blank, 예: 커뮤니티 카페 링크) 요청은
// 임베드 창을 만들지 않고 기본 브라우저로 연다(webview는 allowpopups 필요).
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  }
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
ipcMain.handle('project:backup', (_e, name) => backupProject(name));

// 보고서 → PDF (M10): 현재 렌더러 DOM(@media print로 #report만)을 A4 PDF로. 저장 다이얼로그 후 기록.
ipcMain.handle('report:savePDF', async (_e, title) => {
  if (!mainWindow) return null;
  let data;
  try {
    data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true, // 크기·여백은 CSS @page(#pdf-page-rule)가 결정: 보고서=A4 15mm / 발표=16:9 0
    });
  } catch (err) {
    console.warn('[main] printToPDF 실패:', err);
    return null;
  }
  const safe = String(title || '보고서').replace(/[\\/:*?"<>|]/g, '_').trim() || '보고서';
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'PDF로 저장',
    defaultPath: path.join(baseDir(), `${safe}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  await fsp.writeFile(r.filePath, data);
  return r.filePath;
});

// 외부 링크(M7 가입 안내 등)는 기본 브라우저로 — http(s)만 화이트리스트
ipcMain.handle('app:openExternal', (_e, url) => {
  // openExternal은 브라우저 실행 실패 시 reject할 수 있다 — invoke로 전파되면
  // 렌더러의 미대기 click 핸들러에서 unhandled rejection이 되므로 여기서 흡수.
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url).catch(() => null);
  return null;
});
