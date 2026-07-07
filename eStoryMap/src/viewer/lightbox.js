// © 2026 김용현
// eStoryMap/src/viewer/lightbox.js
// 이미지 라이트박스 — 클릭하면 전체화면으로 확대. 클릭/Esc로 닫기.
// 발표는 전체화면 요소 안에서 열려야 보이므로 parent를 넘길 수 있게 함(기본 body).

/**
 * @param {string} src - 확대할 이미지 URL
 * @param {HTMLElement} [parent] - 라이트박스를 붙일 컨테이너(발표=전체화면 요소, 기본 body)
 */
export function openLightbox(src, parent = document.body) {
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  overlay.appendChild(img);
  (parent || document.body).appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }
  overlay.addEventListener('click', close); // 아무 데나 클릭하면 닫힘
  document.addEventListener('keydown', onKey, true);
}
