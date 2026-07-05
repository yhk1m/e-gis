// © 2026 김용현
// eStoryMap/src/viewer/presentationNav.js
// 발표 셸(M9)의 순수 로직 — 인덱스 네비게이션·인디케이터·오버레이 뷰모델.
// DOM/OL 의존 없음(테스트 대상). DOM 셸·전체화면·재부모는 PresentationShell.js.
import { renderMarkdown } from '../shared/markdown.js';

/**
 * 현재 인덱스에 액션 적용 → 새 인덱스. 범위 [0, count-1]로 클램프, 래핑 없음(스펙 §2.6).
 * @param {number} current
 * @param {number} count - 전체 페이지 수
 * @param {'next'|'prev'|'first'|'last'|string} action
 */
export function navReduce(current, count, action) {
  if (count <= 0) return 0;
  const clamp = (i) => Math.max(0, Math.min(count - 1, i));
  const cur = clamp(current);
  switch (action) {
    case 'next': return clamp(cur + 1);
    case 'prev': return clamp(cur - 1);
    case 'first': return 0;
    case 'last': return count - 1;
    default: return cur;
  }
}

/** 하단 인디케이터 상태 배열(● ● ○). current만 active. */
export function indicatorDots(count, current) {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({ active: i === current }));
}

/**
 * 페이지 content → 오버레이 카드 뷰모델.
 * body는 살균 마크다운(renderMarkdown 재사용), 세 필드가 모두 공백이면 empty(카드 미표시).
 * @param {{heading?:string, body?:string, caption?:string}} [content]
 */
export function buildOverlay(content) {
  const c = content || {};
  const heading = (c.heading || '').trim();
  const caption = (c.caption || '').trim();
  const body = c.body || '';
  const bodyHtml = renderMarkdown(body);
  const empty = !heading && !caption && !body.trim();
  return { heading, bodyHtml, caption, empty };
}
