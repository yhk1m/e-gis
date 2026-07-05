// © 2026 김용현
// eStoryMap/src/viewer/reportModel.js
// 보고서 섹션 도출 — 순수. 문서 + 페이지별 지도 이미지 → 섹션 배열. OL·DOM 의존 없음(테스트 대상).
// 렌더·캡처는 ReportShell.js / mapCapture.js.
import { renderMarkdown } from '../shared/markdown.js';
import { buildLegendItems } from '../core/legend.js';

/**
 * 보고서 섹션 배열(페이지 순서). 발표 셸과 같은 pages 데이터, 레이아웃만 다름(마스터 §5).
 * @param {object} doc - StoryDoc
 * @param {Record<string,string>} [imagesByPageId] - pageId → 지도 이미지 dataURL
 * @returns {{id:string, heading:string, image:(string|null), legend:object[], bodyHtml:string, caption:string}[]}
 */
export function buildReportSections(doc, imagesByPageId = {}) {
  const legendOn = doc.meta.legend ? doc.meta.legend.visible : true; // 없으면 기본 표시
  return doc.pages.map((page) => ({
    id: page.id,
    heading: page.content.heading,
    image: imagesByPageId[page.id] || null,
    legend: legendOn ? buildLegendItems(doc, page).filter((i) => !i.hidden) : [],
    bodyHtml: renderMarkdown(page.content.body),
    caption: page.content.caption,
  }));
}
