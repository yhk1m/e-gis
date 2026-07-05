# 범례(Legend) 설계 (2026-07-05) — M9 확장

> **상태: 사용자 승인 완료.** 자동(레이어명+색, DEM=램프)+수동 편집, 드래그 자유 배치, 편집기+발표 둘 다, DEM v1=램프, 기본 표시. 경량 프로세스: 순수 로직 TDD, DOM/드래그/CSS는 스모크.

## 1. 모델 (`doc.meta.legend`, 프로젝트 전체)

```js
{ visible: true,               // 헤더 '범례' 토글, 기본 표시
  pos: { x: 0.02, y: 0.04 },   // 정규화 좌표(0~1, 박스 좌상단 기준) — 편집기·발표 4:3 무대 공통
  overrides: { "src_1:L_a": { label: "인구밀도", hidden: false } } }  // 레이어 key별 라벨/숨김
```
- 없으면 `DEFAULT_LEGEND`(visible:true, pos {0.02,0.04}, overrides {}). 구버전 .esm 호환.
- key = `` `${sourceId}:${layerId}` ``.

## 2. 순수 로직

**`src/core/legend.js`** (TDD):
- `DEFAULT_LEGEND` 상수.
- `clampLegendPos(x, y)` → {x,y} 각 [0,1] 클램프.
- `buildLegendItems(doc, page)` → 항목 배열. 현재 페이지 `layerVisibility`에서 **visible=true**만, 소스 egis(`parseEgisDoc(source.egis).layers`)에서 레이어 메타 조회:
  - `{ key, label: override.label ?? layer.name, kind: layer.type==='raster' ? 'ramp' : 'swatch', color: layer.color }`
  - override.hidden이면 제외. 소스/레이어 조회 실패는 스킵(방어). 순서 = layerVisibility 순서.
  - `ramp` 항목은 DOM이 `DEM_COLOR_RAMP`(rasterColor.js)로 그라데이션 바 생성. (analysis별 램프는 v2)

**`src/core/StoryDoc.js`** 변이(TDD, setCloudSync/setPresentationLayout 전례):
- `setLegendVisible(doc, on)` · `setLegendPos(doc, x, y)`(clampLegendPos 사용) · `setLegendOverride(doc, key, patch)`(label/hidden 병합). 셋 다 meta.legend 없으면 DEFAULT로 초기화 후 반영 + touch.

## 3. DOM (`src/editor/Legend.js`, 스모크)

`createLegend(container, { getDoc, onChange })` → `{ render(page, { editable }) }`
- `container` = `#legend`(#map 자식). render: `visible` false면 숨김; `buildLegendItems`로 행 생성(swatch=색칸, ramp=DEM 그라데이션 바) + 라벨; `pos`로 좌상단 위치(%).
- **editable=true(편집기)**: 박스 드래그 → 정규화 pos 계산 → `onChange({pos})`; 라벨 클릭 인라인 rename → `onChange({override:{key,label}})`; 각 행 👁 → `onChange({override:{key,hidden}})`.
- **editable=false(발표)**: 정적 표시, 컨트롤·드래그 없음.

## 4. 표시 위치 — 지도에 동행

- `#legend`를 **`#map`의 자식**으로 둠(position:absolute). 발표 진입 시 `#map` 노드가 4:3 무대로 재부모될 때 **자동 동행** → 편집기·발표 양쪽에서 지도 위 표시(별도 이동 배선 없음). z-index로 OL 캔버스 위, pointer-events는 박스만.

## 5. 배선

- **index.html**: `#map` 안에 `<div id="legend">`, 헤더에 `범례` 체크박스(`#legend-toggle`).
- **main.js**: `legend = createLegend(#legend, { getDoc:()=>doc, onChange })`. onChange → setLegendPos/setLegendOverride + scheduleSave + (override는 refresh로 재렌더). refresh()에서 `legend.render(page, {editable:true})`. `#legend-toggle` change → setLegendVisible + save + render. enterEditor에서 토글값·range 반영.
- **PresentationShell**: deps에 `legend` 추가. `enter`/`renderPage`에서 `legend.render(shownPage, {editable:false})`. `exit` 후 편집기 refresh가 editable로 원복.

## 6. 테스트 / 스모크

- **Vitest**: legend.js(buildLegendItems: visible 필터·override 라벨/숨김·순서·raster→ramp·조회실패 스킵 / clampLegendPos 경계), StoryDoc(setLegendVisible/Pos/Override: 초기화·클램프·병합·touch).
- **스모크**: 범례 자동 표시(레이어명+색), DEM 램프 바, 드래그 이동(발표에서 동일 위치), 라벨 수정·개별 숨김, 헤더 토글 on/off, 발표 진입 시 지도 위 표시·슬라이드별 항목 갱신, 편집기 원복.

## 7. v2 백로그

페이지별 범례 위치/표시, DEM 고도 최소/최대 숫자 라벨, analysis 스킴별 램프, 범례 항목 순서 수동 정렬, 폰트/배경 스타일.
