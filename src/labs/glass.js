// © 2026 김용현
/**
 * 글래스 UI — documentElement 의 data-surface="glass" 속성 하나.
 *
 * 색·블러는 전부 src/styles/glass.css 가 그 속성을 보고 정한다.
 * 라이트·다크(data-theme)와 직교라 넷 다 조합된다.
 *
 * 데스크톱에서는 glass.css 가 지도를 창(#app) 전체에 깔아 메뉴바·툴바·상태줄·왼쪽 패널 카드가
 * 전부 지도 위에 유리처럼 뜬다. 그때 지도 위 부유 요소(줌·나침반·범례·피처 카드·축척·사이드바 토글)가
 * 막대나 패널에 가리지 않도록 #map-container 에 세 오프셋을 두는 것이 JS 의 몫이다:
 *   --glass-panel-offset  패널 카드 오른쪽 끝(+리사이저)까지 — 왼쪽에 붙는 요소가 민다
 *   --glass-top-offset    메뉴바+툴바 높이 — 위에 붙는 요소가 민다 (툴바를 접으면 줄어든다)
 *   --glass-bottom-offset 상태줄 높이 — 아래에 붙는 요소가 민다
 * 휴대폰(≤768px)은 패널이 아래 시트라 panel 오프셋 0, 변수는 #app 에도 쓴다(시트가 #app 자식).
 */

export const GLASS_ATTR = 'data-surface';
export const PHONE_MEDIA = '(max-width: 768px)';
export const GLASS_ID = 'glass';
export const OFFSET_PROPS = {
  panel: '--glass-panel-offset',
  top: '--glass-top-offset',
  bottom: '--glass-bottom-offset'
};

export function applyGlass(on, root = document.documentElement) {
  if (on) root.setAttribute(GLASS_ATTR, 'glass');
  else root.removeAttribute(GLASS_ATTR);
}

const clampRound = (v) => Math.max(0, Math.round(v));

/**
 * 순수: rect 들로 세 오프셋(px)을 계산한다.
 * panel 은 app 왼쪽 기준 패널 rect 의 오른쪽 끝 + 리사이저 너비 (카드 여백이 rect 에 들어 있다).
 * 숨김이거나 panelFloating(휴대폰 — 패널이 왼쪽 열이 아니라 아래 시트)이면 0.
 * top 은 main 의 위쪽까지, bottom 은 main 의 아래쪽부터 app 의 아래쪽까지. 음수는 0, 소수는 반올림.
 */
export function layoutOffsets({ appRect, mainRect, panelRect, panelHidden, panelFloating = false, resizerWidth = 0 }) {
  const panel = (panelHidden || panelFloating) ? 0 : clampRound((panelRect.right - appRect.left) + (resizerWidth || 0));
  return {
    panel,
    top: clampRound(mainRect.top - appRect.top),
    bottom: clampRound(appRect.bottom - mainRect.bottom)
  };
}

/**
 * 글래스가 켜진 동안 #map-container 의 세 오프셋 변수를 실제 배치에 맞춘다.
 * ResizeObserver 로 패널(너비·숨김 — display:none 은 0×0 으로 보고된다)과
 * main(툴바 접기로 위쪽이 바뀐다)을 함께 따라가고,
 * 바뀔 때마다 window resize 를 쏴 OL 이 크기를 다시 잰다(main.js 가 듣는다).
 * @returns {() => void} 해제 함수 (변수 세 개 제거 + observer 해제 + resize 한 번)
 */
export function trackLayoutOffsets({
  app,
  main,
  panel,
  resizer,
  mapContainer,
  win = window,
  ResizeObserverCtor = win && win.ResizeObserver
} = {}) {
  if (!app || !main || !panel || !mapContainer || typeof ResizeObserverCtor !== 'function') return () => {};

  const fireResize = () => {
    if (win && typeof win.dispatchEvent === 'function') win.dispatchEvent(new Event('resize'));
  };
  // 변수를 쓰는 곳: 지도 위 부유 요소는 #map-container, 휴대폰 시트(#left-panel)는 #app 자식이라 #app 에도.
  const targets = [mapContainer, app].filter((el) => el && el.style && typeof el.style.setProperty === 'function');
  const phoneMql = (win && typeof win.matchMedia === 'function') ? win.matchMedia(PHONE_MEDIA) : null;

  const update = () => {
    const o = layoutOffsets({
      appRect: app.getBoundingClientRect(),
      mainRect: main.getBoundingClientRect(),
      panelRect: panel.getBoundingClientRect(),
      panelHidden: panel.classList.contains('hidden'),
      panelFloating: !!(phoneMql && phoneMql.matches),
      resizerWidth: resizer ? resizer.getBoundingClientRect().width : 0
    });
    targets.forEach((el) => {
      el.style.setProperty(OFFSET_PROPS.panel, `${o.panel}px`);
      el.style.setProperty(OFFSET_PROPS.top, `${o.top}px`);
      el.style.setProperty(OFFSET_PROPS.bottom, `${o.bottom}px`);
    });
    fireResize();
  };

  const observer = new ResizeObserverCtor(update);
  observer.observe(panel);
  observer.observe(main);
  // 회전·창 넓힘으로 휴대폰 경계를 넘으면 다시 잰다
  if (phoneMql && typeof phoneMql.addEventListener === 'function') phoneMql.addEventListener('change', update);
  update();

  return () => {
    observer.disconnect();
    if (phoneMql && typeof phoneMql.removeEventListener === 'function') phoneMql.removeEventListener('change', update);
    targets.forEach((el) => Object.values(OFFSET_PROPS).forEach((p) => el.style.removeProperty(p)));
    fireResize();
  };
}

/** 주입된 게 없으면 문서에서 찾는다. 노드(테스트)엔 document 가 없으니 null. */
function resolveTrackDeps(deps) {
  if (deps.panel || deps.mapContainer) return deps;
  if (typeof document === 'undefined') return null;
  return {
    app: document.getElementById('app'),
    main: document.getElementById('main-container'),
    panel: document.getElementById('left-panel'),
    resizer: document.getElementById('panel-resizer'),
    mapContainer: document.getElementById('map-container'),
    ...deps
  };
}

/**
 * 지금 상태를 적용하고 이후 변경을 따른다.
 * @param {object} [deps] trackLayoutOffsets 에 넘길 요소들 (테스트 주입용)
 * @returns {() => void} 해제 함수
 */
export function bindGlass(labs, root = document.documentElement, deps = {}) {
  const trackDeps = resolveTrackDeps(deps);
  let untrack = null;
  const sync = (on) => {
    applyGlass(on, root);
    if (on && trackDeps && !untrack) untrack = trackLayoutOffsets(trackDeps);
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
