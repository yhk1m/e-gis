// © 2026 김용현
/**
 * 글래스 UI — documentElement 의 data-surface="glass" 속성 하나.
 *
 * 색·블러는 전부 src/styles/glass.css 가 그 속성을 보고 정한다.
 * 라이트·다크(data-theme)와 직교라 넷 다 조합된다.
 */

export const GLASS_ATTR = 'data-surface';
export const GLASS_ID = 'glass';

export function applyGlass(on, root = document.documentElement) {
  if (on) root.setAttribute(GLASS_ATTR, 'glass');
  else root.removeAttribute(GLASS_ATTR);
}

/**
 * 지금 상태를 적용하고 이후 변경을 따른다.
 * @returns {() => void} 해제 함수
 */
export function bindGlass(labs, root = document.documentElement) {
  applyGlass(labs.isOn(GLASS_ID), root);
  return labs.onChange((id, on) => {
    if (id === GLASS_ID) applyGlass(on, root);
  });
}
