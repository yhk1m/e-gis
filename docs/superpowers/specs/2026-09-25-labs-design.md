# e-GIS 실험실(Labs) 설계

2026-09-25
상태: 설계 확정(사용자 검토 대기) · 구현은 Opus 5.5가 단계별 계획서를 따라 진행

## 목적

검증되지 않은 기능을 정식 메뉴에 섞지 않고 **실험실**에서 먼저 켜 보게 한다. 교사·학생이 써 보고
반응이 좋은 것만 정식 기능으로 승격한다. 승격은 코드 이동이 아니라 **가드 한 줄과 목록 한 줄을
지우는 일**이어야 한다. 그래서 실험 기능은 처음부터 자기 자리(범례·툴바·메뉴)에 들어가고,
실험실은 켜고 끄는 스위치만 쥔다.

## 범위와 단계

| 단계 | 실험 id | 이름 | 크기 | 의존 |
|---|---|---|---|---|
| 0 | (껍데기) + `glass` | 실험실 버튼·패널·상태 저장 + 글래스 UI | 작음 | 없음 |
| 1 | `class-fill` | 구간 채움 편집기 (구간별 색·패턴·이미지·질감) | 중간 | 0 |
| 2 | `globe` | 지구본·투영법 보기 (d3-geo) | 큼 | 0, 1(패턴 재사용) |
| 3 | `swipe` | 스와이프 비교 | 작음 | 0 |
| 4 | `time-series` | 시계열 단계구분도 슬라이더 | 중간 | 0, 1(색 규약) |

사용자가 낸 항목 2·3·4(색 커스텀·이미지 패턴·질감)는 하나의 기능(`class-fill`)이다.
셋 다 "구간 하나의 채움을 무엇으로 할지"의 선택지일 뿐이라 따로 만들면 저장·범례·내보내기가
세 벌로 갈라진다.

단계마다 브랜치·계획서·검증을 따로 둔다. 0단계가 먼저 끝나야 나머지를 켤 스위치가 생긴다.

## 확정된 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 실험실 진입 | 메뉴바 `btn-community` 모양 버튼 **실험실** (Geocoding 왼쪽, 선 SVG 플라스크) → 모달 | 사용자가 "버튼"을 요구. 기존 Geocoding·About 과 같은 자리·모양 |
| 상태 저장 | `localStorage['eGIS_labs']` = `{ id: true }`. 모르는 id 는 무시 | 기존 `eGIS_settings`·`egis-theme` 과 같은 방식. 서버 없음 |
| 세션 켜기 | URL `?lab=globe,glass` / `?lab=all` / `?lab=none` 은 그 세션만 덮어쓴다 | 시연·테스터 링크. 저장값은 건드리지 않는다 |
| 실험 기능의 자리 | 각 기능은 정식 자리에 들어가고 `labs.isOn(id)` 로만 가려진다 | 승격 = 가드 삭제. 실험실 안에 별도 화면을 만들지 않는다 |
| 승격 절차 | 레지스트리 항목 삭제 + `isOn` 가드 삭제 + 설명서 이동 | 저장값에 남은 id 는 무시되므로 마이그레이션 없음 |
| 사용량 집계 | 하지 않는다. 카드마다 **의견 보내기** 링크만 | 조회수 시트(VisitorTracker)에 동작을 더 넣으면 Apps Script 쪽도 고쳐야 한다. 반응은 링크로 받는다 |
| 지구본 렌더러 | **d3-geo 캔버스**, 배경은 내장 「세계 국가」 GeoJSON | 사용자 결정(2026-09-25). 확대해도 선명하고 투영법 전환이 거의 공짜. three.js 텍스처판은 세계 규모에서만 쓸 만하다 |
| 구간 채움 진입 | **범례의 색 칸 클릭** → 팝오버 | 만든 뒤 고치는 길이 지금은 없다. 만들 때 패널을 키우는 것보다 범례가 모든 분류 레이어(격자 포함)에 공통 |
| 카토그램 | `class-fill` 1차 범위 밖 | 범례가 그라디언트 바라 구간 칸이 없고 설정도 별개(`_cartogramConfig`). 반응 보고 별건 |
| 글래스 범위 | CSS 속성 `data-surface="glass"` 하나. 라이트·다크와 직교 | 배경색이 거의 전부 CSS 변수라 JS 변경 없음. 내보내기 중엔 불투명으로 |
| 개인정보 방침 | 변경 없음 | 새로 수집하는 정보가 없다(localStorage 뿐) |

