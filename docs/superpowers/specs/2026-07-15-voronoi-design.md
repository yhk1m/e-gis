# 보로노이 다이어그램 (티센 폴리곤) 설계

작성일: 2026-07-15

## 목표

벡터 분석에 **보로노이 다이어그램** 생성 기능을 추가한다.
포인트 레이어를 받아 각 점의 최근린 영역을 폴리곤으로 만든다.

수업에서의 용도는 두 가지이며, 둘 다 지원한다.

1. **세력권·최근린 분석** — 학교·병원·편의점 등 시설 포인트에서 "어느 시설이 가장 가까운가"
   영역을 나눠 상권/배후지를 파악한다. 결과 폴리곤 자체가 답이다.
2. **티센 폴리곤 보간** — 기상관측소 강수량 같은 포인트 속성을 면으로 확장해
   단계구분도로 이어간다. 각 셀이 원본 포인트의 속성을 물려받아야 한다.

## 범위

- **포함**: 보로노이 셀 생성, 사각형 경계 클립, 폴리곤 레이어 경계 클립,
  원본 속성 상속, 셀 면적(`area_km2`) 필드
- **제외**:
  - 들로네 삼각망 시각화 (용도에 없음)
  - 가중 보로노이 (수업 범위 밖)
  - 선택 피처만 대상으로 하기 (버퍼 등 기존 도구가 모두 레이어 전체 대상)
  - 단계구분도 자동 실행 (기존 `ChoroplethTool`이 결과 레이어에 그대로 적용됨)
  - `BufferPanel`의 동작하지 않는 투명도 슬라이더 수정 (별건)

## 기존 코드 맥락

- 도구 패턴 4겹: `src/tools/XxxTool.js`(로직 싱글턴) + `src/ui/panels/XxxPanel.js`(모달 싱글턴)
  + `AppLayout.js`의 `data-action` 드롭다운 항목 + `main.js` 액션 switch.
- 레이어 필터: `layerManager.getAllLayers()`를 `layer.geometryType`으로 거른다
  (`HeatmapTool.getPointLayers()`, `SpatialOperationsTool.getPolygonLayers()` 패턴).
- 레이어 생성: `layerManager.addLayer({ name, features, color })`.
- **`@turf/voronoi` 7.3.1이 이미 설치돼 있다.** 새 의존성 없음.

### `turf.voronoi` 동작 (`@turf/voronoi/dist/esm/index.js` 확인 결과)

- **속성을 이미 복사한다** (`cloneProperties`). 속성 상속에 추가 작업이 필요 없다.
- **순수 평면 계산이다.** 내부적으로 `d3-voronoi`에 좌표를 그대로 넘기며
  경위도 범위를 검증하지 않는다. 따라서 EPSG:3857 미터 좌표를 그대로 먹여도 안전하다.
- **중복 좌표에서 셀을 조용히 빠뜨린다.** (아래 정정 참조)
- `bbox`는 `d3-voronoi`의 `extent()`로 전달되어 클립 사각형 역할을 한다.

### 정정: 중복 좌표에서 크래시하지 않는다 (2026-07-15, 실측)

이 문서 초안은 "`d3-voronoi`가 `null` 셀을 돌려주고 turf가 `coords.slice()` 해서
`TypeError`가 난다"고 적었다. **틀렸다.** 설치된 `@turf/voronoi@7.3.1`로 실측한 결과:

```
[중복 1쌍: [0,0] 두 번]  입력 4개 → features.length 4, forEach 순회 3회,
                          hasOwnProperty: false,true,true,true → filter(Boolean) 후 3개
[전부 동일: [0,0] 3개]    입력 3개 → forEach 순회 1회, filter(Boolean) 후 1개
```

예외는 나지 않는다(exit 0). `d3-voronoi`의 `polygons()`가 겹친 인덱스에 **구멍(hole)이
있는 sparse array**를 돌려주고, `Array.prototype.map`이 구멍을 건너뛰므로
`coordsToPolygon(null)`은 애초에 호출되지 않는다. turf 소스만 읽고 sparse array의
map 동작을 놓친 데서 나온 오독이다.

