// © 2026 김용현
/**
 * 글래스 UI 는 documentElement 의 data-surface="glass" 속성 하나로 켜진다.
 * CSS(glass.css)가 그 속성만 보므로 JS 는 속성을 붙이고 떼는 것과,
 * 데스크톱에서 지도 위에 뜬 왼쪽 패널의 너비를 --glass-panel-offset 으로 알려 주는 것뿐이다.
 */
import { describe, it, expect, vi } from 'vitest';
import { applyGlass, bindGlass, panelOffset, trackPanelOffset, GLASS_ATTR } from './glass.js';
import { Labs } from './labs.js';

function fakeRoot() {
  const attrs = {};
  return {
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
    getAttribute: (k) => (k in attrs ? attrs[k] : null)
  };
}

/** offsetWidth 와 hidden 클래스만 흉내 낸 요소 */
function fakeBox(width, { hidden = false } = {}) {
  const classes = new Set(hidden ? ['hidden'] : []);
  return {
    offsetWidth: width,
    classList: {
      contains: (c) => classes.has(c),
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c)
    }
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

describe('panelOffset', () => {
  it('숨김이면 0', () => {
    expect(panelOffset({ hidden: true, panelWidth: 260, resizerWidth: 4 })).toBe(0);
  });
  it('패널 너비 + 리사이저 너비', () => {
    expect(panelOffset({ hidden: false, panelWidth: 260, resizerWidth: 4 })).toBe(264);
  });
  it('리사이저가 없으면 패널 너비만', () => {
    expect(panelOffset({ hidden: false, panelWidth: 300, resizerWidth: 0 })).toBe(300);
    expect(panelOffset({ hidden: false, panelWidth: 300 })).toBe(300);
  });
  it('너비가 0 이면 숨김으로 본다 (observer 는 display:none 을 0×0 으로 보고한다)', () => {
    expect(panelOffset({ hidden: false, panelWidth: 0, resizerWidth: 4 })).toBe(0);
  });
});

describe('trackPanelOffset', () => {
  it('요소나 ResizeObserver 가 없으면 아무것도 하지 않는다', () => {
    const win = fakeWin();
    const off = trackPanelOffset({ panel: null, resizer: null, mapContainer: fakeMapContainer(), win, ResizeObserverCtor: class {} });
    expect(typeof off).toBe('function');
    off();
    const map = fakeMapContainer();
    trackPanelOffset({ panel: fakeBox(260), resizer: fakeBox(4), mapContainer: map, win, ResizeObserverCtor: undefined });
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('');
    expect(win.dispatchEvent).not.toHaveBeenCalled();
  });

  it('처음에 변수를 심고 resize 를 쏜다; 너비가 바뀌면 콜백이 변수를 갱신한다', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const panel = fakeBox(260);
    const resizer = fakeBox(4);
    const map = fakeMapContainer();
    const win = fakeWin();

    trackPanelOffset({ panel, resizer, mapContainer: map, win, ResizeObserverCtor: FakeRO });
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('264px');
    expect(win.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(win.dispatchEvent.mock.calls[0][0].type).toBe('resize');
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0].observed).toEqual([panel]);

    panel.offsetWidth = 320;
    state.instances[0].fire();
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('324px');
    expect(win.dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it('패널을 숨기면 0px, 리사이저가 없으면 패널 너비만', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const panel = fakeBox(260);
    const map = fakeMapContainer();
    trackPanelOffset({ panel, resizer: null, mapContainer: map, win: fakeWin(), ResizeObserverCtor: FakeRO });
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('260px');

    panel.classList.add('hidden');
    panel.offsetWidth = 0;
    state.instances[0].fire();
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('0px');
  });

  it('해제하면 observer 를 끊고 변수를 지우고 resize 를 한 번 더 쏜다', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const map = fakeMapContainer();
    const win = fakeWin();
    const off = trackPanelOffset({ panel: fakeBox(260), resizer: fakeBox(4), mapContainer: map, win, ResizeObserverCtor: FakeRO });
    off();
    expect(state.instances[0].disconnected).toBe(true);
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('');
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

  it('주입한 패널·지도 요소를 글래스가 켜진 동안만 추적한다', () => {
    const { FakeRO, state } = makeFakeResizeObserver();
    const labs = new Labs();
    labs.init({ knownIds: ['glass'], search: '' });
    const map = fakeMapContainer();
    const win = fakeWin();
    const deps = { panel: fakeBox(260), resizer: fakeBox(4), mapContainer: map, win, ResizeObserverCtor: FakeRO };

    const off = bindGlass(labs, fakeRoot(), deps);
    expect(state.instances).toHaveLength(0);           // 꺼진 채 시작 → 추적 없음
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('');

    labs.set('glass', true);
    expect(state.instances).toHaveLength(1);
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('264px');

    labs.set('glass', false);
    expect(state.instances[0].disconnected).toBe(true);
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('');

    labs.set('glass', true);                           // 다시 켜면 새 observer
    expect(state.instances).toHaveLength(2);
    off();                                             // 바인딩 해제도 추적을 끝낸다
    expect(state.instances[1].disconnected).toBe(true);
    expect(map.style.getPropertyValue('--glass-panel-offset')).toBe('');
  });
});
