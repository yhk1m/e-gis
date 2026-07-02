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