**`dedupeSeeds`의 근거는 바뀌지만 결론은 그대로다.** 크래시 방지가 아니라 **정직한 보고**다.
걸러내지 않으면 중복된 점들이 조용히 셀 없이 사라지고, 사용자는 포인트보다 셀이 적은
이유를 알 수 없다. 걸러내야 "중복 좌표 N개 제외"라고 말해 줄 수 있다.
`filter(Boolean)`은 sparse가 새어 나올 경우를 막는 방어용으로 남긴다.

## 좌표계 결정 (기존 관례에서 의도적으로 벗어남)

`2026-06-05-feature-edit-merge-split-design.md`는 "OL은 EPSG:3857, turf는 EPSG:4326"을
프로젝트 관례로 기록하고 있다. **보로노이는 이 관례를 따르지 않고 EPSG:3857에서 계산한다.**

근거:

- `turf.buffer`/`turf.union` 등은 측지 연산이라 4326을 요구하지만,
  `turf.voronoi`는 평면 연산이라 좌표계를 우리가 고를 수 있다.
- 4326(경위도)에서 계산하면 위도 37°에서 경도 1°≈88.8km, 위도 1°≈111km라
  **약 25%의 이방성 왜곡**이 생겨 셀이 눈에 띄게 찌그러진다.
- 3857(메르카토르)은 등각도법이라 국지적으로 왜곡이 등방적이다.
  결과적으로 **화면에서 수직이등분선이 실제로 수직이등분선으로 보인다.**
  교육용으로는 "보이는 대로가 맞는" 일관성이 측지학적 정밀도보다 가치가 크다.
- 피처가 이미 3857로 저장돼 있어 변환 자체가 불필요하다.
  `coordinateSystem.mapCRS`는 `'EPSG:3857'` 고정이며, EPSG 변경 메뉴는 좌표 *표시*에만
  영향을 준다 (`CoordinateSystem.js:46`).
- 3857로 세계 데이터까지 한 코드로 덮는다. 지역별 투영(EPSG:5179 등) 자동 선택은
  좌표계 판별 로직·다중 원점·세계 데이터 예외가 붙는 데다,
  계산 공간과 화면이 달라져 화면상 이등분선처럼 보이지 않는 역효과가 난다.

**한계**: 메르카토르 축척계수가 위도에 따라 변하므로 남북으로 아주 넓은 범위에서는
측지 보로노이와 어긋난다. 우리나라 규모(33°~38.6°N)에서 100km 떨어진 두 점의
경계선 오차는 1km 미만으로 수업에서 무시할 수준이다. 전 지구 규모 데이터에서는
고위도 오차가 커진다.

**면적만은 예외로 측지 계산한다.** `turf.area`는 4326을 가정하므로 쓰지 않고,
`ol/sphere`의 `getArea(geom, { projection: 'EPSG:3857' })`를 쓴다
(`MeasureTool.js:251`이 쓰는 방식). 3857 지오메트리를 받아 측지 면적을 돌려준다.

## 아키텍처

| 파일 | 성격 | 내용 |
|------|------|------|
| `src/tools/VoronoiTool.js` | 신규 | 순수 로직. 싱글턴 `voronoiTool` export. 지도·DOM 모름 |
| `src/ui/panels/VoronoiPanel.js` | 신규 | 모달 UI. 싱글턴 `voronoiPanel` export |
| `src/tools/VoronoiTool.test.js` | 신규 | 순수 헬퍼 단위 테스트 |
| `src/ui/layout/AppLayout.js` | 수정 | 벡터 분석 드롭다운에 항목 1줄 추가 |
| `src/main.js` | 수정 | import + `case 'analysis-voronoi'` |
| `src/styles/main.css` | 수정 | 모달 스타일 (기존 `.modal-overlay`/`.modal-content` 재사용) |
| `package.json` | 수정 | `vitest` devDependency + `"test": "vitest run"` 스크립트 |

