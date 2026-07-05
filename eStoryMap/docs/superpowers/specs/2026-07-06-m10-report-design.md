# M10 보고서 셸 (Report) 설계 — 2026-07-06

> **상태: 사용자 승인 완료.** A4 세로 보고서 + Electron printToPDF. 지도는 페이지별 캡처 이미지, 범례는 지도 아래 HTML 행. 경량 프로세스: 순수 로직 TDD, 캡처·DOM·PDF는 스모크.

## 0. 개요

모든 StoryDoc 페이지를 A4 섹션으로 스크롤 표시. 섹션 = `heading → 지도 이미지 → 범례 행 → body(마크다운) → caption`. 발표 셸과 **같은 pages 데이터, 레이아웃만 다름**(마스터 §5).

## 1. 순수 로직 (TDD)

**`src/viewer/reportModel.js`** — `buildReportSections(doc, imagesByPageId)`:
- `doc.pages.map(page => ({ id, heading: content.heading, image: imagesByPageId[id] || null, legend, bodyHtml: renderMarkdown(content.body), caption: content.caption }))`.
- `legend` = `(doc.meta.legend?.visible ?? true)` 이면 `buildLegendItems(doc, page).filter(i=>!i.hidden)`, 아니면 `[]`.
- renderMarkdown(shared)·buildLegendItems(core) 재사용. Vitest 대상.

## 2. 지도 캡처 (스모크)

**`src/viewer/mapCapture.js`** — `captureMapImage(map): Promise<dataURL>`:
- OL 공식 export 패턴: `map.once('rendercomplete', …)` → `.ol-layer canvas` 순회, opacity·transform(matrix) 적용해 오프스크린 canvas에 합성 → `toDataURL('image/png')`. 등록 후 `map.renderSync()`로 렌더 유도 + 안전 타임아웃(rendercomplete 미발화 대비).
- **⚠️ `MapView`의 OSM 소스에 `crossOrigin:'anonymous'`** 추가 — 없으면 베이스 타일이 canvas를 오염시켜 toDataURL이 throw. (OSM은 CORS 지원.)

## 3. 보고서 셸 (스모크)

**`src/viewer/ReportShell.js`** — `createReportShell(container, { mapView, registry, getDoc, onExit, onSavePDF })` → `{ open(), close() }`:
- `open()`: "생성 중 n/N" 로딩 표시 → **페이지별 순차**: `applyPageVisibility(page, registry)` + `mapView.setView(page.camera)` → `captureMapImage` → 이미지 수집. (지도는 오버레이 뒤에서 렌더/캡처.) → `buildReportSections`로 DOM 조립 → 표시. camera 없는 페이지는 현재 뷰로 캡처.
- DOM: `.report-page`(A4) × N, 각 heading/figure(img)/legend(swatch·ramp 행)/body(살균 HTML)/caption. 상단 툴바(화면 전용): `📄 PDF 저장` · `닫기`.
- `close()` → onExit(main이 refresh + 현재 페이지 카메라 원복).
- `📄 PDF 저장` → `onSavePDF(doc.meta.title)`.

## 4. PDF (Electron)

- **preload** `egisFS.savePDF(title)` → **main `report:savePDF`**: `mainWindow.webContents.printToPDF({ pageSize:'A4', printBackground:true, margins:{top:0,bottom:0,left:0,right:0} })` → `dialog.showSaveDialog`(기본 `baseDir()/{title}.pdf`) → `fsp.writeFile` → 저장 경로 반환(취소=null).
- **`@media print`**: `#app,#start-screen,#presentation` 및 `.report-toolbar` 숨김, `#report`만. `@page{size:A4;margin:0}` + `.report-page{break-after:page}` → 페이지당 A4 1장.

## 5. 배선

- **index.html**: `#report` 컨테이너(빈 오버레이) + 헤더 `📄 보고서` 버튼(`#btn-report`, ▶ 발표 옆).
- **main.js**: `report = createReportShell(#report, { mapView, registry, getDoc, onExit: exitReport, onSavePDF })`. `#btn-report` → `report.open()` + `#app` inert. `exitReport` → inert 해제 + refresh + 카메라 원복(exitPresentation 전례). `onSavePDF` → `window.egisFS.savePDF(title)` + status 알림.
- **MapView**: OSM `crossOrigin:'anonymous'`.

## 6. 테스트 / 스모크

- **Vitest**: `reportModel.test.js` — buildReportSections(heading/bodyHtml 마크다운/caption/image 매핑, legend visible 시 항목·off 시 빈배열·hidden 제외).
- **스모크**: 📄 보고서 → 지도 이미지가 실제로 캡처돼 나오는지(OSM 오염), 페이지별 카메라·레이어 반영, 범례 행 표시, 스크롤/A4 레이아웃, 📄 PDF 저장→다이얼로그→파일 생성·열어보기, 닫기 후 편집기 원복, 기존 발표/범례 회귀.

## 7. v2 백로그

긴 body 다중 A4 페이지 분할, 표지/목차, 지도 해상도 배율(고DPI), 범례 이미지 baked 옵션, 보고서 스타일 테마, 페이지 머리말/꼬리말.
