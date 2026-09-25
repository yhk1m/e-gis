// © 2026 김용현
/**
 * 툴바 실험실 버튼 — 켜진 실험 수 배지.
 * 반짝임은 CSS(.btn-labs)가 맡고, 여기서는 숫자만 갱신한다.
 */

const BASE_TITLE = '실험실 — 검증 중인 기능';

export function renderLabsBadge(button, count) {
  if (!button) return;
  const badge = button.querySelector('.labs-badge');
  if (badge) {
    badge.textContent = count > 0 ? String(count) : '';
    badge.hidden = count === 0;
  }
  button.title = count > 0 ? `${BASE_TITLE} (${count}개 켜짐)` : BASE_TITLE;
}

/**
 * @returns {() => void} 해제 함수
 */
export function bindLabsButton(labs, button) {
  if (!button) return () => {};
  renderLabsBadge(button, labs.enabledIds().length);
  return labs.onChange(() => renderLabsBadge(button, labs.enabledIds().length));
}
