# M9 프레젠테이션 셸 (PresentationShell) 설계 — 2026-07-05

> **상태: 사용자 합의 대기.** 마스터 §5·§7 기반. 경량 프로세스: 순수 네비 로직만 TDD, DOM 셸·전체화면·재부모는 수동 스모크.

## 0. 목표

편집기에서 만든 `pages`를 **4:3 풀블리드 지도 슬라이드**로 발표. 지도는 배경, 콘텐츠는 반투명 오버레이 카드. ←/→ 로 페이지 전환 시 카메라 비행. 전체화면 지원.

## 1. 핵심 결정 — 기존 자산 재사용 (재파싱 없음)

- **단일 OL 맵 재부모**: 발표는 새 맵을 만들지 않는다. `#map` DOM 노드를 `#map-stage`에서 발표 스테이지(`#presentation .stage`)로 **옮기고**, 나올 때 되돌린다. 이동 후 `mapView.updateSize()`. → 모든 소스·레이어·상태 그대로 유지.
- **페이지 전환 = 에디터와 동일 로직**: `applyPageVisibility(page, registry)` + `animator.flyTo(page.camera)`. (camera=null이면 flyTo가 no-op → 그 자리 유지.)
- **콘텐츠 = 공유 렌더 재사용**: `renderMarkdown(page.content.body)`(살균 HTML). heading/caption은 평문(textContent).

## 2. 확정하려는 UX 결정 (← 사용자 합의 포인트)

1. **진입**: 헤더에 `▶ 발표` 버튼(저장상태 옆). 클릭 → **페이지 1(처음)부터** 시작. [대안: 현재 페이지부터]
2. **지도는 계속 인터랙티브**(패닝·줌 가능). 전환은 **키보드(←/→/Space, Esc 종료) + 화면 오버레이 화살표(◂ ▸) + ✕**로만. **클릭-전환은 안 함.** — 마스터 §5의 "클릭 전환"에서 **의도적 이탈**: 지도 위 클릭-전환은 패닝과 충돌하고, 지오 스토리텔링 도구의 강점인 "발표 중 실시간 지도 탐색"을 죽인다. (사용자 반대 시 클릭-전환 복원 가능.)
3. **오버레이 카드**: 좌하단 고정, 반투명(반투명 흑배경+흰 글씨). `heading`(제목) → `body`(마크다운) → `caption`(작은 글씨) 순. 빈 필드는 생략. **카드 위치 선택은 v2**(page.overrides 자리와 일치).
4. **인디케이터**: 하단 중앙 `● ● ○` (현재 페이지 강조).
5. **전체화면**: `▶ 발표` 진입 시 발표 컨테이너에 Fullscreen API 요청. 브라우저 Esc로 전체화면 해제 시 `fullscreenchange`로 감지해 **발표도 종료**(상태 불일치 방지).
6. **전환 없음(no-wrap)**: 첫 페이지에서 ←, 마지막에서 → 는 무시(래핑 안 함).

## 3. 구성

```
src/viewer/presentationNav.js   순수 — navReduce/indicatorDots/buildOverlay (TDD 대상)
src/viewer/PresentationShell.js DOM 컴포넌트 — createPresentationShell(container, deps) (스모크)
src/main.js                     배선: 셸 생성, #btn-present, 재부모/updateSize, 종료 시 refresh
index.html                      헤더 #btn-present + 발표 컨테이너 #presentation
src/style.css                   4:3 레터박스 스테이지·오버레이 카드·인디케이터·화살표
```

### 3a. `presentationNav.js` (순수, 테스트)
```
navReduce(current, count, action) → 새 index   // action: 'next'|'prev'|'first'|'last', clamp, no-wrap
indicatorDots(count, current) → [{active:boolean}, …]
buildOverlay(content) → { heading, bodyHtml, caption, empty }  // renderMarkdown(body), 빈 필드 제외
```

### 3b. `PresentationShell.js` (주입식 — 에디터 컴포넌트 전례)
`createPresentationShell(container, { mapEl, mapStage, mapView, animator, registry, getDoc, onExit })`
→ `{ enter(startIndex=0), exit() }`
- `enter`: 맵 노드를 스테이지로 이동 → 전체화면 요청 → keydown/fullscreenchange 리스너 등록 → `goTo(startIndex)` → `updateSize`.
- `goTo(i)`: `applyPageVisibility(page, registry)` + `animator.flyTo(page.camera)` + 오버레이/인디케이터 갱신.
- `exit`: 리스너 해제 → 전체화면 해제 → 맵 노드 `#map-stage`로 복귀 → `updateSize` → `onExit()`(main이 refresh로 에디터 현재 페이지 복원).

## 4. 데이터 흐름

1. `▶ 발표` → `presentation.enter(0)` → 맵 재부모 + 전체화면 + 페이지1 렌더/비행.
2. → / Space → `navReduce(i,count,'next')` → goTo → 카메라 비행 + 오버레이 교체.
3. Esc(또는 전체화면 해제) → exit → 맵 복귀 → `refresh()`로 편집 상태 원복.

## 5. 테스트 (Vitest)

- `presentationNav.test.js`: navReduce 경계(첫/끝 clamp, next/prev/first/last), indicatorDots 활성 위치, buildOverlay 빈 필드 생략 + body 마크다운 렌더.
- 재부모·전체화면·키보드·카메라 비행 = 수동 스모크(§6).

## 6. 스모크 (M9 마감 기준, 사용자와 함께)

① `▶ 발표` → 전체화면 4:3, 페이지1 지도+오버레이 ② → 로 다음 페이지 카메라 비행 + 콘텐츠 교체 ③ ← 로 이전, 첫/끝 경계에서 멈춤 ④ 인디케이터 현재 위치 정확 ⑤ 지도 패닝/줌 동작(인터랙티브) ⑥ Esc → 편집기 원복(현재 페이지·레이어·카메라 정상) ⑦ 빈 콘텐츠 페이지는 카드 없이 지도만.

## 7. v2 백로그

카드 위치/스타일 선택(overrides), 전환 효과, 발표자 노트, 클릭/자동 진행, 페이지 썸네일 네비.
