# 지도 내보내기 — 레이어 목록 기반 범례

2026-07-16

## 배경

내보내기 패널에는 제목·방위표·텍스트 박스를 지도 위에 얹는 오버레이 체계가 있다.
범례는 없다. `ExportTool.drawLegend()`와 `ExportPanel.drawPreviewLegend_unused()`가
남아 있지만 아무도 호출하지 않는 죽은 코드다(`drawOverlays`는 제목·방위표·텍스트 박스만
그린다).

패널의 "지도 위 범례 표시" 토글은 주제도 도구가 지도 DOM에 붙인 범례를 보이거나 숨길 뿐,
레이어 목록과는 무관하다.

## 목표

레이어 창의 레이어 목록으로 범례를 만들어, 제목·방위표처럼 드래그로 배치하고 내보낸다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 레이어 선택 | 패널의 체크박스 목록. 기본값 = 지도에 보이는 레이어 |
| 주제도 표시 | 구간별로 펼침 (단계구분도·카토그램) |
| 기호 모양 | 도형 종류에 맞춤 (점=원, 선=선분, 면=사각형) + 실제 레이어 스타일 반영 |
| 히트맵·도형표현도 | 이번 범위에서 제외 |
| 지도 위 범례와 중복 | 기존 "지도 위 범례 표시" 토글로 사용자가 직접 조정 |

## 설계

### 범례 모델 — `src/tools/legendModel.js` (신규)

`voronoiHelpers.js`처럼 OpenLayers·DOM에 의존하지 않는 순수 모듈.

```js
buildLegendModel(layerInfo) → { layerId, title, grouped, items: [{ label, symbol }] } | null
```

`symbol` = `{ kind: 'point'|'line'|'polygon', fillColor, fillOpacity, strokeColor,
strokeOpacity, strokeWidth, strokeDash, pointRadius }` — 레이어의 STYLE_FIELDS 값을 그대로
실어 지도와 기호를 일치시킨다.

| 레이어 | 결과 |
|---|---|
| 일반 벡터 | `grouped: false`, 항목 1개. 기호 옆에 레이어 이름 |
| 단계구분도 | `grouped: true`, `_choroplethConfig.breaks`로 구간 수만큼 항목 |
| 카토그램 | `grouped: true`, `_cartogramConfig.breaks`·`colors`로 동일 |
| 래스터·히트맵·도형표현도 | `null` — 목록에서 제외 |

구간 라벨은 지도 위 범례와 같은 규칙(`format`·`rounding`·`unit`)으로 포맷한다.
이를 위해 `formatNumber`를 `ChoroplethTool`에서 이 모듈로 옮기고 `ChoroplethTool`이
가져다 쓴다 — 포맷 규칙이 한 곳에만 있게 한다.

카토그램은 `type`이 `'vector'`라 type만으로는 못 잡는다. `_cartogramConfig`의 존재로
식별한다(`LayerManager.isClassified`와 같은 판별).

### 그리기 — `ExportTool.drawLegend` 재작성

죽은 구현을 버리고 다시 쓴다.

- **자동 크기**: `measureText`로 가장 긴 라벨을 재서 박스 폭 결정 (기존: 120px 고정, 이름 10자 절단)
- **도형별 기호**: 점 = `pointRadius` 반영한 원, 선 = `strokeDash` 반영한 선분, 면 = 채우기+테두리 사각형
- **묶음 렌더**: `grouped`면 제목 줄 아래 구간 항목 들여쓰기, 아니면 기호 옆 이름 한 줄
- **위치**: 박스 왼쪽 위 모서리가 `(x, y)` 기준. 제목·방위표와 같은 비율 좌표

미리보기와 내보내기가 이 함수 하나를 공유한다 → WYSIWYG 유지.

### 패널 UI — `ExportPanel`

"지도 요소"에 제목·방위표와 같은 모양의 범례 그룹 추가.

```
☑ 범례
  ├ 헤더 텍스트: [범례]  ☑ 헤더 표시
  ├ 레이어 목록 (레이어 창 순서, 기본 = 보이는 레이어)
  └ 글꼴 / 크기 / 색상 / 배경(색·투명도)   ← getBasicStyleHTML 재사용
```

- 이미 있는 `.legend-layers`·`.legend-layer-item`·`.layer-color` CSS 사용
- 레이어 없으면 `.no-layers` 문구
- 제외 대상(래스터·히트맵·도형표현도)이 있으면 그 사실을 한 줄 안내
- 기본 위치 `x: 0.78, y: 0.5` — 방위표(0.92, 0.12)와 겹치지 않게
- `hitTestAt`에 `legend` 추가. 박스 크기가 내용 따라 변하므로 그릴 때 측정한 크기를 캐시해
  히트박스로 쓴다(방위표의 `_lastPreviewFontScale`과 같은 방식)

## 테스트

`src/tools/legendModel.test.js` — 순수 함수라 DOM 없이 검증.

- 일반 벡터: 항목 1개, `grouped: false`, 이름이 라벨
- 단계구분도: 항목 수 = `breaks.length - 1`, 라벨 포맷·단위가 지도 범례와 동일
- 카토그램: `type: 'vector'`인데도 `_cartogramConfig`로 잡힘
- 래스터·히트맵·도형표현도: `null`
- 기호가 레이어 스타일(fillColor·strokeDash·pointRadius 등)을 그대로 실음

## 범위 밖

- 히트맵 그라데이션 막대, 도형표현도 필드별 색 목록
- 미호출 상태인 `ExportTool.drawScaleBar`·`drawPreviewScaleBar_unused` (범례와 무관)
- 범례 설정의 프로젝트 저장/복원 (패널은 세션 내 상태만 유지 — 기존 제목·방위표와 동일)

## 정리

`drawPreviewLegend_unused`는 이번 구현이 대체하므로 삭제.