## 0단계 — 실험실 껍데기

### 모듈

```
src/labs/labs.js        상태: init({search, storage}) · isOn(id) · set(id,on) · toggle(id) · onChange(cb) · enabledIds() · shareUrl()
src/labs/registry.js    EXPERIMENTS = [{ id, name, summary, since }] · FEEDBACK_URL
src/labs/labs.test.js   순수 로직(저장·URL 덮어쓰기·모르는 id)
src/ui/panels/LabPanel.js   모달(GeocodingPanel 과 같은 `.modal-overlay` 규약)
```

- `labs.js` 는 DOM·OpenLayers 를 모른다. `storage` 와 `search` 를 주입받아 노드에서 테스트한다.
- 우선순위: URL 덮어쓰기 > 저장값 > 꺼짐. 패널에서 토글하면 저장값을 쓰고 그 id 의 덮어쓰기는 지운다.
- `onChange(cb)` 는 `(id, on)` 을 넘긴다. 각 기능은 여기에 붙어 **즉시** 반응한다(새로고침 불필요).
- `shareUrl()` 은 현재 켜진 id 로 `?lab=…` 을 붙인 주소를 돌려준다.

### 레지스트리

```js
export const EXPERIMENTS = [
  { id: 'glass',       name: '글래스 UI',            summary: '패널·메뉴·범례를 반투명 유리로 보여줍니다.', since: '2026-09' },
  { id: 'class-fill',  name: '구간 채움 편집',        summary: '범례의 색 칸을 눌러 구간마다 색·패턴·이미지·질감을 바꿉니다.', since: '2026-09' },
  { id: 'globe',       name: '지구본·투영법 보기',     summary: '지금 지도를 지구본으로 돌려 보고 투영법을 바꿔 봅니다.', since: '2026-09' },
  { id: 'swipe',       name: '스와이프 비교',         summary: '레이어나 배경지도 둘을 가운데 막대를 끌어 비교합니다.', since: '2026-09' },
  { id: 'time-series', name: '시계열 단계구분도',      summary: '연도별 열을 슬라이더로 넘기며 변화를 봅니다.', since: '2026-09' },
];
export const FEEDBACK_URL = '';   // 구글 폼 주소. 비어 있으면 링크를 숨긴다
```

위 목록은 4단계까지 끝난 뒤의 모습이다. 항목은 **그 단계가 구현될 때** 추가한다. 구현 안 된 실험이 목록에 보이면 안 된다.

### 메뉴바·패널

- `AppLayout.js` 메뉴바: Geocoding 왼쪽에 `<div class="menu-item" data-menu="labs"><button class="btn-community" data-action="labs" title="실험실 — 검증 중인 기능">…실험실</button></div>`.
- `main.js` `handleMenuAction` `case 'labs': labPanel.show()`.
- 패널: 제목 **실험실**, 안내 한 줄("검증 중인 기능입니다. 켠 상태는 이 브라우저에 저장됩니다."),
  실험 카드(이름 · 한 줄 설명 · 스위치 `role="switch"` · 의견 보내기 ↗). 아래에 "켜진 상태로 여는 링크" + 복사 버튼.
  닫기: ×, 바깥 클릭, Esc. 이모지 없음, 아이콘은 선 SVG.
- `__egisDebug` 에 `labs` 를 노출한다(하네스에서 켜고 끄기 위해).

## 0단계 — 글래스 UI (`glass`)

- `labs.onChange`: `glass` 가 켜지면 `document.documentElement.setAttribute('data-surface','glass')`, 꺼지면 제거. 초기화 때도 한 번 적용.
- 새 파일 `src/styles/glass.css`, `main.css` 끝에서 `@import`. 모든 규칙은 `[data-surface="glass"]` 아래.
- 토큰 덮어쓰기: `--bg-panel`·`--bg-menubar`·`--bg-toolbar`·`--bg-statusbar`·`--map-overlay-bg` 를 반투명 rgba 로
  (라이트 0.62, 다크 0.55), 새 토큰 `--glass-blur: 14px`, `--glass-border: rgba(255,255,255,.45)`(다크 .12), `--glass-highlight`(위쪽 안쪽 하이라이트 1px).
