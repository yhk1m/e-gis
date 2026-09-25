// © 2026 김용현
/**
 * 글래스 UI 는 documentElement 의 data-surface="glass" 속성 하나로 켜진다.
 * CSS(glass.css)가 그 속성만 보므로 JS 는 속성을 붙이고 떼는 것과,
 * 데스크톱에서 창 전체에 깔린 지도 위에 뜬 패널·상단바·상태줄의 자리를
 * --glass-panel-offset / --glass-top-offset / --glass-bottom-offset 으로 알려 주는 것뿐이다.
 */
import { describe, it, expect, vi } from 'vitest';
import { applyGlass, bindGlass, layoutOffsets, trackLayoutOffsets, OFFSET_PROPS, GLASS_ATTR } from './glass.js';
import { Labs } from './labs.js';

function fakeRoot() {
  const attrs = {};
  return {
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
    getAttribute: (k) => (k in attrs ? attrs[k] : null)
  };
}

/** getBoundingClientRect 와 hidden 클래스만 흉내 낸 요소. rect 는 바꿔 끼울 수 있다. */
function fakeBox(rect, { hidden = false } = {}) {
  const classes = new Set(hidden ? ['hidden'] : []);
  return {
    rect,
    getBoundingClientRect() { return this.rect; },
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c)
    }
  };
}

const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });

/** 1600×1000 창: 메뉴바 32 + 툴바 40 위, 상태줄 26 아래, 패널 카드 8px 여백 */
function layout({ toolbarCollapsed = false, panelHidden = false } = {}) {
  const top = toolbarCollapsed ? 32 : 72;
  return {
    app: fakeBox(rect(0, 0, 1600, 1000)),
    main: fakeBox(rect(0, top, 1600, 974)),
    panel: fakeBox(panelHidden ? rect(0, 0, 0, 0) : rect(8, top + 8, 268, 966), { hidden: panelHidden }),
    resizer: fakeBox(rect(268, top, 272, 974)),
    mapContainer: fakeMapContainer()
  };
}

/** style.setProperty / removeProperty 만 흉내 낸 지도 컨테이너 */
function fakeMapContainer() {
  const props = {};
  return {
    style: {
      setProperty: (k, v) => { props[k] = v; },
      removeProperty: (k) => { delete props[k]; },
      getPropertyValue: (k) => (k in props ? props[k] : '')
    }
  };
}

const propsOf = (map) => ({
  panel: map.style.getPropertyValue(OFFSET_PROPS.panel),
  top: map.style.getPropertyValue(OFFSET_PROPS.top),
  bottom: map.style.getPropertyValue(OFFSET_PROPS.bottom)
});

/** 콜백과 observe/disconnect 호출을 기록하는 가짜 ResizeObserver */
function makeFakeResizeObserver() {
  const state = { instances: [] };
  class FakeRO {
    constructor(cb) {
      this.cb = cb;
      this.observed = [];
      this.disconnected = false;
      state.instances.push(this);
    }
    observe(el) { this.observed.push(el); }
    disconnect() { this.disconnected = true; }
    fire() { this.cb([], this); }
  }
  return { FakeRO, state };
}

function fakeWin() {
  return { dispatchEvent: vi.fn() };
}

describe('applyGlass', () => {
  it('켜면 data-surface="glass", 끄면 속성 제거', () => {
    const root = fakeRoot();
    applyGlass(true, root);
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');
    applyGlass(false, root);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();
  });
});

describe('layoutOffsets', () => {
  const appRect = rect(0, 0, 1600, 1000);
  const mainRect = rect(0, 72, 1600, 974);

  it('패널 오프셋은 rect 기준이라 카드 여백(8px)이 포함되고, 리사이저 너비를 더한다', () => {
    const o = layoutOffsets({ appRect, mainRect, panelRect: rect(8, 80, 268, 966), panelHidden: false, resizerWidth: 4 });
    expect(o).toEqual({ panel: 272, top: 72, bottom: 26 });
  });

  it('리사이저를 안 주면 패널 오른쪽 끝까지만', () => {
    const o = layoutOffsets({ appRect, mainRect, panelRect: rect(8, 80, 268, 966), panelHidden: false });
    expect(o.panel).toBe(268);
  });

  it('패널을 숨기면 panel=0 (위·아래는 그대로)', () => {
    const o = layoutOffsets({ appRect, mainRect, panelRect: rect(0, 0, 0, 0), panelHidden: true, resizerWidth: 4 });
    expect(o).toEqual({ panel: 0, top: 72, bottom: 26 });
  });

  it('툴바를 접으면 top 이 작아진다', () => {
    const o = layoutOffsets({ appRect, mainRect: rect(0, 32, 1600, 974), panelRect: rect(8, 40, 268, 966), panelHidden: false, resizerWidth: 4 });
    expect(o.top).toBe(32);
    expect(o.bottom).toBe(26);
  });

  it('음수는 0 으로, 소수는 반올림', () => {
    const o = layoutOffsets({
      appRect: rect(0, 0, 1600, 1000),
      mainRect: rect(0, -3, 1600, 1004),          // main 이 app 밖으로 삐져나온 경우
      panelRect: rect(8.4, 0, 260.6, 900),
      panelHidden: false,
      resizerWidth: 4
    });
    expect(o).toEqual({ panel: 265, top: 0, bottom: 0 });
  });

  it('app 의 왼쪽이 0 이 아니어도 panel 은 app 기준', () => {
    const o = layoutOffsets({ appRect: rect(100, 50, 1700, 1050), mainRect: rect(100, 122, 1700, 1024), panelRect: rect(108, 130, 368, 1016), panelHidden: false, resizerWidth: 4 });
    expect(o).toEqual({ panel: 272, top: 72, bottom: 26 });
  });
});