메뉴 위치는 **버퍼 분석 바로 아래, 공간 연산 위**. 둘 다 "레이어 하나를 받아 새 도형을
만드는" 성격이고, 등시선·최단경로는 divider 아래 네트워크 계열로 이미 묶여 있다.

라벨: **"보로노이 다이어그램 (티센 폴리곤)"**.
두 용도가 교과서에서 다른 이름으로 불리지만 같은 도구임을 한 줄로 알린다.

`SpatialOperationsTool.clip()`은 **재사용하지 않는다.** 레이어 두 개를 받아 새 레이어를
만드는 API라 셀 단위 클립에 맞지 않는다. `VoronoiTool` 안에서 `turf.intersect`를 직접 부른다.

결과는 평범한 폴리곤 레이어이므로 `.egis` 저장/복원, 단계구분도, 속성 테이블,
SHP 내보내기에 추가 작업 없이 얹힌다.

## `VoronoiTool` 인터페이스

```js
voronoiTool.createVoronoi(layerId, {
  boundaryLayerId,  // null이면 사각형 모드
  color
})
// → { layerId, layerName, cellCount,
//     skipped: { duplicates, nonPoint, outsideBoundary } }
```

`writeFeatureObject(feature)`를 옵션 없이 호출하면 3857 원좌표가 그대로 나온다.
`readFeatures(geojson)`도 옵션 없이 호출해 3857로 되돌린다. 좌표 변환은 전 과정에 없다.

### 파이프라인

1. **시드 추출** — `geometryType`이 `Point`/`MultiPoint`인 레이어만 대상.
   MultiPoint는 각 점을 개별 시드로 펼치되 부모 피처의 속성을 공유한다.
   **포인트가 아닌 피처는 세어서 보고한다** (`skipped.nonPoint`).
   `LayerManager.detectGeometryType`은 `features[0]`만 보고 레이어 타입을 정하고
   (`LayerManager.js:106-115`), `GeoJSONLoader`는 FeatureCollection을 피처별 타입 검사
   없이 통째로 싣는다. 따라서 포인트에 라인이 섞인 파일도 포인트 레이어로 잡히며,
   조용히 버리면 셀 개수가 포인트 수보다 적은 이유를 사용자가 알 수 없다.
2. **중복 제거** — 3857 좌표를 1mm(0.001m) 단위로 반올림한 키로 중복을 걸러 첫 점만 남긴다.
   크래시 방지가 아니라 **보고**를 위한 단계다(위 정정 참조). 걸러낸 개수를 사용자에게 알린다.
   1mm 격자는 거리 허용오차가 아니라 격자 반올림이다. 경계를 걸친 좌표는 더 가까워도
   갈라진다. 보장하는 건 "정확히 겹친 좌표는 반드시 합쳐진다" 하나뿐이며, 그거면 충분하다.
3. **최소 개수 검증** — 서로 다른 시드가 2개 미만이면 에러.
   2개는 허용한다 (수직이등분선 하나만 나오는 게 원리 설명에 유용).
4. **bbox 산정** (3857 미터)
   - 기준 extent: 사각형 모드는 시드 extent, 경계 레이어 모드는 (시드 extent ∪ 경계 extent).
     경계 밖 시드도 경계 안쪽으로 셀을 밀어넣으므로 **합집합이어야 한다.**
   - 여유: 기준 extent 폭의 10%를 좌·우에 **각각** 더하고,
     높이의 10%를 상·하에 **각각** 더한다 (결과적으로 폭·높이가 1.2배).
   - 축퇴 방어: 폭 또는 높이가 0이면(시드가 한 점이거나 일직선)
     해당 축의 여유를 양쪽 각각 절대값 1,000m로 대체한다.
5. **보로노이 생성** — `turf.voronoi(featureCollection, { bbox })`.
   반환된 `null` 셀을 방어적으로 필터한다.
