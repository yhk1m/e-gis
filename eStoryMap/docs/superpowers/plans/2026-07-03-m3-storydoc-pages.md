# e-GIStory M3: 문서/페이지 (StoryDoc + SourceRegistry + 페이지별 레이어 토글) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여러 `.egis`/`.tif` 소스를 동시에 로드해 두고, 페이지(슬라이드)마다 레이어 체크박스로 보이기/숨기기를 편집하며, 페이지 전환 시 지도가 그 페이지의 가시성 상태로 바뀌는 에디터 골격을 만든다.

**Architecture:** 문서 상태는 순수 모듈 `StoryDoc`(StoryMapDoc JSON, 단일 진실원)이 소유하고, OL 레이어 실체는 `SourceRegistry`({sourceId, layerId}→olLayer, 전부 지도에 추가하되 visible=false)가 관리한다. `StoryMapRenderer.applyPageVisibility`가 페이지의 `layerVisibility`대로 `setVisible`만 토글(재파싱 없음 — 상위 스펙 §3 렌더링 파이프라인). UI는 좌측 사이드바(SourcePanel 체크 트리 + PageList) DOM 컴포넌트 2개, 배선은 `src/main.js`. **`.egis/.tif 열기`의 시맨틱이 "전체 교체"에서 "소스 추가"로 바뀐다**(M2까지의 임시 규칙을 계획대로 종료).

**Tech Stack:** 기존 그대로 — Electron 30 + Vite 5 + Vanilla JS + OL 9 + Vitest(jsdom). 신규 의존성 없음.

---

## 이 계획의 범위 (중요)

상위 스펙 `eStoryMap-PLAN.md`의 **M3만** 다룬다(§7 "M3 — 문서/페이지: StoryDoc + PageList + SourcePanel 체크박스 연동. 페이지 전환 시 visible 토글" + M1에서 연기한 SourceRegistry). 다음은 **의도적으로 연기(YAGNI)**:

- **카메라**: "📷 이 위치로 캡처" 버튼, 페이지 전환 카메라 이동/애니메이션 — **M4**. M3에서는 `page.camera`를 모델에 두되(null) 적용하지 않는다. 렌더러에 적용 지점 주석만 남김. 소스 추가 시의 카메라 이동(.egis 저장 뷰 or fit)은 M2 동작 유지.
- **콘텐츠 편집**(heading/body/caption) — **M5**. 모델에는 빈 값으로 자리만 확보(§2 스키마).
- **로컬 저장/자동저장(.esm)** — **M6**. `meta.updated`는 갱신하되 dirty 추적·저장은 없음.
- **overrides**(페이지별 스타일) — v2. 모델에 빈 객체 자리만.
- **소스 삭제, 페이지 정렬(드래그)·복제 버튼·이름 변경** — M5+/백로그. M3의 PageList는 추가(직전 페이지 복제)·삭제·선택만.
- 페이지 전환 시 카메라 점프 없음(M4) — 전환은 레이어 가시성만 바뀐다.

M3 완료 기준: "**.egis 두 개와 .tif 하나를 열어 소스 3개를 쌓고, 페이지 2개를 만들어 페이지마다 다른 레이어 조합을 체크하면, 페이지를 오갈 때 지도가 그 조합대로 바뀐다.**"

## 현재 코드 기준 확정 사실 (2026-07-03, 79 tests green)

계획의 코드는 아래 실재 시그니처에 맞춰 작성되었다.

1. `src/core/egisParse.js` — `parseEgisDoc(raw)` → `{version, name, view: {center,zoom}|null, displayCRS, layers[]}`. 레이어는 `{id, name, type:'vector'|'raster', geometryType, visible, color, opacity, features, rasterKind, raster}`로 정규화. **view는 저장 카메라 없으면 null.**
2. `src/core/egisLayers.js` — `buildVectorLayer(layerData)` → OL VectorLayer(`egisLayerId`/`egisLayerName` set, visible/opacity 반영).
3. `src/core/DemRenderer.js` — `canBuildRasterLayer(layerData)` 가드, `buildRasterLayer(layerData)` → OL ImageLayer(동일 메타 set).
4. `src/core/MapView.js` — `addLayer/clearEgisLayers/setView(center4326, zoom)/fitToLayers(olLayers)/updateSize` + export `unionExtent`. jsdom에서 생성 가능(ResizeObserver 스텁 존재).
5. `src/core/geotiffParse.js` — `demDataFromGeoTiff(image)` → demData `{data,width,height,extent(3857),minVal,maxVal,noDataValue}`.
6. `src/core/GeoTiffLoader.js` — 현재 `loadGeoTiffIntoMap(arrayBuffer, filename, mapView)`(전체 교체 시맨틱). **본 계획 Task 9에서 파싱 전용으로 교체됨.**
7. `src/core/EgisLoader.js` + `EgisLoader.test.js`(11 tests) — 전체 교체 로더. **Task 9에서 삭제**되고, 스킵 정책·손상 격리·픽스처 테스트는 Task 5의 SourceRegistry 테스트로 이관됨.
8. `src/main.js` — 툴바 배선(btn-import/btn-tif/btn-folder), `window.egisFS.{importEgis,importTif,openFolder}`. `index.html`은 툴바+`#map`뿐(사이드바 없음).
9. ⚠️ vite.config.js에 `renderer` 플러그인을 **다시 넣지 말 것**(geotiff Node 엔트리 강제 해석으로 렌더러 전멸 — 커밋 8c02e84 참조).
10. jsdom 환경: DOM 생성/이벤트 dispatch 가능, 2D 캔버스 불가(래스터 렌더 자체는 이미 순수부로 커버).

## File Structure

앱 루트: `C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/` (이하 상대경로).

| 파일 | 책임 |
|---|---|
| `src/core/StoryDoc.js` | **순수**: StoryMapDoc 생성·변이(addSource/addPage/removePage/getPage/setLayerVisible/nextSourceId). OL·DOM 의존 없음. |
| `src/core/SourceRegistry.js` | {sourceId, layerId}→olLayer 등록·조회. 레이어 빌드(벡터/래스터, 스킵 정책·손상 격리 포함) 후 **visible=false로** 지도에 추가. |
| `src/core/StoryMapRenderer.js` | **순수/OL**: `applyPageVisibility(page, registry)` — 페이지 `layerVisibility`대로 setVisible. 미등재=숨김. |
| `src/editor/SourcePanel.js` | 좌상단: 소스별 레이어 체크 트리 DOM 컴포넌트. 체크 = 현재 페이지 가시성 편집. |
| `src/editor/PageList.js` | 좌하단: 페이지 목록 DOM 컴포넌트(선택/추가/삭제). |
| Modify: `src/core/geotiffParse.js` | `demDataToEgisDoc(demData, name)` 추가 — demData를 .egis 형식 문서로 래핑(소스 경로 단일화). |
| Replace: `src/core/GeoTiffLoader.js` | `parseGeoTiff(arrayBuffer, filename)` — 파싱만, 지도 반영 없음. |
| Delete: `src/core/EgisLoader.js`, `src/core/EgisLoader.test.js` | 전체 교체 로더 폐기(Task 9). |
| Modify: `src/main.js`, `index.html`, `src/style.css` | 3패널 레이아웃(사이드바+지도) + 소스 추가 배선. |
| Test: `src/core/{StoryDoc,SourceRegistry,StoryMapRenderer}.test.js`, `src/editor/{SourcePanel,PageList}.test.js` | 신규 단위 테스트. |