- `backdrop-filter: blur(var(--glass-blur)) saturate(140%)` 대상: `#menubar`, `#toolbar`, `#left-panel`, `#statusbar`, `.modal`,
  지도 위 부유 요소(`.choropleth-legend`, `.cartogram-legend`, 히트맵·흐름도 범례, `.view3d-controls`, 피처 정보 카드, 배경지도 팝오버 — 정확한 선택자는 계획서에서 grep 으로 확정).
  지도 위 부유 요소는 블러 반경을 절반(7px)으로 — 지도가 다시 그려질 때마다 블러가 재계산된다.
- 성능 예외: `@media (pointer: coarse) and (max-width: 1366px)` 에서는 블러 없이 반투명만. `prefers-reduced-transparency` 도 같다.
- 내보내기 예외: `body.exporting [data-surface="glass"] .choropleth-legend …` 은 블러 없이 불투명 배경. html2canvas 는 backdrop-filter 를 못 그린다.
- 글자 색 토큰은 손대지 않는다. 검증: OSM 과 Esri 어두운 지도 위에서 범례·패널 글자 대비 4.5:1 이상(하네스 캡처로 육안 확인).

## 1단계 — 구간 채움 편집기 (`class-fill`)

### 채움 사양 (`_choroplethConfig.fills[i]`)

`colors[i]` 는 그대로 구간의 **기준색**이다(범례 대체·테두리 어둡게·지구본이 쓴다). `fills[i]` 가 없거나 `kind:'solid'` 면 지금과 같다.

```js
{ kind: 'solid' }
{ kind: 'hatch', angle: 45, spacing: 8, width: 2, color: '#333333', background: 'class' | 'none' | '#rrggbb' }
{ kind: 'dots',  spacing: 8, radius: 1.6, color, background }
{ kind: 'cross', spacing: 8, width: 1.5, color, background }
{ kind: 'image', dataUrl, scale: 1, opacity: 1 }          // 타일 반복. 업로드 때 긴 변 256px 로 재인코딩(PNG)
{ kind: 'texture', name: 'paper'|'gloss'|'sand'|'forest'|'water', strength: 0.5 }   // 기준색으로 틴트
```

- `background:'class'`(기본)는 기준색을 레이어 투명도로 깔고 그 위에 패턴을 얹는다 — 서열(색 순서)이 남는다. `'none'` 은 배경지도가 비친다.
- 질감은 이미지 파일을 싣지 않고 **캔버스에서 절차적으로** 만든다(고정 시드 → 지도·범례·내보내기가 같은 무늬). 종이=미세 알갱이, 광택=사선 하이라이트 띠, 모래=크기 둘인 점, 숲=작은 수목 기호 산포, 물=물결선. 틴트는 기준색을 `multiply` 로 `strength` 만큼.

### 모듈

```
src/tools/classFill.js         순수: planFill(spec, baseColor, fillOpacity, {pixelScale}) → { size, background, ops[] }
                                     presetFills(name, n) → fills[]   (예: 'bw-hatch' 는 구간이 높을수록 간격이 좁아진다)
                                     normalizeFill(spec) → 빠진 값 채움·범위 제한
src/tools/classFillCanvas.js   캔버스: renderFillCanvas(plan, seed) → canvas · fillFor(spec, baseColor, fillOpacity, pixelScale) → 'rgba(…)' | CanvasPattern (JSON 키로 메모)
src/ui/panels/ClassFillPopover.js  팝오버 UI
```

`planFill` 은 그리기 명령 목록만 만든다(캔버스 없이 테스트). `renderFillCanvas` 가 그 목록을 그린다 — `mapTexture.planComposition` 과 같은 분리.

### 진입과 편집

