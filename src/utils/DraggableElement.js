// © 2026 김용현
/**
 * 지도 위 DOM 요소(범례, 축척바 등)를 드래그로 이동 가능하게 만든다.
 * - 클릭한 위치 기준으로 left/top을 절대 좌표로 전환
 * - 지정한 컨테이너 영역 내로 제약
 * - 글래스 실험이 켜져 지도가 창 전체에 깔리면, 그 위에 뜬 메뉴바·툴바(위)·왼쪽 패널(왼쪽)·상태줄(아래)
 *   밑으로는 못 들어가게 glass.js 가 두는 --glass-*-offset 만큼 영역을 줄인다(꺼져 있으면 0)
 */

const GLASS_GAP = 4;

/** 컨테이너 안에서 가려진 가장자리 폭 — 글래스의 부유 막대·패널 */
export function dragInsets(boundsEl) {
  const px = (name) => {
    try {
      const v = parseFloat(getComputedStyle(boundsEl).getPropertyValue(name));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  };
  // 위·아래 오프셋은 막대 가장자리까지라 유리 카드 간격(4px)만큼 더 띄운다. 패널 오프셋엔 이미 들어 있다.
  const gap = (v) => (v > 0 ? v + GLASS_GAP : 0);
  return { left: px('--glass-panel-offset'), top: gap(px('--glass-top-offset')), bottom: gap(px('--glass-bottom-offset')) };
}

/** 가능한 left/top 범위. 영역이 요소보다 좁으면 최소값에 붙인다 */
export function clampRange(boundsW, boundsH, elW, elH, insets) {
  const minX = insets.left;
  const minY = insets.top;
  return {
    minX,
    minY,
    maxX: Math.max(minX, boundsW - elW),
    maxY: Math.max(minY, boundsH - insets.bottom - elH),
  };
}

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
    const range = clampRange(bounds.width, bounds.height, r.width, r.height, dragInsets(boundsEl));

    el.style.bottom = 'auto';
    el.style.right = 'auto';
    el.style.left = initX + 'px';
    el.style.top = initY + 'px';
    el.classList.add('map-dragging');

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newX = Math.max(range.minX, Math.min(range.maxX, initX + dx));
      const newY = Math.max(range.minY, Math.min(range.maxY, initY + dy));
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