6. **경계 클립** (경계 레이어 선택 시) — 경계 피처들을 `turf.union`으로 하나로 합친 뒤
   셀마다 `turf.intersect`. `null`인 셀은 경계 밖이므로 버리고 개수를 보고한다.
   섬에 걸쳐 MultiPolygon이 나오면 그대로 둔다.
7. **면적 필드** — **클립 후** 최종 셀을 OL 지오메트리로 읽어
   `getArea(geom, { projection: 'EPSG:3857' })` → km², 소수 3자리.
   필드명은 `area_km2`. 한글 필드명은 SHP(DBF) 내보내기에서 인코딩이 깨질 수 있어 피한다.
   원본에 `area_km2`가 이미 있으면 `area_km2_1`, `area_km2_2` 순으로 접미사를 붙여
   **조용히 덮어쓰지 않는다.**
8. **레이어 생성** — `layerManager.addLayer({ name: '{원본명}_보로노이', features, color })`.

성능: `d3-voronoi`는 O(n log n), 클립은 셀당 intersect 1회.
수천 개 포인트까지 체감 지연이 없다.

### 테스트 대상 순수 헬퍼

`layerManager` 의존성 없이 `VoronoiTool.js` 안에 두고 export한다.

- `dedupeSeeds(seeds)` → `{ seeds: Seed[], duplicates: number }`
  (`duplicates`는 제거된 **개수**)
- `computeBBox(seedExtent, boundaryExtent | null)` → `[minX, minY, maxX, maxY]`
- `resolveFieldName(baseName, existingKeys)` → `string`

## UI (`VoronoiPanel`)

메뉴에서 바로 열린다. 버퍼처럼 사전 레이어 선택을 요구하지 않고, 패널 안에서
포인트 레이어를 고르는 **히트맵 방식**을 쓴다. 보로노이는 포인트 레이어에만 쓸 수 있어
사용자가 폴리곤을 선택해 둔 채 메뉴를 누르면 버퍼 방식은 거절만 하고 끝나기 때문이다.
현재 선택된 레이어가 포인트면 기본값으로 미리 고른다.

| 컨트롤 | 내용 |
|--------|------|
| 포인트 레이어 | `getPointLayers()` 결과를 `이름 (피처 수)`로 표시 |
| 경계 (클립) 레이어 | 첫 항목이 `사각형 (경계 없음)` = 기본값, 그 뒤로 폴리곤 레이어 목록 |
| 색상 | 컬러 피커, 기본 `#3388ff` |

경계 처리를 라디오 + 별도 셀렉트로 나누지 않고 **셀렉트 하나로 합친다.**
"사각형"이 사실상 목록의 0번 선택지이며, 폴리곤 레이어가 없으면 자연스럽게 사각형만 남는다.

**투명도 슬라이더는 넣지 않는다.** `addLayer`는 `opacity`를 받지 않으므로
(`LayerManager.js:86-94`) 넣어도 `BufferPanel`처럼 아무 일도 하지 않는 죽은 컨트롤이 된다.
`style` 옵션으로 우회하면 `layerInfo.fillOpacity`가 `0.3`으로 하드코딩돼 있어
(`LayerManager.js:174`) LayerPanel 스타일 편집기가 읽는 값과 실제 스타일이 어긋난다.
투명도는 LayerPanel의 스타일 편집이 이미 담당하는 영역이다.

**빈 상태** — 포인트 레이어가 없으면 패널을 열지 않고
"보로노이 다이어그램을 만들려면 포인트 레이어가 필요합니다."로 알린다.

**결과 보고** — 레이어명과 셀 개수를 알리고, 걸러낸 게 있을 때만 덧붙인다
(예: `중복 좌표 2개 제외`, `포인트가 아닌 피처 1개 제외`, `경계 밖 셀 5개 제외`).
조용히 사라지면 데이터가 틀렸다고 오해하기 쉬운 대목이라 반드시 노출한다.
`skipped`의 세 항목 모두 0이 아닐 때 노출한다.

## 에러 처리

