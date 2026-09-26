// © 2026 김용현
/**
 * 실험 기능의 메뉴 항목 — `data-lab="<id>"` 가 붙은 요소를 labs 상태로 숨기고 보인다.
 * 승격할 때는 마크업에서 data-lab 과 hidden 만 지우면 된다.
 */

/**
 * @param {import('./labs.js').Labs} labs
 * @param {ArrayLike<{dataset: {lab: string}, hidden: boolean}>} items 기본은 document 의 [data-lab] 전부
 * @returns {() => void} 해제 함수
 */
export function bindLabMenuItems(labs, items = document.querySelectorAll('[data-lab]')) {
  const list = Array.from(items);
  const apply = () => list.forEach((el) => { el.hidden = !labs.isOn(el.dataset.lab); });
  apply();
  return labs.onChange(apply);
}
