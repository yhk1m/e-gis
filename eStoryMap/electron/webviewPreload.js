// © 2026 김용현
// eStoryMap/electron/webviewPreload.js
// e-GIS 웹앱 탭(<webview>)에 주입되는 저장 브릿지.
// 웹뷰 안에서는 blob URL 다운로드(<a download>)가 조용히 실패하는 Electron 제약이 있어,
// e-gis.kr 웹앱이 window.egisDesktop.saveTextFile로 네이티브 저장 대화상자를 쓰게 한다.
// (웹앱은 브릿지가 없으면 기존 브라우저 다운로드로 폴백 — 웹/데스크톱 공용 코드)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('egisDesktop', {
  /** 텍스트 파일 저장(.egis/.json/.csv 등). 저장한 경로 또는 null(취소/실패). */
  saveTextFile: (filename, text) => ipcRenderer.invoke('webview:saveTextFile', filename, text),
});
