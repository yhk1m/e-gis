// © 2026 김용현
// eStoryMap/src/core/StoryDoc.js
// StoryMapDoc(상위 스펙 §2) 생성·변이 — 순수 모듈. OL·DOM 의존 없음.
// 문서가 단일 진실원이며, 변이 함수는 전달받은 doc을 직접 수정한다.
// 선택된 페이지(currentPageId)는 에디터 UI 상태로, 문서에 저장하지 않는다.
import { clampLegendPos, DEFAULT_LEGEND } from './legend.js';

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
      id: crypto.randomUUID(), // 마스터 스펙 §2 "uuid"
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

/** 클라우드 동기화 토글(M8). 문서에 저장돼 .esm/클라우드 왕복 시 유지된다.
 *  구버전 .esm에는 필드가 없음 = false 취급(읽는 쪽 계약). */
export function setCloudSync(doc, on) {
  doc.meta.cloudSync = !!on;
  touch(doc);
}

export const PRESENTATION_LAYOUTS = ['band', 'panel', 'card'];

/** 발표 텍스트 레이아웃(프로젝트 전체, M9 확장). 허용 enum만 반영.
 *  구버전/미설정 = 읽는 쪽에서 'band' 기본(계약). */
export function setPresentationLayout(doc, layout) {
  if (!PRESENTATION_LAYOUTS.includes(layout)) return;
  doc.meta.presentationLayout = layout;
  touch(doc);
}

/** meta.legend를 기본값으로 보장(구버전 .esm에 없을 수 있음). */
function ensureLegend(doc) {
  if (!doc.meta.legend) {
    doc.meta.legend = {
      visible: DEFAULT_LEGEND.visible,
      pos: { ...DEFAULT_LEGEND.pos },
      overrides: {},
    };
  }
  return doc.meta.legend;
}

/** 범례 전체 표시/숨김(헤더 토글, 프로젝트 전체). */
export function setLegendVisible(doc, on) {
  ensureLegend(doc).visible = !!on;
  touch(doc);
}

/** 범례 위치(정규화 좌상단, 드래그). [0,1] 클램프. */
export function setLegendPos(doc, x, y) {
  ensureLegend(doc).pos = clampLegendPos(x, y);
  touch(doc);
}

/** 레이어 key별 범례 override 병합(label 문자열/hidden 불리언만). 빈 key·patch는 no-op. */
export function setLegendOverride(doc, key, patch) {
  if (!key || !patch) return;
  const legend = ensureLegend(doc);
  const next = { ...(legend.overrides[key] || {}) };
  if (typeof patch.label === 'string') next.label = patch.label;
  if (typeof patch.hidden === 'boolean') next.hidden = patch.hidden;
  legend.overrides[key] = next;
  touch(doc);
}

/**
 * 소스를 추가하고, 지정 페이지에만 visible:true 가시성 엔트리를 만든다.
 * (다른 페이지는 미등재 = 숨김. 상위 스펙 §2 가시성 계약)
 * @param {object} doc
 * @param {{sourceId:string, filename:string, egis:object}} source - egis는 원본 JSON 통째
 * @param {string[]} layerIds - SourceRegistry가 실제로 빌드한 레이어 id들
 * @param {string} pageId - 현재 페이지
 * 주의: sourceId는 기존 layerVisibility 엔트리가 없는 새 id여야 한다
 * (중복 push 미방지 — nextSourceId로 발급된 id만 사용할 것).
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

/**
 * 새 페이지를 끝에 추가. 지정 페이지(보통 현재 페이지)의
 * layerVisibility·camera를 복제한다(연속 편집 편의 — 상위 스펙 §4).
 */
export function addPage(doc, copyFromPageId) {
  const from = getPage(doc, copyFromPageId);
  const id = nextPageId(doc);
  // 제목 번호는 id의 순번과 동기화(길이 기반이면 삭제 후 중복 제목 발생)
  const page = makePage(id, `페이지 ${id.split('_')[1]}`);
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

/**
 * 페이지 카메라 저장("이 위치로 캡처"). camera는 {center:[경도,위도](EPSG:4326), zoom}
 * — .egis view와 동일 포맷(스펙 §2). 외부 변이와 격리되도록 복사해 저장한다.
 */
export function setPageCamera(doc, pageId, camera) {
  const page = getPage(doc, pageId);
  if (!page || !camera) return;
  page.camera = { center: [...camera.center], zoom: camera.zoom };
  touch(doc);
}

/**
 * 현재 카메라를 모든 페이지에 1회 복사("모든 슬라이드에 이 위치", M9 확장).
 * 각 페이지가 서로·원본과 참조 독립이도록 깊은 복사. camera 없으면 no-op.
 */
export function applyCameraToAllPages(doc, camera) {
  if (!camera || !Array.isArray(camera.center)) return;
  for (const page of doc.pages) {
    page.camera = { center: [...camera.center], zoom: camera.zoom };
  }
  touch(doc);
}

/**
 * 소스 페이지의 카메라를 대상 페이지로 복사("위치 가져오기", M9 확장).
 * 페이지 누락 또는 소스 camera 없음이면 no-op. 참조 독립되게 깊은 복사.
 */
export function syncCameraFromPage(doc, targetPageId, sourcePageId) {
  const target = getPage(doc, targetPageId);
  const source = getPage(doc, sourcePageId);
  if (!target || !source || !source.camera) return;
  target.camera = { center: [...source.camera.center], zoom: source.camera.zoom };
  touch(doc);
}

const CONTENT_FIELDS = ['heading', 'body', 'caption'];

/**
 * 페이지 콘텐츠 부분 패치(M5). 허용 필드(heading/body/caption)의 문자열 값만
 * 반영하고 그 외는 무시한다(.esm에 임의 키가 스며드는 것 방지).
 */
export function setPageContent(doc, pageId, patch) {
  const page = getPage(doc, pageId);
  if (!page || !patch) return;
  for (const field of CONTENT_FIELDS) {
    if (typeof patch[field] === 'string') page.content[field] = patch[field];
  }
  touch(doc);
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
