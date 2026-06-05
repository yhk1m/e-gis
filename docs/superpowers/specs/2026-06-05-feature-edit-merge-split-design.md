# 피처 편집: 합치기 / 자르기 설계

작성일: 2026-06-05

## 목표

QGIS의 편집 세션 기능 중 **피처 합치기(Merge)**와 **피처 자르기(Split)**를 e-GIS에 추가한다.
한 레이어 안에서 선택한 피처들을 대상으로 동작하며, 기존의 "레이어 vs 레이어"
공간 연산(`SpatialOperationsTool`)과는 별개다.

## 범위

- **포함**: 피처 합치기, 피처 자르기 (폴리곤 + 라인)
- **제외**: 정점 편집(기존 SelectTool Modify로 제공), 전역 Undo, 구멍 내기, 회전/이동 등

## 기존 코드 맥락

- 좌표계: OL은 `EPSG:3857`, turf는 `EPSG:4326`.
  `GeoJSON.writeFeatureObject(f, {dataProjection:'EPSG:4326', featureProjection:'EPSG:3857'})`
  / `readFeatures(..., 동일 옵션)` 으로 변환 (SpatialOperationsTool 패턴 재사용).
- 피처 → 소속 레이어 찾기: `layerInfo.source.hasFeature(feature)` (SelectTool 패턴).
- 선택 피처: `selectTool.getSelectedFeatures()` → OL Feature[].
- 레이어 조작: `layerManager.getAllLayers/getLayer/addLayer/removeLayer`.
- 편집 메뉴(`#menu-edit`)가 이미 존재: 선택 피처 삭제 / 모두 선택 / 선택 해제.
- 도구 활성화: 툴바 `data-tool` → `toolManager.toggleTool(tool)`,
  메뉴 `data-action` → main.js 액션 switch.

## 아키텍처

### 새 모듈 `src/tools/FeatureEditTool.js`

선택과 레이어 조작은 기존 매니저에 위임하고, 지오메트리 연산만 담당한다.

#### `mergeSelected()`
1. 검증: 선택 피처 ≥ 2개, **모두 같은 레이어**, 호환 타입(폴리곤끼리 또는 라인끼리).
   - 불충족 시 안내 alert 후 중단.
2. 지오메트리:
   - 폴리곤: `turf.union`으로 순차 융합 → Polygon/MultiPolygon.
   - 라인: 모든 라인을 MultiLineString으로 결합.
3. 속성: **수치 필드 = 합계, 그 외 = 첫 피처 값.**
4. 원본 피처 제거 → 합쳐진 OL 피처 1개를 같은 레이어에 추가 → 결과를 재선택.

#### 자르기 모드 `startSplit()` / `stopSplit()`
1. `startSplit()`: 전용 오버레이 소스에 OL `Draw`(LineString) 인터랙션 추가.
   다른 도구는 ToolManager가 배타적으로 비활성화.
2. drawend(자를 선 완성):
   - 자를 선과 교차하는 **한 레이어**의 피처들을 대상으로 함
     (선택 피처가 있으면 그 안에서, 없으면 교차 피처 자동 탐색).
   - 폴리곤: turf 노딩 + `turf.polygonize`로 **틈 없는 정확 분할**.
     실패 시 buffer+difference 폴백.
   - 라인: `turf.lineSplit`.
   - 각 조각은 **원본 속성을 복제**.
3. 원본 제거 → 조각 피처들을 같은 레이어에 추가.
4. `stopSplit()`: 인터랙션·오버레이 정리.

### 순수 함수 분리 (테스트 대상)

OL/DOM에 의존하지 않는 GeoJSON in → GeoJSON out 함수로 핵심 로직을 분리한다.

- `mergeGeoJSON(features)` → 합쳐진 GeoJSON Feature
- `mergeAttributes(featuresProps)` → 합쳐진 속성 객체 (수치 합계 / 그 외 첫값)
- `splitPolygonByLine(polygon, line)` → GeoJSON Feature[]
- `splitLineByLine(line, cutter)` → GeoJSON Feature[]

이 함수들은 turf만 사용하므로 Node 환경에서 단위 테스트 가능.

### UI 통합

- 편집 메뉴(`#menu-edit`): `피처 합치기`(data-action `edit-merge`),
  `피처 자르기`(data-action `edit-split`, 토글) 추가.
- 툴바 select 그룹: 가위 아이콘 자르기 버튼(모드, `data-tool="edit-split"`).
- `main.js`: `edit-merge` → `featureEditTool.mergeSelected()`,
  `edit-split` → 토글; `ToolManager`에 split 모드 등록.
- 상태 메시지/검증 alert는 기존 톤 유지.

## 데이터 흐름

```
선택 피처(OL, 3857)
  → GeoJSON(4326)로 변환
  → turf 연산(merge/split)
  → GeoJSON(4326) 결과
  → OL Feature(3857)로 역변환
  → 같은 레이어 소스에 반영(원본 remove, 결과 add)
```

## 에러 처리

- 합치기: 피처 < 2 / 다른 레이어 / 타입 불일치 / 포인트 → 안내 alert, 변경 없음.
- 자르기: 자를 선이 아무 피처와도 교차하지 않음 / 폴리곤 분할 결과 1개 → 안내, 변경 없음.
- turf 연산 예외는 try/catch로 잡아 사용자 메시지로 변환.

## 테스트 전략

- 순수 함수(`mergeGeoJSON`, `mergeAttributes`, `splitPolygonByLine`, `splitLineByLine`)
  단위 테스트: 정상 분할 개수, 속성 합산, 비교차 케이스.
- 인터랙션/UI/투영 왕복은 dev 서버에서 수동 확인.

## 미해결/추후

- 전역 Undo는 별도 과제. 현재는 메모리 편집 + 재선택으로 즉시 되돌리기(삭제) 가능.
- 폴리곤 분할은 정확 노딩을 우선하되, 실제 데이터로 검증해 폴백 임계값을 조정한다.
