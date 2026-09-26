# 휴대폰 셸 개편 설계 — 서랍 메뉴·레이어 버튼·글래스

작성 2026-09-26. 실험실(Labs) 5단계가 끝난 `main`(시계열까지 배포) 위에서 시작한다.

## 배경

사용자 요청 세 가지.

1. 휴대폰에서도 글래스모피즘이 적용돼야 한다. 지금은 `glass.css` 가 `(pointer: coarse) and (max-width: 1366px)` 에서 블러를 끄고 78% 반투명만 남기며, 지도를 창 전체에 까는 부유 배치도 데스크톱(`min-width: 1025px and pointer: fine`)에만 적용된다. 그래서 휴대폰에서는 "그냥 음영"으로 보인다 — 데스크톱에서 이미 한 번 지적받은 그 상태다.
2. 휴대폰에서 툴바가 너무 많다. 390px 폭에서 메뉴바가 두 줄(96px), 툴바가 네 줄(181px)을 차지해 지도가 화면의 60% 남짓이다. 햄버거 버튼으로 모아 달라.
3. 휴대폰에서 레이어 목록 창이 안 보인다. 왼쪽 패널은 휴대폰에서 아래에서 올라오는 시트(bottom sheet)로 바뀌고 처음엔 접혀 있는데, 손잡이가 지도 하단 가운데 88×26px 화살표뿐이라 레이어를 넣어도 목록이 어디 있는지 알 수 없다. 햄버거에 넣어도 좋지만 더 좋은 방법이 있으면 그걸로.

## 결정

### 범위: 휴대폰 = `(max-width: 768px)`

`layout.css` 의 bottom sheet 분기와 같은 기준을 쓴다. 태블릿(769~1366px, coarse)은 셸 구조를 바꾸지 않고 글래스만 손본다(블러 복원 + 부유 배치).

### 1. 헤더 한 줄 + 왼쪽 서랍(drawer)

휴대폰의 메뉴바는 한 줄로 줄인다.

```
[≡ 메뉴] [e-GIS 마크]            [검색] [레이어 (n)] [테마] [Login]
```

- `≡` (`#mobile-menu-btn`, 선 SVG 햄버거)를 누르면 왼쪽에서 서랍(`#mobile-drawer`)이 열린다. 폭 `min(86vw, 360px)`, 세로 전체, 스크림(어두운 반투명 배경)을 누르거나 닫기 버튼·Esc 로 닫는다.
- 서랍 안 순서: 「도구」 제목 → `#toolbar` 통째로 → 「메뉴」 제목 → `#menubar .menu-center` 통째로. **DOM 노드를 실제로 옮긴다**(`MobileShell.js`). 이유: `main.js` 의 툴바 클릭 위임은 `#toolbar` 요소에 걸려 있어 요소째 옮기면 그대로 동작한다. 메뉴바 클릭 위임은 `#menubar` 에 걸려 있으므로 `document` 로 옮긴다(바깥 클릭 닫기 핸들러는 이미 `document`).
- 미디어 쿼리가 풀리면(가로 회전·창 넓힘) 원래 자리로 되돌린다. 원래 자리는 옮길 때 남긴 placeholder 주석 노드로 기억한다.
- 서랍 안 툴바: 그룹 구분선 대신 4열 격자. 각 버튼은 아이콘 위, 라벨 아래. 라벨은 새 `data-label` 속성(짧은 한글: 확대·축소·전체 범위·선택·속성 보기·선택 취소·선택 삭제·합치기·자르기·점·선·면·멀티포인트·멀티라인·멀티폴리곤·거리·면적·측정 지우기·이미지)을 `::after { content: attr(data-label) }` 로 그린다. 글자 라벨이 이미 있는 버튼(3D·실험실·지구본·스와이프)은 그대로. `hidden`·`display:none` 버튼은 격자에서도 숨긴다.
- 서랍 안 메뉴: 아코디언. `.menu-item` 세로 나열, `.menu-button` 은 한글 라벨(`.menu-btn-label`)만 44px 높이 한 줄, 열리면 `.dropdown-menu` 가 그 아래에 인라인(`position: static`)으로 펼쳐진다. 이모지 아이콘(`.menu-btn-icon`)은 휴대폰에서 더 이상 보이지 않는다. Geocoding·데이터 불러오기·About 은 같은 모양의 한 줄 항목.
- 도구 버튼(`[data-tool]`)이나 실행 항목(`.dropdown-item[data-action]`, 링크)을 누르면 서랍이 닫혀 지도가 바로 보인다. 메뉴 제목(아코디언 토글)은 닫지 않는다.
- 검색: `#toolbar-search` 를 헤더 아래 검색 줄(`#mobile-search-row`)로 옮기고 `#mobile-search-btn` 으로 펼친다/접는다. 펼치면 입력창에 포커스.
- `.toolbar-collapse-btn`(도구 모음 접기)은 휴대폰에서 의미가 없으므로 숨긴다.

### 2. 레이어 버튼 + 시트 자동 열기 (햄버거보다 나은 방법)

레이어 목록을 서랍에 넣으면 메뉴 두 단계 아래로 숨는다. 대신:

