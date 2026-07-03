// © 2026 김용현
// eStoryMap/src/shared/markdown.js
// 본문 마크다운 → 살균된 HTML(상위 스펙 §0: marked 렌더 + DOMPurify 살균).
// 에디터 미리보기(M5)와 뷰어(M9 프레젠테이션 / M10 보고서)가 공유한다.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** 마크다운 → 안전한 HTML 문자열. 빈 입력은 빈 문자열. */
export function renderMarkdown(text) {
  if (!text) return '';
  const html = marked.parse(text);
  return DOMPurify.sanitize(html);
}
