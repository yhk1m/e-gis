// © 2026 김용현
// eStoryMap/src/editor/ContentEditor.js
// 우측 CONTENT 패널: 현재 페이지의 종류(지도/제목/미디어) + heading/body/caption 편집.
// 필드는 팩토리에서 1회 생성 — 입력 중 재렌더가 없어야 포커스가 유지된다.
// 타이핑은 onChange로 문서에만 반영(전체 refresh 금지). 종류 변경은 refresh 필요(발표/목록 반영)라 상위에서 처리.
import { renderMarkdown } from '../shared/markdown.js';

const KIND_OPTIONS = [
  ['map', '지도'],
  ['title', '제목(표지)'],
  ['media', '사진/영상'],
];
// 종류별 heading/body 라벨·힌트
const KIND_HINTS = {
  map: { heading: '제목', body: '본문', bodyPh: '본문 (마크다운: # 제목, **굵게**, - 목록)' },
  title: { heading: '큰 제목', body: '부제', bodyPh: '부제 · 설명 (선택)' },
  media: { heading: '제목 (선택)', body: '사진/영상', bodyPh: '이미지·YouTube·구글드라이브 링크를 한 줄에 붙여넣기' },
};

/**
 * @param {HTMLElement} container
 * @param {{onChange(field:'kind'|'heading'|'body'|'caption', value:string):void}} handlers
 */
export function createContentEditor(container, { onChange, onApplyBgAll }) {
  container.innerHTML = '';

  const kind = document.createElement('select');
  kind.id = 'content-kind';
  for (const [val, label] of KIND_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    kind.appendChild(opt);
  }

  const heading = document.createElement('input');
  heading.type = 'text';
  heading.id = 'content-heading';
  heading.placeholder = '페이지 제목';

  const body = document.createElement('textarea');
  body.id = 'content-body';
  body.rows = 10;

  const preview = document.createElement('div');
  preview.id = 'content-preview';
  preview.className = 'md-preview';

  const caption = document.createElement('input');
  caption.type = 'text';
  caption.id = 'content-caption';
  caption.placeholder = '지도 하단 캡션';

  const headingLabel = document.createElement('div'); // 종류별로 텍스트 갱신
  const bodyLabel = document.createElement('div');

  function applyKind(k) {
    const hint = KIND_HINTS[k] || KIND_HINTS.map;
    headingLabel.textContent = hint.heading;
    bodyLabel.textContent = hint.body;
    body.placeholder = hint.bodyPh;
  }

  kind.addEventListener('change', () => {
    applyKind(kind.value);
    onChange('kind', kind.value); // 상위가 setPageKind + refresh
  });
  heading.addEventListener('input', () => onChange('heading', heading.value));
  body.addEventListener('input', () => {
    preview.innerHTML = renderMarkdown(body.value); // 살균된 HTML만 삽입
    onChange('body', body.value);
  });
  caption.addEventListener('input', () => onChange('caption', caption.value));

  // 페이지별 배경색(색상 선택 = override / '프로젝트 기본' = override 제거)
  const bg = document.createElement('input');
  bg.type = 'color';
  bg.id = 'content-bg';
  const bgReset = document.createElement('button');
  bgReset.type = 'button';
  bgReset.id = 'content-bg-reset';
  bgReset.textContent = '프로젝트 기본';
  bg.addEventListener('input', () => onChange('bg', bg.value));
  bgReset.addEventListener('click', () => onChange('bg', ''));
  const bgAll = document.createElement('button');
  bgAll.type = 'button';
  bgAll.id = 'content-bg-all';
  bgAll.textContent = '모두 적용';
  bgAll.title = '이 배경색을 모든 슬라이드에 적용';
  bgAll.addEventListener('click', () => onApplyBgAll(bg.value));
  const bgRow = document.createElement('div');
  bgRow.className = 'content-bg-row';
  bgRow.append(bg, bgReset, bgAll);

  function field(label, el) {
    const wrap = document.createElement('div');
    wrap.className = 'content-field';
    const lab = typeof label === 'string' ? document.createElement('div') : label;
    lab.className = 'content-label';
    if (typeof label === 'string') lab.textContent = label;
    wrap.appendChild(lab);
    wrap.appendChild(el);
    container.appendChild(wrap);
  }

  field('슬라이드 종류', kind);
  field('슬라이드 배경', bgRow);
  field(headingLabel, heading);
  field(bodyLabel, body);
  field('미리보기', preview);
  field('캡션', caption);

  /** 페이지 전환 시 현재 페이지 값으로 필드를 채운다. */
  function render(page, effectiveBg) {
    const k = page.kind || 'map';
    kind.value = k;
    applyKind(k);
    bg.value = effectiveBg || '#0b0f14'; // 페이지 override 있으면 그 색, 없으면 프로젝트 기본
    heading.value = page.content.heading;
    body.value = page.content.body;
    caption.value = page.content.caption;
    preview.innerHTML = renderMarkdown(page.content.body);
  }

  return { render };
}
