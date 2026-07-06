// © 2026 김용현
// eStoryMap/src/shared/markdown.js
// 본문 마크다운 → 살균된 HTML(상위 스펙 §0: marked 렌더 + DOMPurify 살균).
// 에디터 미리보기(M5)와 뷰어(M9 프레젠테이션 / M10 보고서)가 공유한다.
// 미디어 임베드: 본문에 붙인 YouTube/Google Drive 링크를 비디오·이미지로(mediaEmbed.js).
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { embedMediaLinks } from './mediaEmbed.js';

// 허용 iframe = YouTube 임베드(youtube-nocookie)만. 끝을 [/?#]|$로 고정해 경로 애매성 제거(보안리뷰 #2).
const YT_EMBED_RE = /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}(?:[/?#]|$)/;
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups';

// iframe은 YouTube만 허용 — 그 외 iframe은 제거(임의 프레임 주입 차단). 유지되는 iframe엔 sandbox 강제
// (원문에 직접 넣은 iframe도 안전하게, 보안리뷰 #3). 모듈 로드 시 1회 등록되는 전역 훅.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'iframe') return;
  const src = (node.getAttribute && node.getAttribute('src')) || '';
  if (!YT_EMBED_RE.test(src)) {
    if (node.parentNode) node.parentNode.removeChild(node);
    return;
  }
  if (node.setAttribute) node.setAttribute('sandbox', IFRAME_SANDBOX);
});

const SANITIZE_OPTS = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: [
    'allow', 'allowfullscreen', 'frameborder', 'scrolling',
    'referrerpolicy', 'sandbox', 'loading', 'title',
  ],
};

/**
 * 마크다운 → 안전한 HTML 문자열. 빈 입력은 빈 문자열.
 * @param {string} text
 * @param {{staticMedia?:boolean}} [opts] - staticMedia=true면 YouTube를 iframe 대신 썸네일+링크로
 *   (보고서/PDF는 iframe이 안 찍히므로).
 */
export function renderMarkdown(text, opts) {
  if (!text) return '';
  const withMedia = embedMediaLinks(text, opts); // YouTube/Drive 링크 → 임베드
  const html = marked.parse(withMedia, { breaks: true }); // Enter 한 번 = 줄바꿈(슬라이드 본문 친화)
  return DOMPurify.sanitize(html, SANITIZE_OPTS);
}
