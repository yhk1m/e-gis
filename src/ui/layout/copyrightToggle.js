// © 2026 김용현
/**
 * 툴바 카피라이트 — 태블릿에서는 글자를 숨기고 ⓒ 버튼을 누르면 말풍선으로 보인다.
 * 보이고 숨기는 것은 CSS(태블릿 미디어)가 정하고, 여기서는 .is-open 과 aria-expanded 만 바꾼다.
 * 바깥을 누르거나 Esc 를 누르면 닫힌다.
 */
export function initCopyrightToggle(root = document) {
  const btn = root.getElementById ? root.getElementById('toolbar-copyright-btn') : root.querySelector('#toolbar-copyright-btn');
  const wrap = btn?.closest('.toolbar-copyright-wrap');
  if (!btn || !wrap) return null;

  const setOpen = (open) => {
    wrap.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  const isOpen = () => wrap.classList.contains('is-open');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !wrap.contains(e.target)) setOpen(false);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });

  return { setOpen, isOpen };
}