**StoryMapDoc 모델(상위 스펙 §2 그대로, M3에서 쓰는 형태):**

```jsonc
{
  "meta": { "id": "doc_x1y2z3", "title": "새 스토리맵", "mode": "presentation",
            "created": "ISO8601", "updated": "ISO8601" },
  "sources": [ { "sourceId": "src_1", "filename": "부산_인구.egis",
                 "egis": { /* 원본 .egis JSON 통째 (tif는 demDataToEgisDoc 래핑) */ } } ],
  "pages": [ { "id": "page_1", "title": "페이지 1",
               "camera": null,                       // M4에서 캡처/적용
               "layerVisibility": [ { "sourceId": "src_1", "layerId": "L_a", "visible": true } ],
               "overrides": {},                      // v2 자리
               "content": { "heading": "", "body": "", "caption": "" } } ]  // M5 자리
}
```

**가시성 계약(핵심):** 페이지의 `layerVisibility`에 **미등재된 레이어는 숨김**. `addSource`는 현재 페이지에만 visible:true 엔트리를 추가한다(다른 페이지에서는 자동 숨김). `addPage`는 지정 페이지의 엔트리를 깊은 복사한다.

현재 테스트 기준선: **79개**. 완료 시 **109개**(신규 41, EgisLoader 11 삭제).

---

## Task 1: StoryDoc 골격 — 생성/조회/ID (순수, TDD)

**Files:**
- Test: `src/core/StoryDoc.test.js`
- Create: `src/core/StoryDoc.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/StoryDoc.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { createStoryDoc, getPage, nextSourceId } from './StoryDoc.js';

describe('createStoryDoc', () => {
  it('기본 페이지 1개를 가진 문서를 만든다', () => {
    const doc = createStoryDoc();
    expect(doc.meta.title).toBe('새 스토리맵');
    expect(doc.meta.mode).toBe('presentation');
    expect(doc.sources).toEqual([]);
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0];
    expect(page.id).toBe('page_1');
    expect(page.title).toBe('페이지 1');
    expect(page.camera).toBeNull();
    expect(page.layerVisibility).toEqual([]);
    expect(page.overrides).toEqual({});
    expect(page.content).toEqual({ heading: '', body: '', caption: '' });
  });

  it('meta.id는 doc_ 접두 문자열, created=updated ISO', () => {
    const doc = createStoryDoc('부산 이야기');
    expect(doc.meta.title).toBe('부산 이야기');
    expect(doc.meta.id.startsWith('doc_')).toBe(true);
    expect(doc.meta.created).toBe(doc.meta.updated);
    expect(new Date(doc.meta.created).toString()).not.toBe('Invalid Date');
  });
});

describe('getPage', () => {
  it('id로 페이지를 찾고, 없으면 null', () => {
    const doc = createStoryDoc();
    expect(getPage(doc, 'page_1')).toBe(doc.pages[0]);
    expect(getPage(doc, 'page_999')).toBeNull();
  });
});

describe('nextSourceId', () => {
  it('빈 문서는 src_1', () => {
    expect(nextSourceId(createStoryDoc())).toBe('src_1');
  });

  it('기존 최대 번호 + 1', () => {
    const doc = createStoryDoc();
    doc.sources.push({ sourceId: 'src_1' }, { sourceId: 'src_3' });
    expect(nextSourceId(doc)).toBe('src_4');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npx vitest run src/core/StoryDoc.test.js`
Expected: FAIL — `StoryDoc.js` 모듈 없음.

- [ ] **Step 3: 최소 구현** — `src/core/StoryDoc.js`

```js
// © 2026 김용현
// eStoryMap/src/core/StoryDoc.js
// StoryMapDoc(상위 스펙 §2) 생성·변이 — 순수 모듈. OL·DOM 의존 없음.
// 문서가 단일 진실원이며, 변이 함수는 전달받은 doc을 직접 수정한다.
// 선택된 페이지(currentPageId)는 에디터 UI 상태로, 문서에 저장하지 않는다.

function nowISO() {
  return new Date().toISOString();
}

/** 'prefix_N' 꼴 id 중 최대 N + 1. (M3는 소스 삭제가 없어 재사용 충돌 없음) */
function nextId(items, key, prefix) {
  let max = 0;
  for (const item of items) {
    const m = new RegExp(`^${prefix}_(\\d+)$`).exec(item[key]);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}_${max + 1}`;
}

export function nextSourceId(doc) {
  return nextId(doc.sources, 'sourceId', 'src');
}

function nextPageId(doc) {
  return nextId(doc.pages, 'id', 'page');
}

function makePage(id, title) {
  return {
    id,
    title,
    camera: null, // {center:[lon,lat], zoom} — 캡처/적용은 M4
    layerVisibility: [], // [{sourceId, layerId, visible}] — 미등재 = 숨김
    overrides: {}, // v2 자리
    content: { heading: '', body: '', caption: '' }, // M5 자리
  };
}

/** 새 StoryMapDoc. 기본 페이지 1개 포함. */
export function createStoryDoc(title = '새 스토리맵') {
  const now = nowISO();
  return {
    meta: {
      id: 'doc_' + Math.random().toString(36).slice(2, 10),
      title,
      mode: 'presentation',
      created: now,
      updated: now,
    },
    sources: [],
    pages: [makePage('page_1', '페이지 1')],
  };
}

export function getPage(doc, pageId) {
  return doc.pages.find((p) => p.id === pageId) || null;
}

export function touch(doc) {
  doc.meta.updated = nowISO();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npx vitest run src/core/StoryDoc.test.js`
Expected: PASS (5 tests). 전체 `npm test` → 84.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/StoryDoc.js eStoryMap/src/core/StoryDoc.test.js && git commit -m "feat(eStoryMap): M3 StoryDoc 골격 — 문서 생성/페이지 조회/ID(순수)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: StoryDoc 변이① — addSource / setLayerVisible (순수, TDD)

**Files:**
- Test: `src/core/StoryDoc.test.js` (추가)
- Modify: `src/core/StoryDoc.js`

- [ ] **Step 1: 실패하는 테스트 추가** — `src/core/StoryDoc.test.js` 상단 import를 교체하고 파일 끝에 describe 추가:

```js
import {
  createStoryDoc, getPage, nextSourceId, addSource, setLayerVisible,
} from './StoryDoc.js';
```

```js
describe('addSource', () => {
  it('sources에 추가하고 소스를 반환한다', () => {
    const doc = createStoryDoc();
    const src = addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: { version: '1.0' } },
      ['L_a', 'L_b'], 'page_1');
    expect(doc.sources).toHaveLength(1);
    expect(src.sourceId).toBe('src_1');
    expect(src.egis).toEqual({ version: '1.0' });
  });

  it('지정 페이지에 visible:true 엔트리를 레이어마다 추가한다', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a', 'L_b'], 'page_1');
    expect(getPage(doc, 'page_1').layerVisibility).toEqual([
      { sourceId: 'src_1', layerId: 'L_a', visible: true },
      { sourceId: 'src_1', layerId: 'L_b', visible: true },
    ]);
  });

  it('다른 페이지에는 엔트리를 추가하지 않는다(미등재=숨김 계약)', () => {
    const doc = createStoryDoc();
    doc.pages.push({ ...doc.pages[0], id: 'page_2', layerVisibility: [] });
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    expect(getPage(doc, 'page_2').layerVisibility).toEqual([]);
  });
});

