// © 2026 김용현
// eStoryMap/src/shared/slideFont.js
// 슬라이드 글꼴 스택 — --slide-font 변수로 슬라이드/발표/보고서/웹뷰어에 일괄 적용.
// (main.js에서 이동 — 웹뷰어와 공유)
export const SLIDE_FONT_STACKS = {
  default: 'system-ui, "Segoe UI", "Malgun Gothic", sans-serif',
  sans: "'Noto Sans KR', system-ui, sans-serif",
  serif: "'Noto Serif KR', serif",
};

export function applySlideFont(font, custom) {
  const stack = font === 'system' && custom
    ? `"${custom}", system-ui, "Segoe UI", sans-serif` // custom은 setSlideFontCustom에서 이미 살균됨
    : SLIDE_FONT_STACKS[font] || SLIDE_FONT_STACKS.default;
  document.documentElement.style.setProperty('--slide-font', stack);
}
