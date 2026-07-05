# M9 확장 — 발표 레이아웃 3종 + 카메라 고정/동기화 설계 (2026-07-05)

> **상태: 사용자 승인 완료.** M9 기본(발표 셸)에 흡수 → 통합 스모크 후 함께 push. 경량 프로세스: 순수 로직만 TDD, 레이아웃 CSS·팝오버·버튼은 수동 스모크.

## A. 발표 텍스트 레이아웃 3종 (프로젝트 전체)

- **모델**: `doc.meta.presentationLayout` ∈ `'band'`|`'panel'`|`'card'`. 없으면 `'band'`(기본).
  - `band` — 우측 세로 밴드, 안쪽(좌) 경계가 지도로 그라데이션 페이드.
  - `panel` — 우측 단단한 사이드패널, 좌 경계 하드 라인.
  - `card` — 좌하단 플로팅 카드 + 가장자리 그라데이션(기존 M9 카드의 개선판).
- **선택 UI**: 헤더 `<select id="layout-select">`(▶ 발표 옆). 변경 → `setPresentationLayout` + `scheduleSave`. `enterEditor`에서 현재값 반영.
- **렌더**: PresentationShell이 `enter`에서 무대에 `pres-stage pres-layout-{x}` 클래스 부여. 세 룩은 **CSS로만** 구현(`.pres-layout-band .pres-overlay` 등). 오버레이 콘텐츠·`buildOverlay`·JS 네비 로직 불변.
- 사이드 좌/우 토글, 페이지별 오버라이드 = v2.

## B. 카메라 위치 도구 (편집기)

지도 하단 버튼군(`#map-stage`, 기존 `📷 이 위치로 캡처` 옆)에 2개 추가:

- **`📌 모든 슬라이드에 이 위치`** (`#btn-cam-all`): 현재 지도 뷰(`mapView.getCamera()`)를 전 페이지 `camera`에 1회 복사 → `refresh` + `scheduleSave` + status.
- **`🔗 위치 가져오기`** (`#btn-cam-sync`): 클릭 시 **다른 슬라이드 팝오버**(현재 페이지 제외, 제목 목록) → 선택 시 그 페이지 `camera`를 현재 페이지로 복사 + `animator.flyTo` + `scheduleSave`. 팝오버는 바깥 클릭/재클릭으로 닫힘. 다른 페이지가 1개도 없으면 버튼 비활성.

## C. 순수 로직 (StoryDoc.js — TDD 대상)

```
setPresentationLayout(doc, layout)   // layout이 허용 enum일 때만 meta.presentationLayout 반영 + touch, 그 외 무시
applyCameraToAllPages(doc, camera)   // camera 있으면 전 페이지 camera = 깊은복사({center:[...], zoom}), touch. null이면 no-op
syncCameraFromPage(doc, targetId, sourceId)  // source.camera를 target.camera로 깊은복사 + touch. 페이지 누락/소스 camera 없음 = no-op
```

- `camera` 포맷은 기존과 동일 `{center:[경도,위도](EPSG:4326), zoom}`. 깊은복사로 외부 변이 격리(setPageCamera 전례).
- `presentationLayout` 읽기 기본값은 호출부에서 `doc.meta.presentationLayout || 'band'`.

## D. 배선 (main.js)

- `layout-select` change → `setPresentationLayout` + save. `enterEditor`에서 `select.value = doc.meta.presentationLayout || 'band'`.
- `btn-cam-all` click → `applyCameraToAllPages(doc, mapView.getCamera())` + refresh + save + status.
- `btn-cam-sync` click → 팝오버 렌더(다른 페이지들) → pick → `syncCameraFromPage(doc, currentPageId, pickedId)` + `animator.flyTo(getPage(...).camera)` + refresh + save.
- PresentationShell `enter`가 `getDoc().meta.presentationLayout || 'band'`로 무대 클래스 설정.

## E. 테스트 / 스모크

- **Vitest**: `StoryDoc.test.js`에 setPresentationLayout(유효/무효 enum), applyCameraToAllPages(전 페이지 복사·null no-op·격리), syncCameraFromPage(복사·누락 no-op·격리) 추가.
- **수동 스모크**(M9 통합): 레이아웃 3종 전환 확인, 📌 전체 적용 후 발표에서 비행 없음 확인, 🔗 팝오버로 다른 슬라이드 위치 가져오기 확인 + 기존 M9 §6 스모크 재확인.

## F. 커밋 순서

1. 순수 로직 3함수 + 레이아웃 모델(StoryDoc) + 테스트
2. 발표 셸 레이아웃 렌더 + 3종 CSS + 헤더 셀렉트
3. 카메라 버튼/팝오버 배선 + CSS

## G. v2 백로그

레이아웃 좌/우 사이드 선택, 페이지별 레이아웃 오버라이드, 지속 '고정 모드' 토글, 카메라 라이브 연동(현재는 1회성 복사).