- `ChoroplethTool.renderLegendItems` 의 색 칸에 `data-class="i"` 를 붙인다. `labs.onChange` 로 `#map` 에 `labs-class-fill` 클래스를 켜고 끄며, CSS `#map.labs-class-fill .choropleth-legend-color { cursor: pointer }` + 호버 테두리. 클릭 → `classFillPopover.open({ layerId, classIndex, anchor })`. 클릭 처리기는 클릭 시점에 `labs.isOn('class-fill')` 을 본다(켜고 끄면 바로 반영, 범례를 다시 만들 필요 없음).
- 팝오버(지도 컨테이너 안, 색 칸 옆): 채움 종류 4분할(단색·패턴·이미지·질감) →
  - 단색: `<input type="color">` → `colors[i]` 변경.
  - 패턴: 종류(사선·점·격자), 색, 간격 4~24, 굵기, 각도(사선), 배경(구간 색·없음·직접).
  - 이미지: 파일 선택(PNG·JPG·SVG) → 256px 재인코딩 → `dataUrl`, 배율 0.25~4, 불투명도.
  - 질감: 프리셋 5개 미리보기 타일, 강도 슬라이더.
  - 아래: **모든 구간에 프리셋** 드롭다운(`bw-hatch` 흑백 인쇄용 사선 밀도 단계 · `dots-density` 점 밀도 단계 · `texture-uniform` 질감 통일) + 적용, **팔레트로 되돌리기**(`fills` 삭제).
- 변경은 즉시 지도·범례에 반영된다. 닫기: 바깥 클릭·Esc. 되돌리기(HistoryManager)는 범위 밖.
- 적용 경로: `choroplethTool.setClassFill(layerId, i, spec)` / `setClassColor(layerId, i, hex)` → 설정 갱신 → `layerManager.updateLayerStyle(layerId)` → 범례 칸 다시 그림 → `LAYER_STYLE_CHANGED`(자동 저장이 듣는다).

### 렌더링 경로 (겸사 개선)

지금 단계구분도 스타일 함수가 `ChoroplethTool.apply` 와 `LayerManager.updateLayerStyle` 두 곳에 복사돼 있다.
`apply()` 는 설정만 심고 `updateLayerStyle` 을 부르도록 바꿔 **스타일 빌더를 한 곳**으로 만든다.
그 한 곳에서 `fill: new Fill({ color: cfg.tool.classFillColor(cfg, colorIdx, fillOpacity) })` 처럼 채움을 받는다.
`classFillColor` 는 `fillFor(cfg.fills?.[i], cfg.colors[i], fillOpacity)` 를 부르는 얇은 메서드다 — 채움이 없으면 지금처럼 `rgba` 문자열이 나온다.
OpenLayers `Fill.color` 는 `CanvasPattern` 을 그대로 받는다. 히트 판정은 패턴과 무관하다.

알려진 동작: 캔버스 패턴은 화면에 고정된다. 지도를 끌면 패턴이 지형과 같이 움직이다가 놓는 순간 다시 정렬된다(QGIS 의 화면 단위 패턴과 같다). 설명서에 한 줄 적는다.

### 범례

- 지도 위 범례 칸: 단색이면 `background:` 색, 아니면 `renderFillCanvas(plan)` 24px 타일의 `toDataURL()` 을 배경 이미지로.
- 내보내기 범례: `legendModel.makeSymbol` 이 `fill: config.fills?.[i] ?? null` 을 실어 보내고(순수, 테스트), `ExportTool.drawLegendSymbol` 이 `fill` 이 있으면 `ctx.createPattern(renderFillCanvas(planFill(…, {pixelScale: scale})), 'repeat')` 로 칠한다.

### 저장·복원·복제

- `StateManager.saveLayer` 와 `ProjectManager` 직렬화의 `choroplethConfig` 에 `fills` 를 더한다. 복원은 이미 `{ ...layerData.choroplethConfig }` 로 펼치므로 그대로 따라온다.
- `LayerManager` 레이어 복제(572행)는 얕은 복사라 `fills` 배열을 공유한다 → `fills: cfg.fills?.map(f => ({ ...f }))` 로 깊게 복사.
- 이미지 채움은 `.egis` 와 IndexedDB 를 키운다(구간당 최대 약 200KB). 팝오버에 크기를 표시한다.
- 격자(`gridLayer`)는 같은 `_choroplethConfig` 를 쓰므로 자동으로 편집 가능. `GridPanel` 은 손대지 않는다.

