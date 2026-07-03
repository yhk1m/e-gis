// © 2026 김용현
// eStoryMap/src/editor/ContentEditor.js
// 우측 CONTENT 패널: 현재 페이지의 heading/body(마크다운)/caption 편집(상위 스펙 §4).
// 필드는 팩토리에서 1회 생성 — 입력 중 재렌더가 없어야 포커스가 유지된다.
// 타이핑은 onChange로 문서에만 반영하고(전체 refresh 금지), 미리보기는 자체 갱신.
// MVP는 순수 마크다운 입력(서식 툴바는 v2 — 스펙 §0).
import { renderMarkdown } from '../shared/markdown.js';

/**
 * @param {HTMLElement} container
 * @param {{onChange(field:'heading'|'body'|'caption', value:string):void}} handlers
 */
export function createContentEditor(container, { onChange }) {
  container.innerHTML = '';

  const heading = document.createElement('input');
  heading.type = 'text';
  heading.id = 'content-heading';
  heading.placeholder = '페이지 제목';

  const body = document.createElement('textarea');
  body.id = 'content-body';
  body.placeholder = '본문 (마크다운: # 제목, **굵게**, - 목록)';
  body.rows = 10;

  const preview = document.createElement('div');
  preview.id = 'content-preview';
  preview.className = 'md-preview';

  const caption = document.createElement('input');
  caption.type = 'text';
  caption.id = 'content-caption';
  caption.placeholder = '지도 하단 캡션';

  heading.addEventListener('input', () => onChange('heading', heading.value));
  body.addEventListener('input', () => {
    preview.innerHTML = renderMarkdown(body.value); // 살균된 HTML만 삽입
    onChange('body', body.value);
  });
  caption.addEventListener('input', () => onChange('caption', caption.value));

  for (const [label, el] of [['제목', heading], ['본문', body], ['미리보기', preview], ['캡션', caption]]) {
    const wrap = document.createElement('div');
    wrap.className = 'content-field';
    const lab = document.createElement('div');
    lab.className = 'content-label';
    lab.textContent = label;
    wrap.appendChild(lab);
    wrap.appendChild(el);
    container.appendChild(wrap);
  }

  /** 페이지 전환 시 현재 페이지 콘텐츠로 필드를 채운다. */
  function render(page) {
    heading.value = page.content.heading;
    body.value = page.content.body;
    caption.value = page.content.caption;
    preview.innerHTML = renderMarkdown(page.content.body);
  }

  return { render };
}