- 헤더에 상시 노출 `#mobile-layers-btn`(선 SVG 레이어 아이콘 + 레이어 수 배지). 누르면 bottom sheet 를 열고 닫는다 — `#sidebar-toggle` 과 같은 경로(`AppLayout.toggleSidebar()` 로 뽑아낸다). 열려 있으면 버튼이 `.active`.
- 배지는 `Events.LAYER_ADDED / LAYER_REMOVED / PROJECT_LOADED / PROJECT_NEW` 에서 `layerManager.getAllLayers().length` 로 갱신. 0 이면 배지 숨김.
- 자동 열기: 휴대폰이고 시트가 접혀 있는데 레이어 수가 0 → 1 이상이 되면 시트를 한 번 연다(프로젝트 새로 만들기 때 리셋). 이후 추가는 배지만 바뀐다.
- 기존 손잡이(`.sidebar-toggle`)는 유지한다.

### 3. 글래스 — 휴대폰·태블릿에도 진짜 유리

- 블러 끄던 coarse 분기를 없앤다. 대신 휴대폰은 블러 14px(GPU 절약)로 조금 낮춘다.
- 부유 배치(지도 `#app` 전체 + 카드 막대)를 모든 폭에 적용한다. 데스크톱 블록의 미디어 조건을 떼고 `[data-surface="glass"]` 무조건 규칙으로 올린 뒤, 휴대폰 전용 덮어쓰기 블록 `(max-width: 768px)` 를 둔다:
  - `#left-panel`(시트)은 `#app` 기준 절대 배치, `bottom: var(--glass-bottom-offset)`, 좌우 `--glass-gap`, 위 모서리만 둥글게 유지.
  - 손잡이 `.sidebar-toggle` 은 가운데 아래 그대로(`left: 50%; top: auto`), 접힘 `bottom: var(--glass-bottom-offset)`, 열림 `bottom: calc(55% + var(--glass-bottom-offset))`.
  - `--glass-panel-offset` 은 휴대폰에서 0 이어야 한다(시트는 왼쪽 열이 아니다). `glass.js` `trackLayoutOffsets` 에 `panelFloating` 판정(`matchMedia('(max-width: 768px)')`)을 넣어 0 으로 만든다. 오프셋 변수는 `#map-container` 와 `#app` 양쪽에 쓴다(시트가 `#app` 자식이라 변수를 읽어야 한다).
  - `.time-series-controls` 의 `left: calc(50% + panel/2)` 는 panel=0 이라 자연히 가운데.
- 서랍 시트(`.mobile-drawer-sheet`)와 검색 줄도 글래스 목록(블러·테두리·글자 halo)에 넣는다.
- 태블릿: `min-width: 769px` 이상은 데스크톱과 같은 부유 배치를 그대로 받는다(사이드 패널 구조가 같다).

### 안 하는 것

- 769~1100px 구간의 이모지 메뉴 아이콘 교체(별건).
- 시트 높이 드래그 조절, 서랍 스와이프 제스처.
- 통계 지도 범례·피처 카드 등 지도 위 요소의 휴대폰 재배치(오프셋 변수만 맞춘다).

## 파일

- 새 `src/ui/layout/MobileShell.js` (+ `.test.js`, jsdom): 미디어 감시·노드 이동/복귀·서랍·검색 줄·레이어 버튼/배지/자동 열기.
- 새 `src/styles/mobile.css`: 휴대폰 헤더·서랍·격자 툴바·아코디언·검색 줄·배지. `main.css` 의 `@import` 에 `layout.css` 다음으로 추가. `layout.css` 의 휴대폰 메뉴바 줄바꿈·이모지·툴바 줄바꿈 규칙은 삭제.
- `src/ui/layout/AppLayout.js`: 헤더 버튼·검색 줄·서랍 골격 마크업, `data-label`, `toggleSidebar()/setSidebarHidden()`.
- `src/main.js`: 메뉴바 위임을 `document` 로, `initMobileShell({ layout, layerManager })` 호출.
- `src/labs/glass.js`, `src/styles/glass.css`: 위 3.
- `scripts/verify/mobile-shell.cjs`: CDP 기기 에뮬레이션(390×844, touch, DPR 2) 캡처.
- `docs/사용설명서.md`: 휴대폰 문단 한 개.

## 검증 기준

- 390×844, touch 에서: 헤더 한 줄(≤ 56px), 툴바가 화면에 없음, `≡` → 서랍에 도구 격자 19+개와 메뉴 11개, 도구 누르면 서랍 닫힘, 레이어 버튼 → 시트, 레이어 추가 시 시트 자동 열림과 배지 1.
- `?lab=glass` 에서 헤더·상태줄·시트·서랍이 지도 위에 블러로 뜨고(`backdrop-filter` 계산값 blur 포함), 지도 컨트롤이 헤더에 가리지 않음(`.ol-zoom` top ≥ 헤더 아래).
- 1280×800 데스크톱 회귀: 서랍 없음, 툴바·메뉴 원위치, 기존 `labs-shell.cjs` 캡처와 동일.
- `npm test` 전부 통과.
