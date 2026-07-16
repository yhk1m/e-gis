---
name: verify
description: e-GIS 웹앱 변경을 실제로 띄워 확인하는 방법 (Electron 헤드리스 하네스)
---

# e-GIS 실기 검증

브라우저 UI라 테스트·타입체크로는 "실제로 그려지는지"를 못 본다.
`vite preview` + Electron으로 진짜 앱을 띄우고 사용자처럼 몰고 간다.

## 준비

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS"
rm -rf dist && npm run build          # dist 안 지우면 조용히 실패(exit 127)
npx vite preview --port 4173 &        # 살아있는지: curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/
```

Electron은 `eStoryMap/node_modules`에 있다 — 하네스는 그 폴더에서 실행한다.

```bash
cd eStoryMap && npx electron /path/to/harness.js
```

## 하네스 뼈대

```js
const { app, BrowserWindow } = require('electron');
setTimeout(() => process.exit(2), 90000);   // 워치독 — 없으면 멈춰서 프로세스가 남는다

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  await win.loadURL('http://localhost:4173/');
  await new Promise(r => setTimeout(r, 3000));   // 앱 초기화 대기
  const js = (c) => win.webContents.executeJavaScript(c);
  // ... 몰고 가기
  app.quit();
});
```

## 내부 상태 접근

`window.__egisDebug = { projectManager, layerManager, exportPanel }` (main.js 끝).
필요한 매니저가 없으면 여기 추가한다 — 클라이언트 앱이라 보안 경계가 아니다.

## 사용자처럼 몰고 가기

메서드를 직접 부르지 말고 실제 UI를 클릭한다 — 배선이 끊긴 것도 같이 잡힌다.

```js
await js(`document.querySelector('[data-action="project-export"]').click()`);  // 메뉴
await js(`document.getElementById('opt-legend').click()`);                     // 체크박스
// input은 이벤트를 직접 쏴야 바인딩이 돈다
await js(`(() => { const el = document.getElementById('legend-size');
  el.value = 24; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
```

## 함정 (실제로 겪은 것)

- **첫 `capturePage()`가 빈 이미지(0바이트)를 준다.** 찰 때까지 다시 찍는다:
  ```js
  let png = Buffer.alloc(0);
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await new Promise(r => setTimeout(r, 1500));
    png = (await win.capturePage()).toPNG();
  }
  ```
- **`show: false`면 캡처가 멈춘다.** `show: true`로 띄운다.
- **같은 olLayer를 addLayer에 두 번 넘기면** OL이 `Duplicate item added to a
  unique collection`으로 죽는다. 래스터 흉내는 벡터로 만든 뒤 `type`만 바꾼다.
- IndexedDB/quota/cache 에러 로그는 무시해도 된다 — 하네스 환경 탓.
- 로그가 시끄러우면:
  `grep -viE "devtools|deprecat|GPU|cache_util|disk_cache|quota_database|Security Warning"`

## 몰아볼 만한 곳

- 주제도(단계구분도·도형표현도·카토그램): 설정을 layerInfo에 심고 스타일 확인
- 내보내기 패널: 메뉴 → `project-export` → 미리보기 캔버스 → `preview-expand`로 확대 캡처
- 프로젝트 저장/복원: `__egisDebug.projectManager.deserialize`로 왕복

## 사용자 버그 제보

**하드 새로고침(Ctrl+Shift+R) 확인부터.** georef "안 뜸"(07-08), 래스터 복원
"사라짐"(07-10) 모두 실제 원인이 Vercel 배포 후 브라우저 캐시였다.
