// © 2026 김용현
/**
 * 실험 class-fill 의 켜고 끄기 — 가드는 여기 한 곳.
 *
 * - #map 에 labs-class-fill 클래스 (CSS 가 범례 색 칸에 손 모양·호버 테두리를 준다)
 * - choroplethTool.onLegendColorClick 훅에 팝오버 열기를 심는다. 클릭 시점에 isOn 을 보므로
 *   범례를 다시 만들 필요 없이 켜고 끄는 즉시 반영된다.
 * - 범례는 끌 수 있다(makeDraggable). 색 칸에서 시작한 끌기도 놓는 순간 click 이 되므로
 *   #map 의 캡처 단계 pointerdown·pointerup 으로 이동 거리를 재어, 문턱을 넘긴 뒤의 훅 호출은
 *   무시한다. (makeDraggable 은 버블 단계에서 stopPropagation 하므로 캡처로만 들린다.
 *   ChoroplethTool 은 훅에 event 를 넘기지 않아 여기서 직접 잰다.)
 * 승격 = 아래 isOn 검사와 registry 항목 삭제.
 */

export const CLASS_FILL_ID = 'class-fill';
export const MAP_CLASS = 'labs-class-fill';
/** 이보다 멀리 움직이면 클릭이 아니라 끌기 (px) */
export const DRAG_THRESHOLD_PX = 3;
const LEGEND_ITEMS_SELECTOR = '.choropleth-legend-items';

/**
 * 범례 색 칸에서 시작한 포인터의 이동 거리를 잰다.
 * @returns {{dragged: () => boolean, off: () => void}}
 */
function trackLegendDrag(mapEl) {
  if (!mapEl || typeof mapEl.addEventListener !== 'function') {
    return { dragged: () => false, off: () => {} };
  }
  let down = null;
  let dragged = false;

  const onDown = (e) => {
    const t = e.target;
    const inLegend = t && typeof t.closest === 'function' && t.closest(LEGEND_ITEMS_SELECTOR);
    down = inLegend ? { x: e.clientX, y: e.clientY } : null;
    dragged = false;
  };
  const onUp = (e) => {
    if (!down) return;
    dragged = Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD_PX;
    down = null;
  };
  mapEl.addEventListener('pointerdown', onDown, true);
  mapEl.addEventListener('pointerup', onUp, true);

  return {
    /** 한 번 읽으면 잊는다 — 다음 클릭은 새로 판단 */
    dragged: () => { const d = dragged; dragged = false; return d; },
    off: () => {
      mapEl.removeEventListener('pointerdown', onDown, true);
      mapEl.removeEventListener('pointerup', onUp, true);
    }
  };
}

/**
 * @param {import('./labs.js').Labs} labs
 * @param {{mapEl: Element|null, tool: Object, popover: {open: Function, close: Function}}} deps
 * @returns {() => void} 해제 함수
 */
export function bindClassFill(labs, { mapEl, tool, popover }) {
  const apply = (on) => {
    if (mapEl && mapEl.classList) mapEl.classList.toggle(MAP_CLASS, on);
    if (!on && popover) popover.close();
  };
  const drag = trackLegendDrag(mapEl);

  apply(labs.isOn(CLASS_FILL_ID));
  tool.onLegendColorClick = (info) => {
    const wasDrag = drag.dragged();
    if (!labs.isOn(CLASS_FILL_ID) || wasDrag) return;
    popover.open(info);
  };
  const off = labs.onChange((id, on) => {
    if (id === CLASS_FILL_ID) apply(on);
  });

  return () => {
    off();
    drag.off();
    tool.onLegendColorClick = null;
    apply(false);
  };
}