`VoronoiTool`은 한국어 메시지를 담은 `Error`를 던지고 `VoronoiPanel`이 받아 `alert`로 띄운다.
도구가 DOM을 모르는 기존 원칙을 유지한다.

| 상황 | 처리 |
|------|------|
| 중복 제거 후 서로 다른 점 2개 미만 | `"보로노이를 만들려면 서로 다른 위치의 점이 2개 이상 필요합니다 (현재 N개)."` |
| 시드가 한 점/일직선이라 extent 폭·높이 0 | 에러 아님. 여유값을 절대값 1,000m로 대체해 진행 |
| `turf.voronoi` 예외 | catch 후 원인 메시지와 함께 실패 보고 |
| `null` 셀 | 중복 제거로 이미 막았지만 방어적으로 한 겹 더 필터 |
| 클립 결과가 전부 비어 있음 | `"경계 레이어와 겹치는 셀이 없습니다. 포인트와 경계가 같은 지역인지 확인해 주세요."` |
| 경계 `turf.union` 실패 | **명시적 에러.** 아래 참조 |

**경계 union 실패는 조용히 넘어가지 않는다.**
`BufferTool.js:75`는 dissolve 실패 시 `console.warn`만 찍고 개별 버퍼로 폴백한다.
보로노이에서 같은 짓을 하면 사용자가 경계를 지정했는데 사각형 결과가 나오고
그걸 맞다고 믿게 된다. 잘못된 지도를 조용히 내놓느니 실패를 알린다:

> `"경계 레이어의 도형을 합치는 데 실패했습니다. 다른 경계 레이어를 쓰거나 사각형 모드로 시도해 주세요."`

경계 피처를 셀마다 개별 intersect하는 방식(union 없이)도 가능하지만,
시군구 250개 × 셀 500개면 intersect 호출이 12만 번이라 bbox 사전 필터 같은 최적화가 딸려온다.
전역 union 한 번이 훨씬 단순하고 `polyclip-ts`는 시도·시군구 GeoJSON 정도는 무리 없이 처리한다.
실패가 잦아지면 그때 개별 intersect로 갈아탄다.

## 검증

### 자동 (vitest)

`src/` 본체에는 테스트 파일이 하나도 없고 `package.json`에 test 스크립트도 러너 의존성도 없다.
**이번에 vitest를 새로 도입한다.** Vite 프로젝트라 설정이 최소이며,
`layerManager` 의존성 없는 순수 헬퍼만 대상으로 한다.

- `dedupeSeeds` — 정확히 겹친 좌표, 1mm 미만 차이, 중복 없음, 전부 중복
- `computeBBox` — 일반 케이스 10% 여유, 경계 extent와의 합집합,
  폭 0(수직 일직선), 높이 0(수평 일직선), 한 점
- `resolveFieldName` — 충돌 없음, 1회 충돌, 연속 충돌

### 수동 (`npm run dev`)

1. **사각형 모드** — 좌표 데이터로 포인트 레이어 생성 후 셀 생성 →
   속성 테이블에 원본 필드 + `area_km2` 확인
2. **면적 교차 검증** — 셀 하나를 면적 측정 도구로 재서 `area_km2`와 일치하는지
   (좌표계 결정이 맞았는지 확인하는 핵심 검사)
3. **경계 클립** — 내장 시도 경계로 클립 → 셀이 경계 안에만 있고 해안선을 따르는지
4. **티센 → 단계구분도** — 결과 레이어로 단계구분도가 바로 동작하는지 (용도 2의 성공 기준)
5. **중복 좌표** — 같은 좌표를 두 번 넣은 데이터에서 크래시 없이 "중복 1개 제외" 보고
6. **점 2개** — 이등분선 하나가 나오는지
7. **경계 밖 포인트** — "경계 밖 셀 N개 제외" 보고
8. **`area_km2` 충돌** — 원본에 같은 이름 필드가 있을 때 접미사가 붙는지
9. **왕복** — `.egis` 저장 → 열기, SHP 내보내기에서 `area_km2` 유지