### 다른 화면과의 연동

- 3D 보기와 PNG 내보내기는 OL 캔버스를 합성·캡처하므로 패턴이 자동으로 따라온다.
- 지구본(2단계)은 폴리곤을 칠할 때 같은 `fillFor` 를 써서 같은 무늬가 나온다.

## 2단계 — 지구본·투영법 보기 (`globe`)

### 무엇을 보여주는가

지금 지도의 **벡터 레이어**를 지구본(정사영)으로 돌려 보고, 드롭다운으로 투영법을 바꿔 같은 자료가 어떻게 달라 보이는지 본다.
배경은 배경지도 타일이 아니라 바다색 구 + 경위선 + 내장 「세계 국가」 육지다.

| 그린다 | 안 그린다 (패널에 "지구본에 표시되지 않음: …" 으로 센다) |
|---|---|
| 벡터(점·선·면·Multi), 단계구분도·격자(구간 채움 포함), 카토그램(`_cartogramConfig` 색), 버퍼·보로노이 등 파생 벡터 | 래스터·DEM, 히트맵, 도형표현도, 흐름도, 라벨 |

### 모듈

```
src/globe/GlobeController.js   조립부 — LayerManager·MapManager 를 아는 유일한 곳. enter/exit, 레이어→GeoJSON(4326) 변환·캐시, 육지 fetch, 레이어 이벤트 구독 → 다시 그림
src/globe/globeRenderer.js     buildDrawList(layers) 순수(순서·가시성·지원 여부·미표시 수) · paint(drawList, projection, ctx, colors) 캔버스
src/globe/projections.js       PROJECTIONS = 지구본(orthographic) · 메르카토르 · 등면적(Equal Earth) · 내추럴 어스 · 방위 등면적 · 등장방형 — make(key, w, h) → 맞춰진 d3 투영
src/globe/globeMath.js         순수: rotationFromCenter(lonLat) · rotationAfterDrag(rot, dx, dy, scale, kind) · clampScale · fitScale(w, h)
src/globe/layerStyles.js       순수: featureStyle(layerInfo, props) → { fillColor, fillSpec, fillOpacity, strokeColor, strokeWidth, lineDash, pointRadius } — 분류 레이어는 breaks 로 구간을 찾는다(getColorIndex 재구현)
src/globe/toLonLatFeatures.js  OL 피처(3857) → GeoJSON FeatureCollection(4326). ol/format/GeoJSON 은 노드에서도 돈다
src/ui/panels/GlobePanel.js    툴바 토글 + 컨트롤 박스(투영법 select · 경위선 · 배경 육지 · PNG 저장)
```

d3 는 `import { geoPath, geoOrthographic, … } from 'd3'` 로 쓰고(ESM 트리셰이킹), `src/globe/*` 전체를 3D 처럼 **동적 import** 한다. 안 켜는 사용자 비용은 0.

### 그리기 규칙

- 캔버스는 `#map-container` 를 덮는 오버레이(3D 와 같은 자리), 픽셀비 ≤ 2. 창 크기 변경에 따라간다.
- 순서: 바다(구 전체) → 경위선 10° → 육지 → 레이어(아래→위, `layerManager.getAllLayers()` 순서·가시성) → 구 윤곽.
- 색은 CSS 변수(`--globe-ocean`·`--globe-land`·`--globe-graticule`, 라이트·다크 각각)에서 그릴 때 읽는다.
- 점은 반지름 `pointRadius` 의 원, 선은 `strokeWidth`·`lineDash`, 면은 `fillFor`(패턴 포함) + 테두리.
- `requestAnimationFrame` 으로 모아 그린다. 드래그 중 한 프레임이 32ms 를 넘으면 그 드래그 동안은 육지·경위선만 그리고 놓으면 전체를 그린다.

### 조작·동기화