describe('setLayerVisible', () => {
  it('기존 엔트리를 갱신한다', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    setLayerVisible(doc, 'page_1', 'src_1', 'L_a', false);
    expect(getPage(doc, 'page_1').layerVisibility[0].visible).toBe(false);
  });

  it('엔트리가 없으면 새로 만든다(upsert)', () => {
    const doc = createStoryDoc();
    setLayerVisible(doc, 'page_1', 'src_9', 'L_x', true);
    expect(getPage(doc, 'page_1').layerVisibility).toEqual([
      { sourceId: 'src_9', layerId: 'L_x', visible: true },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/StoryDoc.test.js` — Expected: 새 5개 FAIL(export 없음), 기존 5개 PASS.

- [ ] **Step 3: 구현** — `src/core/StoryDoc.js`의 `touch` 아래에 추가:

```js
/**
 * 소스를 추가하고, 지정 페이지에만 visible:true 가시성 엔트리를 만든다.
 * (다른 페이지는 미등재 = 숨김. 상위 스펙 §2 가시성 계약)
 * @param {object} doc
 * @param {{sourceId:string, filename:string, egis:object}} source - egis는 원본 JSON 통째
 * @param {string[]} layerIds - SourceRegistry가 실제로 빌드한 레이어 id들
 * @param {string} pageId - 현재 페이지
 */
export function addSource(doc, source, layerIds, pageId) {
  doc.sources.push(source);
  const page = getPage(doc, pageId);
  if (page) {
    for (const layerId of layerIds) {
      page.layerVisibility.push({ sourceId: source.sourceId, layerId, visible: true });
    }
  }
  touch(doc);
  return source;
}

/** 페이지의 레이어 가시성 갱신(없으면 생성). */
export function setLayerVisible(doc, pageId, sourceId, layerId, visible) {
  const page = getPage(doc, pageId);
  if (!page) return;
  const entry = page.layerVisibility.find(
    (v) => v.sourceId === sourceId && v.layerId === layerId,
  );
  if (entry) entry.visible = visible;
  else page.layerVisibility.push({ sourceId, layerId, visible });
  touch(doc);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/StoryDoc.test.js` — Expected: PASS (10 tests). 전체 89.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/StoryDoc.js eStoryMap/src/core/StoryDoc.test.js && git commit -m "feat(eStoryMap): M3 StoryDoc 변이 — addSource/setLayerVisible

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: StoryDoc 변이② — addPage(직전 복제) / removePage (순수, TDD)

**Files:**
- Test: `src/core/StoryDoc.test.js` (추가)
- Modify: `src/core/StoryDoc.js`

- [ ] **Step 1: 실패하는 테스트 추가** — import에 `addPage, removePage` 추가 후 파일 끝에:

```js
describe('addPage', () => {
  it('지정 페이지의 layerVisibility를 깊은 복사한다(상위 스펙 §4)', () => {
    const doc = createStoryDoc();
    addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, ['L_a'], 'page_1');
    const p2 = addPage(doc, 'page_1');
    expect(p2.layerVisibility).toEqual(getPage(doc, 'page_1').layerVisibility);
    setLayerVisible(doc, p2.id, 'src_1', 'L_a', false);
    expect(getPage(doc, 'page_1').layerVisibility[0].visible).toBe(true); // 원본 독립
  });

  it('camera를 복사한다(참조 독립)', () => {
    const doc = createStoryDoc();
    getPage(doc, 'page_1').camera = { center: [129, 35], zoom: 10 };
    const p2 = addPage(doc, 'page_1');
    expect(p2.camera).toEqual({ center: [129, 35], zoom: 10 });
    expect(p2.camera).not.toBe(getPage(doc, 'page_1').camera);
    expect(p2.camera.center).not.toBe(getPage(doc, 'page_1').camera.center);
  });

  it('끝에 추가되고 id/제목이 이어진다, content/overrides는 빈 값', () => {
    const doc = createStoryDoc();
    const p2 = addPage(doc, 'page_1');
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[1]).toBe(p2);
    expect(p2.id).toBe('page_2');
    expect(p2.title).toBe('페이지 2');
    expect(p2.content).toEqual({ heading: '', body: '', caption: '' });
    expect(p2.overrides).toEqual({});
  });
});

describe('removePage', () => {
  it('페이지를 제거하고 반환한다', () => {
    const doc = createStoryDoc();
    const p2 = addPage(doc, 'page_1');
    const removed = removePage(doc, p2.id);
    expect(removed).toBe(p2);
    expect(doc.pages).toHaveLength(1);
  });

  it('마지막 1페이지는 제거할 수 없다(null 반환, 유지)', () => {
    const doc = createStoryDoc();
    expect(removePage(doc, 'page_1')).toBeNull();
    expect(doc.pages).toHaveLength(1);
  });

  it('없는 페이지 id는 null', () => {
    const doc = createStoryDoc();
    addPage(doc, 'page_1');
    expect(removePage(doc, 'page_999')).toBeNull();
    expect(doc.pages).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/StoryDoc.test.js` — Expected: 새 6개 FAIL, 기존 10개 PASS.

- [ ] **Step 3: 구현** — `src/core/StoryDoc.js`에 추가:

```js
/**
 * 새 페이지를 끝에 추가. 지정 페이지(보통 현재 페이지)의
 * layerVisibility·camera를 복제한다(연속 편집 편의 — 상위 스펙 §4).
 */
export function addPage(doc, copyFromPageId) {
  const from = getPage(doc, copyFromPageId);
  const page = makePage(nextPageId(doc), `페이지 ${doc.pages.length + 1}`);
  if (from) {
    page.layerVisibility = from.layerVisibility.map((v) => ({ ...v }));
    page.camera = from.camera
      ? { center: [...from.camera.center], zoom: from.camera.zoom }
      : null;
  }
  doc.pages.push(page);
  touch(doc);
  return page;
}

/** 페이지 제거. 최소 1페이지는 유지(마지막 페이지면 null). */
export function removePage(doc, pageId) {
  if (doc.pages.length <= 1) return null;
  const idx = doc.pages.findIndex((p) => p.id === pageId);
  if (idx === -1) return null;
  const [removed] = doc.pages.splice(idx, 1);
  touch(doc);
  return removed;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/StoryDoc.test.js` — Expected: PASS (16 tests). 전체 95.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/StoryDoc.js eStoryMap/src/core/StoryDoc.test.js && git commit -m "feat(eStoryMap): M3 StoryDoc 변이 — addPage(직전 복제)/removePage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: demDataToEgisDoc — .tif를 .egis 형식 소스로 래핑 (순수, TDD)

.tif도 .egis와 **같은 소스 추가 경로 하나**로 흐르게 하는 래퍼(상위 스펙 §1b "세 경로 모두 SourceRegistry에 동일하게 등록").

**Files:**
- Test: `src/core/geotiffParse.test.js` (추가)
- Modify: `src/core/geotiffParse.js`

- [ ] **Step 1: 실패하는 테스트 추가** — `src/core/geotiffParse.test.js`의 import에 `demDataToEgisDoc` 추가 후 파일 끝에:

```js
describe('demDataToEgisDoc', () => {
  const DEM = {
    data: new Float32Array([1, 2, 3, 4]), width: 2, height: 2,
    extent: [0, 0, 10, 10], minVal: 1, maxVal: 4, noDataValue: -9999,
  };

  it('.egis 형식 문서로 래핑한다(dem 레이어 1개, view 없음)', () => {
    const egis = demDataToEgisDoc(DEM, '뒷산');
    expect(egis.version).toBe('1.0');
    expect(egis.name).toBe('뒷산');
    expect(egis.view).toBeUndefined();
    expect(egis.layers).toHaveLength(1);
    const layer = egis.layers[0];
    expect(layer).toMatchObject({
      id: 'L_dem', name: '뒷산', type: 'raster', rasterKind: 'dem',
      visible: true, opacity: 0.8,
    });
    expect(layer.raster).toBe(DEM); // 데이터 복사 없이 그대로 참조
  });

  it('parseEgisDoc 정규화를 통과한다(view null, 레이어 보존)', async () => {
    const { parseEgisDoc } = await import('./egisParse.js');
    const doc = parseEgisDoc(demDataToEgisDoc(DEM, '뒷산'));
    expect(doc.view).toBeNull();
    expect(doc.layers[0].rasterKind).toBe('dem');
    expect(doc.layers[0].raster).toBe(DEM);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/geotiffParse.test.js` — Expected: 새 2개 FAIL(export 없음), 기존 13개 PASS.

- [ ] **Step 3: 구현** — `src/core/geotiffParse.js` 파일 끝에 추가:

```js
/**
 * demData를 .egis 형식 문서로 래핑 — .tif도 .egis와 동일한
 * 소스 추가 경로(parseEgisDoc → SourceRegistry)를 타게 한다.
 * raster.data는 TypedArray 그대로(디코딩된 형태) — decodeRasterMeta가 통과시킨다.
 */
export function demDataToEgisDoc(demData, name) {
  return {
    version: '1.0',
    name,
    layers: [{
      id: 'L_dem',
      name,
      type: 'raster',
      rasterKind: 'dem',
      visible: true,
      opacity: 0.8, // e-GIS DEM 기본 불투명도
      raster: demData,
    }],
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/geotiffParse.test.js` — Expected: PASS (15 tests). 전체 97.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/geotiffParse.js eStoryMap/src/core/geotiffParse.test.js && git commit -m "feat(eStoryMap): M3 demDataToEgisDoc — .tif를 .egis 형식 소스로 래핑(순수)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: SourceRegistry — 소스별 OL 레이어 등록 (TDD)

**Files:**
- Test: `src/core/SourceRegistry.test.js`
- Create: `src/core/SourceRegistry.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/SourceRegistry.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { SourceRegistry } from './SourceRegistry.js';
import { parseEgisDoc } from './egisParse.js';
// 픽스처: dem + analysis + unknown 래스터 3레이어 (M2 스모크 픽스처 재사용)
import sampleDemRaw from '../../fixtures/sample_dem.egis?raw';

// MapView 대역: addLayer 기록만
function fakeMapView() {
  const added = [];
  return { added, addLayer(layer) { added.push(layer); } };
}

const VECTOR_LAYER = {
  id: 'L_v', name: '경계', type: 'vector', geometryType: 'Polygon',
  visible: true, color: '#ef4444', opacity: 1,
  features: { type: 'FeatureCollection', features: [] },
};

const DEM_LAYER = {
  id: 'L_d', name: '고도', type: 'raster', rasterKind: 'dem', visible: true, opacity: 0.8,
  raster: {
    data: {
      __encoding: 'base64', dtype: 'Float32Array',
      base64: 'AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E',
    },
    width: 4, height: 3, extent: [0, 0, 400, 300], minVal: 0, maxVal: 700, noDataValue: -9999,
  },
};

function docWith(layers) {
  return parseEgisDoc({ version: '1.0', layers });
}

describe('SourceRegistry.addSource', () => {
  it('벡터·래스터를 빌드해 visible=false로 지도에 추가하고 builtLayerIds를 보고한다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const result = reg.addSource('src_1', docWith([VECTOR_LAYER, DEM_LAYER]));
    expect(result.builtLayerIds).toEqual(['L_v', 'L_d']);
    expect(result.skipped).toBe(0);
    expect(mv.added).toHaveLength(2);
    expect(mv.added.every((l) => l.getVisible() === false)).toBe(true);
  });

  it('egisLayerId가 소스 네임스페이스(src/layer)로 설정된다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER]));
    expect(mv.added[0].get('egisLayerId')).toBe('src_1/L_v');
  });

  it('unknown·데이터 결손 래스터는 스킵 카운트(e-GIS 스킵 정책)', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const result = reg.addSource('src_1', docWith([
      { id: 'L_u', name: '미상', type: 'raster', rasterKind: 'unknown' },
      VECTOR_LAYER,
    ]));
    expect(result.skipped).toBe(1);
    expect(result.builtLayerIds).toEqual(['L_v']);
  });

  it('손상 레이어는 격리되고 나머지는 계속(레이어별 try/catch)', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const corrupt = {
      ...DEM_LAYER, id: 'L_bad',
      raster: { ...DEM_LAYER.raster, data: { __encoding: 'base64', dtype: 'Float32Array', base64: 'AAAA' } },
    };
    const result = reg.addSource('src_1', docWith([corrupt, VECTOR_LAYER]));
    expect(result.skipped).toBe(1);
    expect(result.builtLayerIds).toEqual(['L_v']);
  });

  it('같은 layerId를 가진 두 소스가 충돌 없이 공존한다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER]));
    reg.addSource('src_2', docWith([VECTOR_LAYER]));
    expect(reg.getLayer('src_1', 'L_v')).not.toBe(reg.getLayer('src_2', 'L_v'));
    expect(mv.added).toHaveLength(2);
  });
});

describe('SourceRegistry 조회', () => {
  it('getLayer는 등록된 레이어, 없으면 null', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER]));
    expect(reg.getLayer('src_1', 'L_v')).toBe(mv.added[0]);
    expect(reg.getLayer('src_1', 'L_x')).toBeNull();
  });

  it('entriesList가 {sourceId, layerId, layer}를 순서대로 준다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER, DEM_LAYER]));
    const list = reg.entriesList();
    expect(list.map((e) => `${e.sourceId}:${e.layerId}`)).toEqual(['src_1:L_v', 'src_1:L_d']);
    expect(list[0].layer).toBe(mv.added[0]);
  });
});

describe('픽스처 통합', () => {
  it('sample_dem.egis → 2개 빌드, 1개 스킵(M2 픽스처 회귀)', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const result = reg.addSource('src_1', parseEgisDoc(JSON.parse(sampleDemRaw)));
    expect(result.builtLayerIds).toEqual(['L_dem', 'L_slope']);
    expect(result.skipped).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/SourceRegistry.test.js` — Expected: FAIL — `SourceRegistry.js` 없음.

- [ ] **Step 3: 최소 구현** — `src/core/SourceRegistry.js`

```js
// © 2026 김용현
// eStoryMap/src/core/SourceRegistry.js
// 여러 소스의 OL 레이어 실체 관리: {sourceId, layerId} → olLayer.
// 상위 스펙 §3 렌더링 파이프라인: 소스 추가 시 1회 빌드, 전부 지도에 추가하되
// visible=false — 이후 페이지 전환은 setVisible 토글만(재파싱 없음).
import { buildVectorLayer } from './egisLayers.js';
import { buildRasterLayer, canBuildRasterLayer } from './DemRenderer.js';

export class SourceRegistry {
  /** @param {{addLayer(l):void}} mapView - MapView(또는 동등 인터페이스) */
  constructor(mapView) {
    this.mapView = mapView;
    this.layers = new Map(); // 'sourceId/layerId' → olLayer (삽입 순서 유지)
  }

  key(sourceId, layerId) {
    return `${sourceId}/${layerId}`;
  }

  /**
   * parseEgisDoc 산출 문서의 레이어들을 빌드해 등록한다.
   * unknown/데이터 결손은 스킵, 손상 레이어는 격리(e-GIS deserialize 정책).
   * @returns {{builtLayerIds:string[], skipped:number, olLayers:object[]}}
   */
  addSource(sourceId, parsedDoc) {
    const builtLayerIds = [];
    const olLayers = [];
    let skipped = 0;

    for (const layerData of parsedDoc.layers) {
      let olLayer;
      try {
        if (layerData.type === 'vector') {
          olLayer = buildVectorLayer(layerData);
        } else if (canBuildRasterLayer(layerData)) {
          olLayer = buildRasterLayer(layerData);
        } else {
          skipped++;
          continue;
        }
      } catch (e) {
        console.warn(`레이어 "${layerData.name}" 빌드 실패:`, e);
        skipped++;
        continue;
      }
      olLayer.setVisible(false); // 가시성은 페이지가 결정 (applyPageVisibility)
      olLayer.set('egisLayerId', this.key(sourceId, layerData.id)); // 소스 네임스페이스
      this.layers.set(this.key(sourceId, layerData.id), olLayer);
      this.mapView.addLayer(olLayer);
      builtLayerIds.push(layerData.id);
      olLayers.push(olLayer);
    }

    return { builtLayerIds, skipped, olLayers };
  }

  getLayer(sourceId, layerId) {
    return this.layers.get(this.key(sourceId, layerId)) || null;
  }

  /** 등록 순서대로 [{sourceId, layerId, layer}]. sourceId에는 '/'가 없다(src_N). */
  entriesList() {
    return [...this.layers.entries()].map(([k, layer]) => {
      const i = k.indexOf('/');
      return { sourceId: k.slice(0, i), layerId: k.slice(i + 1), layer };
    });
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/SourceRegistry.test.js` — Expected: PASS (8 tests). 전체 105.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/SourceRegistry.js eStoryMap/src/core/SourceRegistry.test.js && git commit -m "feat(eStoryMap): M3 SourceRegistry — 소스별 OL 레이어 등록(visible=false, 스킵·격리 정책 이관)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: StoryMapRenderer — 페이지 가시성 적용 (TDD)

**Files:**
- Test: `src/core/StoryMapRenderer.test.js`
- Create: `src/core/StoryMapRenderer.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/core/StoryMapRenderer.test.js`

```js
// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { applyPageVisibility } from './StoryMapRenderer.js';
import { SourceRegistry } from './SourceRegistry.js';
import { parseEgisDoc } from './egisParse.js';
import { createStoryDoc, addSource, addPage, getPage, setLayerVisible } from './StoryDoc.js';

const VECTOR = (id) => ({
  id, name: id, type: 'vector', geometryType: 'Polygon',
  visible: true, color: '#ef4444', opacity: 1,
  features: { type: 'FeatureCollection', features: [] },
});

function setup() {
  const mv = { addLayer() {} };
  const reg = new SourceRegistry(mv);
  const doc = createStoryDoc();
  const parsed = parseEgisDoc({ version: '1.0', layers: [VECTOR('L_a'), VECTOR('L_b')] });
  const { builtLayerIds } = reg.addSource('src_1', parsed);
  addSource(doc, { sourceId: 'src_1', filename: 'a.egis', egis: {} }, builtLayerIds, 'page_1');
  return { reg, doc };
}

describe('applyPageVisibility', () => {
  it('등재된 visible:true 레이어를 켠다', () => {
    const { reg, doc } = setup();
    applyPageVisibility(getPage(doc, 'page_1'), reg);
    expect(reg.getLayer('src_1', 'L_a').getVisible()).toBe(true);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(true);
  });

  it('visible:false 엔트리는 끈다', () => {
    const { reg, doc } = setup();
    setLayerVisible(doc, 'page_1', 'src_1', 'L_b', false);
    applyPageVisibility(getPage(doc, 'page_1'), reg);
    expect(reg.getLayer('src_1', 'L_a').getVisible()).toBe(true);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(false);
  });

  it('미등재 레이어는 숨긴다', () => {
    const { reg, doc } = setup();
    const p2 = addPage(doc, 'page_1');
    p2.layerVisibility = []; // 빈 페이지
    applyPageVisibility(p2, reg);
    expect(reg.getLayer('src_1', 'L_a').getVisible()).toBe(false);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(false);
  });

  it('페이지 전환 시나리오: page_1(모두 켬) ↔ page_2(L_a만) 왕복', () => {
    const { reg, doc } = setup();
    const p2 = addPage(doc, 'page_1');
    setLayerVisible(doc, p2.id, 'src_1', 'L_b', false);
    applyPageVisibility(getPage(doc, p2.id), reg);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(false);
    applyPageVisibility(getPage(doc, 'page_1'), reg);
    expect(reg.getLayer('src_1', 'L_b').getVisible()).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/core/StoryMapRenderer.test.js` — Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현** — `src/core/StoryMapRenderer.js`

```js
// © 2026 김용현
// eStoryMap/src/core/StoryMapRenderer.js
// 현재 페이지 상태 → OL 지도 반영. 지오데이터 재파싱 없이 setVisible 토글만
// (상위 스펙 §3 렌더링 파이프라인 — 전환이 가볍고 빠른 이유).

/**
 * 페이지의 layerVisibility대로 레지스트리의 모든 레이어 가시성을 맞춘다.
 * 미등재 레이어는 숨김(§2 가시성 계약).
 * @param {object} page - StoryDoc 페이지
 * @param {import('./SourceRegistry.js').SourceRegistry} registry
 */
export function applyPageVisibility(page, registry) {
  for (const { sourceId, layerId, layer } of registry.entriesList()) {
    const entry = page.layerVisibility.find(
      (v) => v.sourceId === sourceId && v.layerId === layerId,
    );
    layer.setVisible(entry ? entry.visible : false);
  }
  // (M4) page.camera 적용 지점 — CameraAnimator에서 이동/애니메이션 담당 예정.
  // (v2) page.overrides 적용 지점.
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/core/StoryMapRenderer.test.js` — Expected: PASS (4 tests). 전체 109.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/core/StoryMapRenderer.js eStoryMap/src/core/StoryMapRenderer.test.js && git commit -m "feat(eStoryMap): M3 StoryMapRenderer — 페이지 가시성 setVisible 토글

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: SourcePanel — 소스/레이어 체크 트리 (DOM, TDD)

**Files:**
- Test: `src/editor/SourcePanel.test.js`
- Create: `src/editor/SourcePanel.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/editor/SourcePanel.test.js`

```js
// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createSourcePanel } from './SourcePanel.js';

// SourceRegistry 대역: entriesList만 흉내(레이어는 get('egisLayerName')만 필요)
function fakeRegistry(entries) {
  return {
    entriesList: () => entries.map(({ sourceId, layerId, name }) => ({
      sourceId, layerId, layer: { get: (k) => (k === 'egisLayerName' ? name : null) },
    })),
  };
}

const DOC = {
  sources: [
    { sourceId: 'src_1', filename: '부산.egis' },
    { sourceId: 'src_2', filename: '뒷산.tif' },
  ],
};

const REG = fakeRegistry([
  { sourceId: 'src_1', layerId: 'L_a', name: '인구' },
  { sourceId: 'src_1', layerId: 'L_b', name: '경계' },
  { sourceId: 'src_2', layerId: 'L_dem', name: '고도' },
]);

function pageWith(entries) {
  return { layerVisibility: entries };
}

describe('SourcePanel', () => {
  it('소스별 그룹과 레이어 이름을 렌더한다', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render(DOC, pageWith([]), REG);
    const names = [...el.querySelectorAll('.source-name')].map((n) => n.textContent);
    expect(names).toEqual(['부산.egis', '뒷산.tif']);
    const rows = [...el.querySelectorAll('.layer-row')].map((n) => n.textContent);
    expect(rows).toEqual(['인구', '경계', '고도']);
  });

  it('체크 상태가 페이지 엔트리를 반영한다(미등재는 unchecked)', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render(DOC, pageWith([
      { sourceId: 'src_1', layerId: 'L_a', visible: true },
      { sourceId: 'src_1', layerId: 'L_b', visible: false },
    ]), REG);
    const boxes = [...el.querySelectorAll('input[type=checkbox]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false]); // L_dem 미등재 → false
  });

  it('체크 변경 시 onToggleLayer(sourceId, layerId, checked) 호출', () => {
    const el = document.createElement('div');
    const onToggleLayer = vi.fn();
    const panel = createSourcePanel(el, { onToggleLayer });
    panel.render(DOC, pageWith([]), REG);
    const box = el.querySelector('input[type=checkbox]');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(onToggleLayer).toHaveBeenCalledWith('src_1', 'L_a', true);
  });

  it('소스가 없으면 안내 문구를 보여준다', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render({ sources: [] }, pageWith([]), fakeRegistry([]));
    expect(el.querySelector('.panel-empty')).not.toBeNull();
  });

  it('다른 페이지로 다시 render하면 체크 상태가 갱신된다', () => {
    const el = document.createElement('div');
    const panel = createSourcePanel(el, { onToggleLayer: vi.fn() });
    panel.render(DOC, pageWith([{ sourceId: 'src_1', layerId: 'L_a', visible: true }]), REG);
    expect(el.querySelector('input[type=checkbox]').checked).toBe(true);
    panel.render(DOC, pageWith([]), REG);
    expect(el.querySelector('input[type=checkbox]').checked).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/editor/SourcePanel.test.js` — Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현** — `src/editor/SourcePanel.js`

```js
// © 2026 김용현
// eStoryMap/src/editor/SourcePanel.js
// 좌측 SOURCE 트리: 소스(파일)별 레이어 체크박스.
// 체크박스 = "현재 선택된 페이지"의 layerVisibility 편집(상위 스펙 §4).

/**
 * @param {HTMLElement} container
 * @param {{onToggleLayer(sourceId:string, layerId:string, visible:boolean):void}} handlers
 */
export function createSourcePanel(container, { onToggleLayer }) {
  function render(doc, page, registry) {
    container.innerHTML = '';

    if (!doc.sources.length) {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = '.egis 열기 / .tif 열기로 소스를 추가하세요';
      container.appendChild(empty);
      return;
    }

    const entries = registry.entriesList();
    for (const source of doc.sources) {
      const box = document.createElement('div');
      box.className = 'source-item';

      const title = document.createElement('div');
      title.className = 'source-name';
      title.textContent = source.filename;
      box.appendChild(title);

      for (const { sourceId, layerId, layer } of entries) {
        if (sourceId !== source.sourceId) continue;
        const label = document.createElement('label');
        label.className = 'layer-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const entry = page.layerVisibility.find(
          (v) => v.sourceId === sourceId && v.layerId === layerId,
        );
        cb.checked = entry ? entry.visible : false; // 미등재 = 숨김
        cb.addEventListener('change', () => onToggleLayer(sourceId, layerId, cb.checked));

        label.appendChild(cb);
        label.appendChild(document.createTextNode(layer.get('egisLayerName') || layerId));
        box.appendChild(label);
      }
      container.appendChild(box);
    }
  }

  return { render };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/editor/SourcePanel.test.js` — Expected: PASS (5 tests). 전체 114.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/editor/SourcePanel.js eStoryMap/src/editor/SourcePanel.test.js && git commit -m "feat(eStoryMap): M3 SourcePanel — 소스별 레이어 체크 트리(DOM)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: PageList — 페이지 목록 (DOM, TDD)

**Files:**
- Test: `src/editor/PageList.test.js`
- Create: `src/editor/PageList.js`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/editor/PageList.test.js`

```js
// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import { createPageList } from './PageList.js';

const DOC2 = { pages: [{ id: 'page_1', title: '페이지 1' }, { id: 'page_2', title: '페이지 2' }] };
const DOC1 = { pages: [{ id: 'page_1', title: '페이지 1' }] };

function make(handlers = {}) {
  const el = document.createElement('div');
  const list = createPageList(el, {
    onSelect: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), ...handlers,
  });
  return { el, list };
}

describe('PageList', () => {
  it('페이지 행들과 선택 하이라이트를 렌더한다', () => {
    const { el, list } = make();
    list.render(DOC2, 'page_2');
    const rows = [...el.querySelectorAll('.page-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains('selected')).toBe(false);
    expect(rows[1].classList.contains('selected')).toBe(true);
    expect(rows[0].textContent).toContain('페이지 1');
  });

  it('행 이름 클릭 → onSelect(pageId)', () => {
    const onSelect = vi.fn();
    const { el, list } = make({ onSelect });
    list.render(DOC2, 'page_1');
    el.querySelectorAll('.page-row .page-name')[1].dispatchEvent(new Event('click'));
    expect(onSelect).toHaveBeenCalledWith('page_2');
  });

  it('+ 페이지 클릭 → onAdd', () => {
    const onAdd = vi.fn();
    const { el, list } = make({ onAdd });
    list.render(DOC1, 'page_1');
    el.querySelector('#btn-add-page').dispatchEvent(new Event('click'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('× 클릭 → onRemove(pageId)', () => {
    const onRemove = vi.fn();
    const { el, list } = make({ onRemove });
    list.render(DOC2, 'page_1');
    el.querySelectorAll('.page-del')[1].dispatchEvent(new Event('click'));
    expect(onRemove).toHaveBeenCalledWith('page_2');
  });

  it('1페이지뿐이면 삭제 버튼 disabled', () => {
    const { el, list } = make();
    list.render(DOC1, 'page_1');
    expect(el.querySelector('.page-del').disabled).toBe(true);
  });

  it('재렌더 시 행이 갱신된다', () => {
    const { el, list } = make();
    list.render(DOC1, 'page_1');
    expect(el.querySelectorAll('.page-row')).toHaveLength(1);
    list.render(DOC2, 'page_1');
    expect(el.querySelectorAll('.page-row')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/editor/PageList.test.js` — Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현** — `src/editor/PageList.js`

```js
// © 2026 김용현
// eStoryMap/src/editor/PageList.js
// 좌하단 PAGES: 페이지 선택/추가(직전 복제)/삭제. 정렬·이름변경은 M5+.

/**
 * @param {HTMLElement} container
 * @param {{onSelect(pageId):void, onAdd():void, onRemove(pageId):void}} handlers
 */
export function createPageList(container, { onSelect, onAdd, onRemove }) {
  function render(doc, selectedPageId) {
    container.innerHTML = '';

    for (const page of doc.pages) {
      const row = document.createElement('div');
      row.className = 'page-row' + (page.id === selectedPageId ? ' selected' : '');

      const name = document.createElement('span');
      name.className = 'page-name';
      name.textContent = page.title;
      name.addEventListener('click', () => onSelect(page.id));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'page-del';
      del.textContent = '×';
      del.disabled = doc.pages.length <= 1; // 최소 1페이지 유지
      del.addEventListener('click', () => onRemove(page.id));

      row.appendChild(name);
      row.appendChild(del);
      container.appendChild(row);
    }

    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'btn-add-page';
    add.textContent = '+ 페이지';
    add.addEventListener('click', () => onAdd());
    container.appendChild(add);
  }

  return { render };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/editor/PageList.test.js` — Expected: PASS (6 tests). 전체 120.

- [ ] **Step 5: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add eStoryMap/src/editor/PageList.js eStoryMap/src/editor/PageList.test.js && git commit -m "feat(eStoryMap): M3 PageList — 페이지 선택/추가/삭제(DOM)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: 재배선 — 레이아웃 + 소스 추가 플로우 + 레거시 제거 (M3 완료)

**Files:**
- Modify: `index.html`, `src/style.css`, `src/main.js`
- Replace: `src/core/GeoTiffLoader.js`
- Delete: `src/core/EgisLoader.js`, `src/core/EgisLoader.test.js`

> 이 Task부터 `.egis/.tif 열기`가 "전체 교체"에서 "**소스 추가**"로 바뀐다(계획된 시맨틱 전환 — M2의 임시 규칙 종료). EgisLoader가 담당하던 정책(스킵/격리/픽스처)은 Task 5의 SourceRegistry 테스트로 이미 이관돼 있어 삭제로 커버리지가 줄지 않는다. 소스 추가 시 카메라(.egis 저장 뷰 우선, 없으면 fit)는 main.js 접착부로 이동 — 수동 스모크로 검증.

- [ ] **Step 1: `index.html`의 `<div id="app">` 블록을 아래로 교체** (툴바 유지 + 사이드바 추가)

```html
    <div id="app">
      <header id="toolbar">
        <strong class="brand">e-GIStory</strong>
        <button id="btn-import" type="button">.egis 열기</button>
        <button id="btn-tif" type="button">.tif 열기</button>
        <button id="btn-folder" type="button">저장 폴더 열기</button>
        <span id="status"></span>
      </header>
      <div id="workspace">
        <aside id="sidebar">
          <section class="panel">
            <h2 class="panel-title">소스</h2>
            <div id="source-panel"></div>
          </section>
          <section class="panel">
            <h2 class="panel-title">페이지</h2>
            <div id="page-list"></div>
          </section>
        </aside>
        <div id="map"></div>
      </div>
    </div>
```

- [ ] **Step 2: `src/style.css` 끝에 추가**

```css
/* --- M3 에디터 레이아웃 --- */
#workspace { flex: 1; display: flex; min-height: 0; }
#sidebar {
  width: 240px; flex: none; overflow-y: auto;
  background: #0f172a; color: #e5e7eb; border-right: 1px solid #1e293b;
  display: flex; flex-direction: column;
}
.panel { padding: 10px 12px; border-bottom: 1px solid #1e293b; }
.panel-title { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em; }
.panel-empty { font-size: 12px; color: #64748b; }
.source-item { margin-bottom: 10px; }
.source-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.layer-row { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 2px 0 2px 10px; cursor: pointer; }
.page-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 8px; border-radius: 6px; font-size: 13px; cursor: pointer;
}
.page-row.selected { background: #1d4ed8; }
.page-row .page-name { flex: 1; }
.page-del { border: none; background: none; color: #94a3b8; cursor: pointer; font-size: 14px; }
.page-del:disabled { opacity: 0.3; cursor: default; }
#btn-add-page {
  margin-top: 6px; width: 100%; padding: 5px; border: 1px dashed #334155;
  background: none; color: #94a3b8; border-radius: 6px; cursor: pointer;
}
#btn-add-page:hover { border-color: #64748b; color: #e5e7eb; }
```

(기존 `#map { flex: 1; … }` 규칙은 `#workspace` 안에서도 그대로 동작 — 수정 불필요.)

- [ ] **Step 3: `src/core/GeoTiffLoader.js` 전체를 아래로 교체** (파싱 전용 — 지도 반영 제거)

```js
// © 2026 김용현
// eStoryMap/src/core/GeoTiffLoader.js
// 생 GeoTIFF(ArrayBuffer) → .egis 형식 문서 (경로②의 파싱 접착부).
// 지도 반영은 하지 않는다 — 소스 추가 플로우(main.js → SourceRegistry)가 담당.
import * as GeoTIFF from 'geotiff';
import { demDataFromGeoTiff, demDataToEgisDoc } from './geotiffParse.js';

/**
 * @param {ArrayBuffer} arrayBuffer - .tif 파일 내용
 * @param {string} filename - 원본 파일명(레이어/소스 이름으로 사용)
 * @returns {Promise<object>} .egis 형식 문서 (parseEgisDoc에 그대로 넣을 수 있음)
 */
export async function parseGeoTiff(arrayBuffer, filename) {
  const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const demData = await demDataFromGeoTiff(image);
  const name = filename.replace(/\.(tif|tiff|geotiff|img)$/i, '');
  return demDataToEgisDoc(demData, name);
}
```

- [ ] **Step 4: `src/main.js` 전체를 아래로 교체**

```js
// © 2026 김용현
// eStoryMap/src/main.js
import 'ol/ol.css';
import { MapView } from './core/MapView.js';
import { parseEgisDoc } from './core/egisParse.js';
import { SourceRegistry } from './core/SourceRegistry.js';
import { applyPageVisibility } from './core/StoryMapRenderer.js';
import {
  createStoryDoc, addSource, addPage, removePage, getPage, setLayerVisible, nextSourceId,
} from './core/StoryDoc.js';
import { parseGeoTiff } from './core/GeoTiffLoader.js';
import { createSourcePanel } from './editor/SourcePanel.js';
import { createPageList } from './editor/PageList.js';

const mapView = new MapView('map');
const status = document.getElementById('status');
const registry = new SourceRegistry(mapView);
const doc = createStoryDoc();
let currentPageId = doc.pages[0].id;

const sourcePanel = createSourcePanel(document.getElementById('source-panel'), {
  onToggleLayer(sourceId, layerId, visible) {
    setLayerVisible(doc, currentPageId, sourceId, layerId, visible);
    refresh();
  },
});

const pageList = createPageList(document.getElementById('page-list'), {
  onSelect(pageId) {
    currentPageId = pageId;
    refresh();
  },
  onAdd() {
    const page = addPage(doc, currentPageId); // 직전(현재) 페이지 복제
    currentPageId = page.id;
    refresh();
  },
  onRemove(pageId) {
    const removed = removePage(doc, pageId);
    if (removed && currentPageId === pageId) currentPageId = doc.pages[0].id;
    refresh();
  },
});

/** 문서·페이지 상태를 지도와 패널에 반영(단일 갱신 지점). */
function refresh() {
  const page = getPage(doc, currentPageId);
  applyPageVisibility(page, registry);
  sourcePanel.render(doc, page, registry);
  pageList.render(doc, currentPageId);
}

/** .egis 형식 문서를 소스로 추가(공통 플로우 — .tif도 래핑 후 여기로). */
function addSourceFromEgis(filename, rawJson) {
  const parsed = parseEgisDoc(rawJson);
  const sourceId = nextSourceId(doc);
  const { builtLayerIds, skipped, olLayers } = registry.addSource(sourceId, parsed);
  addSource(doc, { sourceId, filename, egis: rawJson }, builtLayerIds, currentPageId);
  // 카메라: .egis 저장 뷰 우선, 없으면 새 레이어 범위로. (페이지 카메라는 M4)
  if (parsed.view) mapView.setView(parsed.view.center, parsed.view.zoom);
  else if (olLayers.length) mapView.fitToLayers(olLayers);
  refresh();
  const skippedNote = skipped ? ` (복원 불가 ${skipped}개 건너뜀)` : '';
  status.textContent = `${filename} — 레이어 ${builtLayerIds.length}개 추가${skippedNote}`;
}

document.getElementById('btn-import').addEventListener('click', async () => {
  try {
    const picked = await window.egisFS.importEgis();
    if (!picked) return;
    addSourceFromEgis(picked.filename, JSON.parse(picked.text));
  } catch (e) {
    status.textContent = `불러오기 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-tif').addEventListener('click', async () => {
  try {
    const picked = await window.egisFS.importTif();
    if (!picked) return;
    status.textContent = `${picked.filename} 파싱 중…`;
    const egisLike = await parseGeoTiff(picked.data, picked.filename);
    addSourceFromEgis(picked.filename, egisLike);
  } catch (e) {
    status.textContent = `GeoTIFF 로드 실패: ${e.message}`;
    console.error(e);
  }
});

document.getElementById('btn-folder').addEventListener('click', () => {
  window.egisFS.openFolder();
});

refresh();
```

- [ ] **Step 5: 레거시 삭제**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && rm src/core/EgisLoader.js src/core/EgisLoader.test.js
```

`grep -rn "EgisLoader\|loadEgisIntoMap\|loadGeoTiffIntoMap" src/` 로 잔여 참조가 없는지 확인(있으면 안 됨).

- [ ] **Step 6: 전체 테스트 + 빌드 확인**

Run: `cd "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap" && npm test`
Expected: PASS (**109 tests**, 10 files — EgisLoader 11개 제거, 신규 41개).

Run: `npx vite build 2>&1 | tail -3` — Expected: 에러 없이 완료.

- [ ] **Step 7: 수동 스모크 (M3 완료 판정 — 사용자 육안 확인)**

Run: `npm run dev`
Expected:
1. 좌측 사이드바(소스/페이지 패널)와 지도가 보인다. 페이지 패널에 "페이지 1".
2. `.egis 열기` → `fixtures/sample.egis`: 소스 트리에 파일명+레이어 2개(체크됨), 지도에 벡터 표시. 상태줄 "레이어 2개 추가".
3. `.egis 열기` → `fixtures/sample_dem.egis`: **기존 소스가 유지된 채** 두 번째 소스 추가(레이어 2개, 스킵 1 문구). 지도에 벡터+래스터 동시 표시.
4. 체크박스 해제 → 해당 레이어 즉시 사라짐. 다시 체크 → 나타남.
5. `+ 페이지` → "페이지 2" 생성·선택(체크 상태 복제됨). 페이지 2에서 래스터만 남기고 해제 → 페이지 1 클릭 → 모든 레이어 복귀 → 페이지 2 클릭 → 래스터만. **전환이 즉시(재파싱 없음).**
6. `.tif 열기` → 실제 DEM: 세 번째 소스로 추가(현재 페이지에만 체크됨), 다른 페이지에서는 숨김.
7. × 로 페이지 삭제(1개 남으면 버튼 비활성).

- [ ] **Step 8: 커밋**

```bash
cd "C:/Users/김용현/Desktop/vibecoding/eGIS" && git add -A eStoryMap/index.html eStoryMap/src/style.css eStoryMap/src/main.js eStoryMap/src/core/GeoTiffLoader.js eStoryMap/src/core/EgisLoader.js eStoryMap/src/core/EgisLoader.test.js && git commit -m "feat(eStoryMap): M3 에디터 배선 — 소스 추가 플로우+사이드바, 전체 교체 로더 폐기

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. 스펙 커버리지 (M3 범위):**
- §7 M3 "StoryDoc" → Task 1–3 (모델 §2 그대로: meta/sources/pages, overrides·content 자리). ✓
- §7 M3 "PageList" → Task 8 + §4 "페이지 추가 시 직전 페이지 레이어/카메라 복제" → Task 3 addPage. ✓
- §7 M3 "SourcePanel 체크박스 연동" → Task 7 + §4 "체크박스 = 현재 페이지의 layerVisibility 편집, 페이지 바꾸면 체크 갱신" → Task 7 테스트 5 + main.js refresh. ✓
- §7 M3 "페이지 전환 시 visible 토글" → Task 6 applyPageVisibility + §3 "재파싱 없음, setVisible만". ✓
- M1 연기분 "SourceRegistry({sourceId,layerId}→olLayer, 전부 add하되 visible=false)" → Task 5. ✓
- §1 "여러 소스 동시 로드"(e-GIS 대비 결정적 차이) → Task 9 시맨틱 전환. ✓
- §1b "세 경로 모두 SourceRegistry에 동일 등록" → Task 4 demDataToEgisDoc + Task 9 parseGeoTiff(경로 C). 경로 B(클라우드)는 M7. ✓
- e-GIS 스킵·격리 정책 유지 → Task 5로 이관(테스트 포함). ✓

**2. 플레이스홀더 스캔:** "TODO/적절히/나중에" 없음 — 모든 단계에 실제 코드. ✓

**3. 타입/이름 일관성:** `createStoryDoc/getPage/nextSourceId/addSource(doc, source, layerIds, pageId)/setLayerVisible(doc, pageId, sourceId, layerId, visible)/addPage(doc, copyFromPageId)/removePage`(StoryDoc) · `new SourceRegistry(mapView)` / `addSource(sourceId, parsedDoc)→{builtLayerIds, skipped, olLayers}` / `getLayer/entriesList→[{sourceId,layerId,layer}]`(SourceRegistry) · `applyPageVisibility(page, registry)`(Renderer) · `createSourcePanel(container,{onToggleLayer}).render(doc, page, registry)` · `createPageList(container,{onSelect,onAdd,onRemove}).render(doc, selectedPageId)` · `parseGeoTiff(arrayBuffer, filename)` / `demDataToEgisDoc(demData, name)` — Task 9 main.js가 전부 동일 시그니처로 호출. ✓

**미해결(구현 중 실측):**
- jsdom에서 `label.appendChild(checkbox)` + `dispatchEvent(new Event('change'))`가 리스너를 정상 호출하는지 → Task 7 첫 실행에서 확인(jsdom 표준 동작이라 통과 기대).
- 사이드바 추가 후 지도 크기: OL은 컨테이너 크기 변화를 ResizeObserver로 감지하므로 `updateSize` 수동 호출 불필요 기대 — 스모크에서 지도 우측 렌더 확인.
- 같은 파일을 두 번 열면 소스가 중복 추가된다(의도된 M3 동작 — 소스 삭제/중복 방지는 백로그).