describe('trackLayoutOffsets', () => {
  it('요소나 ResizeObserver 가 없으면 아무것도 하지 않는다', () => {
    const win = fakeWin();
    const L = layout();
    const off = trackLayoutOffsets({ ...L, panel: null, win, ResizeObserverCtor: class {} });
    expect(typeof off).toBe('function');
    off();
    expect(propsOf(L.mapContainer)).toEqual({ panel: '', top: '', bottom: '' });

    trackLayoutOffsets({ ...L, win, ResizeObserverCtor: undefined });
    trackLayoutOffsets({ ...L, app: null, win, ResizeObserverCtor: makeFakeResizeObserver().FakeRO });
    trackLayoutOffsets({ ...L, main: null, win, ResizeObserverCtor: makeFakeResizeObserver().FakeRO });
    trackLayoutOffsets({ ...L, mapContainer: null, win, ResizeObserverCtor: makeFakeResizeObserver().FakeRO });
    expect(propsOf(L.mapContainer)).toEqual({ panel: '', top: '', bottom: '' });
    expect(win.dispatchEvent).not.toHaveBeenCalled();
  });

  it('처음에 세 변수를 심고 resize 를 쏜다; 패널과 main 을 함께 관찰한다', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const L = layout();
    const win = fakeWin();

    trackLayoutOffsets({ ...L, win, ResizeObserverCtor: FakeRO });
    expect(propsOf(L.mapContainer)).toEqual({ panel: '272px', top: '72px', bottom: '26px' });
    expect(win.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(win.dispatchEvent.mock.calls[0][0].type).toBe('resize');
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0].observed).toEqual(expect.arrayContaining([L.panel, L.main]));
  });

  it('콜백이 오면 다시 잰다 — 패널 너비 변경, 툴바 접기, 패널 숨김', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const L = layout();
    const win = fakeWin();
    trackLayoutOffsets({ ...L, win, ResizeObserverCtor: FakeRO });

    L.panel.rect = rect(8, 80, 328, 966);
    L.resizer.rect = rect(328, 72, 332, 974);
    state.instances[0].fire();
    expect(propsOf(L.mapContainer).panel).toBe('332px');
    expect(win.dispatchEvent).toHaveBeenCalledTimes(2);

    L.main.rect = rect(0, 32, 1600, 974);              // 툴바 접힘
    state.instances[0].fire();
    expect(propsOf(L.mapContainer).top).toBe('32px');

    L.panel.classList.add('hidden');
    L.panel.rect = rect(0, 0, 0, 0);
    state.instances[0].fire();
    expect(propsOf(L.mapContainer).panel).toBe('0px');
  });

  it('해제하면 observer 를 끊고 세 변수를 지우고 resize 를 한 번 더 쏜다', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const L = layout();
    const win = fakeWin();
    const off = trackLayoutOffsets({ ...L, win, ResizeObserverCtor: FakeRO });
    off();
    expect(state.instances[0].disconnected).toBe(true);
    expect(propsOf(L.mapContainer)).toEqual({ panel: '', top: '', bottom: '' });
    expect(win.dispatchEvent).toHaveBeenCalledTimes(2);
  });
});

describe('bindGlass', () => {
  it('초기 상태를 바로 적용하고, 이후 glass 변경만 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass', 'globe'], search: '?lab=glass' });
    const root = fakeRoot();
    const off = bindGlass(labs, root);
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');

    labs.set('globe', true);                 // 다른 실험은 영향 없음
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');

    labs.set('glass', false);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();

    off();
    labs.set('glass', true);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();   // 해제 뒤엔 안 따른다
  });

  it('주입한 요소들을 글래스가 켜진 동안만 추적한다', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const labs = new Labs();
    labs.init({ knownIds: ['glass'], search: '' });
    const L = layout();
    const deps = { ...L, win: fakeWin(), ResizeObserverCtor: FakeRO };

    const off = bindGlass(labs, fakeRoot(), deps);
    expect(state.instances).toHaveLength(0);           // 꺼진 채 시작 → 추적 없음
    expect(propsOf(L.mapContainer)).toEqual({ panel: '', top: '', bottom: '' });

    labs.set('glass', true);
    expect(state.instances).toHaveLength(1);
    expect(propsOf(L.mapContainer)).toEqual({ panel: '272px', top: '72px', bottom: '26px' });

    labs.set('glass', false);
    expect(state.instances[0].disconnected).toBe(true);
    expect(propsOf(L.mapContainer)).toEqual({ panel: '', top: '', bottom: '' });

    labs.set('glass', true);                           // 다시 켜면 새 observer
    expect(state.instances).toHaveLength(2);
    off();                                             // 바인딩 해제도 추적을 끝낸다
    expect(state.instances[1].disconnected).toBe(true);
    expect(propsOf(L.mapContainer)).toEqual({ panel: '', top: '', bottom: '' });
  });
});
