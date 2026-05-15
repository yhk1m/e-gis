// © 2026 김용현
/**
 * 지도 위 DOM 요소(범례, 축척바 등)를 드래그로 이동 가능하게 만든다.
 * - 클릭한 위치 기준으로 left/top을 절대 좌표로 전환
 * - 지정한 컨테이너 영역 내로 제약
 */
export function makeDraggable(el, boundsElGetter) {
  if (!el || el._dragAttached) return;
  el._dragAttached = true;
  el.classList.add('map-draggable');
  el.style.userSelect = 'none';
  el.style.touchAction = 'none';
  el.style.pointerEvents = 'auto';
  el.title = '드래그해 위치 옮기기';

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'a') return;
    if (e.target.isContentEditable) return;

    const boundsEl = typeof boundsElGetter === 'function' ? boundsElGetter() : boundsElGetter;
    if (!boundsEl) return;

    e.preventDefault();
    e.stopPropagation();

    const bounds = boundsEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = r.left - bounds.left;
    const initY = r.top - bounds.top;

    el.style.bottom = 'auto';
    el.style.right = 'auto';
    el.style.left = initX + 'px';
    el.style.top = initY + 'px';
    el.classList.add('map-dragging');

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newX = Math.max(0, Math.min(bounds.width - r.width, initX + dx));
      const newY = Math.max(0, Math.min(bounds.height - r.height, initY + dy));
      el.style.left = newX + 'px';
      el.style.top = newY + 'px';
    };
    const onUp = () => {
      el.classList.remove('map-dragging');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  el.addEventListener('pointerdown', onDown);
}