- 드래그: 정사영·방위 등면적은 λ·φ 회전(φ 는 ±90 제한), 원통·의사원통 투영은 λ 만. 감도는 `75 / scale` 도/px.
- 휠·핀치: 배율 [0.5×fit, 8×fit]. 더블클릭: 처음 자세로.
- 들어갈 때 2D 중심(경위도)을 정면으로 돌린다. 나갈 때 정면의 경위도를 2D 중심으로 옮긴다.
- 3D 와 배타: 지구본을 켜면 3D 를 끄고, 3D 를 켜면 지구본을 끈다(`View3DPanel.toggle` 에 가드 한 줄).
- 툴바: 3D 옆에 `#globe-toggle`(`data-tool="globe"`), 실험이 켜졌을 때만 보인다. `main.js` `case 'globe': globePanel.toggle()`.
- 육지 자료: `./data/builtin/practice/Area Data/행정경계/세계 국가.geojson`(276KB, 이미 내장) 을 처음 켤 때 한 번 받아 캐시.
- PNG 저장: 오버레이 캔버스 `toDataURL`. 지도 내보내기·3D 는 지구본을 모른다(별개 캔버스).

## 3단계 — 스와이프 비교 (`swipe`)

- 툴바 `#swipe-toggle`(`data-tool="swipe"`, 실험 켜졌을 때만) → 컨트롤 박스: **비교 대상** select(레이어 목록 + `배경지도: …` optgroup), **방향**(세로·가로), 닫기.
- 대상 레이어는 막대의 **왼쪽(위)** 에만 보이고 오른쪽(아래)은 그 밑이 드러난다. OL `prerender` 에서 `ctx.save(); clip`, `postrender` 에서 `restore`. 클립 사각형은 `ol/render.getRenderPixel` 로 잡는다(OL 공식 layer-swipe 예제와 같은 방식 — 캔버스가 뷰포트보다 크고 변형돼 있어 직접 계산하면 어긋난다).
- 배경지도 비교: `findBasemap(key).source()` 로 `TileLayer` 를 만들어 `baseLayer` 바로 위(index 1)에 끼우고 그것을 대상으로 클립. 나갈 때 제거. 라벨 오버레이는 1차 범위 밖.
- 막대: `#map` 안의 절대 위치 요소 + 손잡이. 포인터 드래그 → 비율(0~1) → `map.render()`. `body.exporting .swipe-divider { display:none }`.
- 대상 레이어가 삭제되면(`LAYER_REMOVED`) 스와이프를 조용히 끝낸다.
- 내보내기·3D 는 클립된 캔버스를 그대로 쓴다(비교 상태가 찍힌다). 저장하지 않는다(세션 도구).

```
src/tools/SwipeTool.js         attach(target, {orientation}) · setRatio · detach · 순수 부분: swipeClipCorners(size, ratio, orientation) · ratioFromPointer(event, rect, orientation)
src/ui/panels/SwipePanel.js
```

## 4단계 — 시계열 단계구분도 (`time-series`)

- 주제도 메뉴에 **시계열 단계구분도** 항목(`data-lab="time-series"`, 실험 꺼지면 숨김) → `TimeSeriesPanel`(ChoroplethPanel 과 같은 모달 규약):
  레이어(폴리곤·숫자 필드 2개 이상) · 필드 체크 목록(순서 = 속성 순서, **연도 자동 선택** 버튼: `/^(19|20)\d{2}/`) · 분류 방법 · 구간 수 · 팔레트(기존 램프 + 커스텀) · 적용.
- 적용: 모든 선택 필드 값을 합쳐 **구간을 한 번만** 계산해 고정한다(연도 사이 비교가 되려면 구간이 같아야 한다).
  `ChoroplethTool.apply` 에 `options.breaks`(미리 계산한 구간) 를 받는 확장 하나. 파생 레이어 이름 `원본_시계열_첫필드~끝필드`. `cfg.timeSeries = { fields, index: 0 }`.
- 슬라이더 컨트롤 박스(지도 아래 가운데): `range` · 현재 필드 이름 · 재생/일시정지(1.2초, 반복) · 속도(0.5×·1×·2×) · 닫기.
  단계 이동 = `cfg.attribute = fields[i]` → `updateLayerStyle` → 범례 부제(`choropleth-legend-subtitle`) 갱신 → `LAYER_STYLE_CHANGED`.
