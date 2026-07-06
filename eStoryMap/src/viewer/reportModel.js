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
  return doc.pages.map((page) => {
    const kind = page.kind || 'map'; // 구버전/미설정 = 지도
    const isMap = kind === 'map';
    return {
      id: page.id,
      kind, // 'map' | 'title'(표지) | 'media'(지도 없는 사진/영상)
      heading: page.content.heading,
      image: isMap ? imagesByPageId[page.id] || null : null, // 지도 슬라이드만 캡처 이미지
      legend: isMap && legendOn ? buildLegendItems(doc, page).filter((i) => !i.hidden) : [],
      bodyHtml: renderMarkdown(page.content.body, { staticMedia: true }), // 보고서: YouTube=썸네일+링크
      caption: page.content.caption,
    };
  });
}
