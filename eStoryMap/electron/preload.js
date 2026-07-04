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
  openFolder: () => ipcRenderer.invoke('project:openFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url), // 외부 브라우저(https만, M7 가입 안내)
});