- 저장·복원: `choroplethConfig` 직렬화(`StateManager.saveLayer`·`ProjectManager`)에 `timeSeries` 를 더한다 — 1단계가 `fills` 를 더한 같은 자리. 복원 직후에는 저장된 인덱스의 정적 단계구분도로 서고, 실험이 켜져 있으면 `PROJECT_LOADED`·자동 복원 완료 시 레이어를 훑어 컨트롤을 되살린다(자동 복원은 완료 이벤트가 없으므로 계획서에서 `AutoSaveManager.restore` 끝에 이벤트 하나를 더한다).

```
src/tools/timeSeriesModel.js   순수: detectYearFields · unionValues(features, fields) · nextIndex(i, n) · subtitleFor(field)
src/tools/TimeSeriesTool.js    apply · setIndex · play/pause · attachControls(layerId) · detach
src/ui/panels/TimeSeriesPanel.js
```

## 공통

### 테스트

- 순수 모듈은 vitest(`src/**/*.test.js`). DOM 이 필요한 파일만 `// @vitest-environment jsdom`.
- 기존 규약대로 테스트 파일은 모듈 옆에 둔다. 새 순수 모듈마다 테스트가 먼저다(`labs`, `classFill`, `legendModel` 확장, `globeMath`, `layerStyles`, `toLonLatFeatures`, `buildDrawList`, `swipeClipCorners`, `timeSeriesModel`, 직렬화 왕복).
- 화면은 `.claude/skills/verify`(Electron 하네스)로 확인한다. 각 단계 계획서에 하네스 시나리오를 적는다:
  실험 켜기(`__egisDebug.labs.set`) → 기능 사용 → 캡처 → 끄기 → 원상 복구 확인.

### 설명서·방침

- `docs/사용설명서.md` 1-13 뒤에 **1-14. 실험실** 절을 추가하고(기존 1-14 팁과 단축키는 1-15 로), 실험마다 한 문단씩. 승격 때 해당 기능 절로 옮긴다. 목차도 같이 고친다.
- 개인정보 처리방침은 바꾸지 않는다.

### 오류 처리

- `labs.init` 은 localStorage 예외(사생활 모드)를 삼키고 전부 꺼진 상태로 간다.
- 이미지 채움: 파일이 이미지가 아니거나 디코딩 실패 → 상태줄 메시지, 설정 불변.
- 지구본: 육지 fetch 실패 → 육지 없이 그리고 패널에 "배경 육지를 불러오지 못했습니다". WebGL 불필요(2D 캔버스).
- 스와이프: 대상이 사라지면 종료. 배경지도 키가 카탈로그에 없으면 select 에 안 나온다.

## Opus 5.5 실행 지침

- 단계마다 `docs/superpowers/plans/2026-09-25-labs-<단계>.md` 계획서를 따른다. 브랜치는 `labs-<id>`. 0단계가 `main` 에 들어간 뒤 1~4단계는 서로 독립이라 병렬 가능하되, 2·4단계는 1단계의 `fillFor`·`fills` 규약을 쓴다.
- 파일 쓰기 훅이 © 헤더를 넣는다 — 지우지 않는다. `git add -A` 금지(서브에이전트 산출물이 딸려 들어간다).
- 커밋 작성자는 `yhk1m <83273992+yhk1m@users.noreply.github.com>` 로(Vercel 이 다른 이메일을 막는다).
- 빌드는 `rm -rf dist && npm run build`(한글 경로 우회 래퍼). 헤드리스 캡처는 `--disable-gpu`.
- 완료 기준: `npm test` 통과 · 하네스 시나리오 캡처 첨부 · 실험 끄면 정식 화면과 픽셀 차이 없음 · 설명서 문단 · `/cpd` 로 배포.

## 범위 밖

- 카토그램 구간 채움, 히트맵 그라디언트 커스텀, 지구본 위 래스터·히트맵·흐름도·라벨, 스와이프 라벨 오버레이, 시계열 자동 저장 외 되돌리기, 사용량 집계, 실험별 세부 설정 저장.
