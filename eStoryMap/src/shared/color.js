// © 2026 김용현
// eStoryMap/src/shared/color.js
// 색상 유틸 — 순수. 슬라이드 배경색 검증 + 대비 글자색 계산.
export const DEFAULT_SLIDE_BG = '#0b0f14';

/** #rrggbb 형식 유효성. */
export function isHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

/**
 * 배경 hex에 대비되는 글자색(밝은 배경→어두운 글자, 어두운 배경→밝은 글자).
 * WCAG 상대 휘도 기준. 잘못된 입력이면 밝은 글자.
 */
export function contrastText(hex) {
  if (!isHexColor(hex)) return '#f8fafc';
  const chan = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * chan(1) + 0.7152 * chan(3) + 0.0722 * chan(5);
  return L > 0.4 ? '#111111' : '#f8fafc';
}

/** #rrggbb → "r, g, b" (반투명 오버레이 rgba()용 컴포넌트 문자열). */
export function hexToRgb(hex) {
  const h = isHexColor(hex) ? hex : DEFAULT_SLIDE_BG;
  return `${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}`;
}

/** 요소에 슬라이드 배경/글자색 CSS 변수를 세팅(발표 스테이지·편집기 슬라이드 캔버스 공용).
 *  --slide-bg(배경) / --slide-bg-rgb(밴드·패널·카드 반투명용) / --slide-fg(대비 글자색). */
export function applySlideColors(el, bg) {
  const color = isHexColor(bg) ? bg : DEFAULT_SLIDE_BG;
  el.style.setProperty('--slide-bg', color);
  el.style.setProperty('--slide-bg-rgb', hexToRgb(color));
  el.style.setProperty('--slide-fg', contrastText(color));
}
