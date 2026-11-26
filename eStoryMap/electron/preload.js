// © 2026 김용현
// eStoryMap/electron/preload.js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('egisFS', {
  importEgis: () => ipcRenderer.invoke('egis:import'),          // → {filename, text} | null
  importTif: () => ipcRenderer.invoke('tif:import'),            // → {filename, data:ArrayBuffer} | null
  listProjects: () => ipcRenderer.invoke('project:list'),       // → string[]
  loadProject: (name) => ipcRenderer.invoke('project:read', name),
  saveProject: (name, json) => ipcRenderer.invoke('project:save', name, json),
  backupProject: (name) => ipcRenderer.invoke('project:backup', name), // → 백업 파일명 | null
  renameProject: (from, to) => ipcRenderer.invoke('project:rename', from, to),    // → 새 파일 이름
  duplicateProject: (name) => ipcRenderer.invoke('project:duplicate', name),     // → 사본 이름
  deleteProject: (name) => ipcRenderer.invoke('project:delete', name),           // → .backups로 옮긴 파일 이름
  projectMtime: (name) => ipcRenderer.invoke('project:mtime', name),             // → 마지막 수정 시각(ms) | null
  openFolder: () => ipcRenderer.invoke('project:openFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url), // 외부 브라우저(http(s)만, M7 가입 안내)
  savePDF: (title) => ipcRenderer.invoke('report:savePDF', title),    // 보고서 PDF 저장 → 경로 | null (M10)
});

// 창 닫기 전 저장: 메인이 before-close를 보내면, 저장을 마치고 closeOk(닫기) 또는 cancelClose(그대로 두기)
contextBridge.exposeInMainWorld('egisApp', {
  onBeforeClose: (cb) => ipcRenderer.on('app:before-close', () => cb()),
  closeOk: () => ipcRenderer.send('app:close-ok'),
  cancelClose: () => ipcRenderer.send('app:close-cancel'),
});

contextBridge.exposeInMainWorld('egisUpdate', {
  // 켤 때 메인 프로세스가 새 버전을 찾으면 콜백. info={version,name,notes,url}
  onAvailable: (cb) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
});
