// © 2026 김용현
/**
 * 글래스 UI — documentElement 의 data-surface="glass" 속성 하나.
 *
 * 색·블러는 전부 src/styles/glass.css 가 그 속성을 보고 정한다.
 * 라이트·다크(data-theme)와 직교라 넷 다 조합된다.
 *
 * 데스크톱에서는 glass.css 가 지도를 왼쪽 패널 아래까지 깔아 유리 너머로 지도가 비친다.
 * 그때 왼쪽에 붙는 부유 요소(범례·피처 카드·사이드바 토글·축척)가 패널에 가리지 않도록
 * #map-container 의 --glass-panel-offset 을 패널 너비에 맞춰 두는 것이 JS 의 몫이다.
 */

export const GLASS_ATTR = 'data-surface';
export const GLASS_ID = 'glass';
export const PANEL_OFFSET_PROP = '--glass-panel-offset';

export function applyGlass(on, root = document.documentElement) {
  if (on) root.setAttribute(GLASS_ATTR, 'glass');
  else root.removeAttribute(GLASS_ATTR);
}

/** 패널 오프셋(px): 숨김(또는 너비 0)이면 0, 아니면 패널 너비 + 리사이저 너비 */
export function panelOffset({ hidden, panelWidth, resizerWidth = 0 }) {
  if (hidden || !(panelWidth > 0)) return 0;
  return panelWidth + (resizerWidth || 0);
}

/**
 * 글래스가 켜진 동안 #map-container 의 --glass-panel-offset 을 패널 너비에 맞춘다.
 * ResizeObserver 로 패널 너비·숨김을 따라가고(display:none 은 0×0 으로 보고된다),
 * 바뀔 때마다 window resize 를 쏴 OL 이 크기를 다시 잰다(main.js 가 듣는다).
 * @returns {() => void} 해제 함수 (변수 제거 + observer 해제 + resize 한 번)
 */
export function trackPanelOffset({
  panel,
  resizer,
  mapContainer,
  win = window,
  ResizeObserverCtor = win && win.ResizeObserver
} = {}) {
  if (!panel || !mapContainer || typeof ResizeObserverCtor !== 'function') return () => {};

  const fireResize = () => {
    if (win && typeof win.dispatchEvent === 'function') win.dispatchEvent(new Event('resize'));
  };
  const update = () => {
    const offset = panelOffset({
      hidden: panel.classList.contains('hidden'),
      panelWidth: panel.offsetWidth,
      resizerWidth: resizer ? resizer.offsetWidth : 0
    });
    mapContainer.style.setProperty(PANEL_OFFSET_PROP, `${offset}px`);
    fireResize();
  };

  const observer = new ResizeObserverCtor(update);
  observer.observe(panel);
  update();

  return () => {
    observer.disconnect();
    mapContainer.style.removeProperty(PANEL_OFFSET_PROP);
    fireResize();
  };
}

/** 주입된 게 없으면 문서에서 찾는다. 노드(테스트)엔 document 가 없으니 null. */
function resolveTrackDeps(deps) {
  if (deps.panel || deps.mapContainer) return deps;
  if (typeof document === 'undefined') return null;
  return {
    panel: document.getElementById('left-panel'),
    resizer: document.getElementById('panel-resizer'),
    mapContainer: document.getElementById('map-container'),
    ...deps
  };
}

/**
 * 지금 상태를 적용하고 이후 변경을 따른다.
 * @param {object} [deps] trackPanelOffset 에 넘길 요소들 (테스트 주입용)
 * @returns {() => void} 해제 함수
 */
export function bindGlass(labs, root = document.documentElement, deps = {}) {
  const trackDeps = resolveTrackDeps(deps);
  let untrack = null;
  const sync = (on) => {
    applyGlass(on, root);
    if (on && trackDeps && !untrack) untrack = trackPanelOffset(trackDeps);
    else if (!on && untrack) { untrack(); untrack = null; }
  };

  sync(labs.isOn(GLASS_ID));
  const offChange = labs.onChange((id, on) => {
    if (id === GLASS_ID) sync(on);
  });
  return () => {
    offChange();
    if (untrack) { untrack(); untrack = null; }
  };
}
