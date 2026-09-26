// @vitest-environment jsdom
// © 2026 김용현
/**
 * SwipePanel — 툴바 토글은 실험이 켜졌을 때만 보이고, 열면 첫 대상을 클립하고,
 * 대상이 삭제되거나 실험이 꺼지면 조용히 끝난다. 배경지도 대상은 임시 타일 레이어를
 * index 1 에 끼웠다가 닫을 때 뺀다. 3D 보기 중에는 열리지 않고, 글래스 데스크톱에서는
 * 막대가 보이는 지도 칸 밖으로 나가지 않는다. 클립 자체는 SwipeTool 테스트와 하네스가 본다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwipePanel, glassRatioBounds } from './SwipePanel.js';
import { Labs } from '../../labs/labs.js';
import { eventBus, Events } from '../../utils/EventBus.js';

vi.mock('../../core/basemaps.js', () => ({
  findBasemap: (key) => (key === 'SATELLITE'
    ? { key, label: '위성 (Esri)', group: 'world', source: () => ({ fake: 'source' }) }
    : null)
}));

vi.mock('ol/layer/Tile', () => ({
  default: class FakeTileLayer {
    constructor(opts) { this.opts = opts; this.handlers = {}; }
    on(type, fn) { this.handlers[type] = fn; }
    un(type) { delete this.handlers[type]; }
  }
}));

function fakeOlLayer() {
  const handlers = {};
  return { handlers, on: (t, fn) => { handlers[t] = fn; }, un: (t) => { delete handlers[t]; } };
}

function makeEnv({ layers = [], search = '', panelOptions = {} } = {}) {
  document.body.innerHTML = `
    <div id="toolbar">
      <button id="view3d-toggle" aria-pressed="false"></button>
      <button id="swipe-toggle" data-tool="swipe" hidden aria-pressed="false"></button>
    </div>
    <div id="map-container" style="width:800px;height:600px">
      <div id="map"></div>
      <div id="swipe-controls" hidden>
        <select id="swipe-target"></select>
        <select id="swipe-orientation"><option value="vertical">세로</option><option value="horizontal">가로</option></select>
        <button id="swipe-close"></button>
      </div>
      <div id="swipe-divider" hidden><div class="swipe-handle"></div></div>
    </div>`;

  const collection = {
    items: ['base', 'ref'],
    insertAt(i, l) { this.items.splice(i, 0, l); },
    remove(l) { this.items = this.items.filter((x) => x !== l); }
  };
  const map = { getSize: () => [800, 600], render: vi.fn(), getLayers: () => collection };
  const mapManager = {
    getMap: () => map,
    getBasemap: () => 'OSM',
    getAvailableBasemaps: () => [
      { key: 'OSM', label: 'OSM 표준', group: 'world' },
      { key: 'SATELLITE', label: '위성 (Esri)', group: 'world' },
      { key: 'NONE', label: '없음', group: 'hidden' }
    ]
  };
  const layerManager = { getAllLayers: () => layers, getLayer: (id) => layers.find((l) => l.id === id) };
  const labs = new Labs();
  labs.init({ knownIds: ['swipe'], search });
  const messages = [];
  const panel = new SwipePanel({ mapManager, layerManager, labs, onMessage: (m) => messages.push(m), ...panelOptions });
  panel.init();
  return { panel, labs, map, collection, messages, layers };
}

function drag(divider, from, to) {
  divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: from[0], clientY: from[1], bubbles: true }));
  divider.dispatchEvent(new MouseEvent('pointermove', { clientX: to[0], clientY: to[1], bubbles: true }));
  divider.dispatchEvent(new MouseEvent('pointerup', { clientX: to[0], clientY: to[1], bubbles: true }));
}

beforeEach(() => { eventBus.events = {}; });

describe('SwipePanel 토글 버튼', () => {
  it('실험이 꺼져 있으면 hidden, 켜면 보인다 (즉시)', () => {
    const { labs } = makeEnv();
    const btn = document.getElementById('swipe-toggle');
    expect(btn.hidden).toBe(true);
    labs.set('swipe', true);
    expect(btn.hidden).toBe(false);
    labs.set('swipe', false);
    expect(btn.hidden).toBe(true);
  });

  it('?lab=swipe 로 열면 처음부터 보인다', () => {
    makeEnv({ search: '?lab=swipe' });
    expect(document.getElementById('swipe-toggle').hidden).toBe(false);
  });
});

describe('SwipePanel 열기·닫기', () => {
  it('대상이 없으면 열리지 않고 안내만 한다', () => {
    const { panel, messages } = makeEnv({ search: '?lab=swipe' });
    // 기본 카탈로그는 현재(OSM) 외에 SATELLITE 가 남는다. 대상이 정말 없는 경우를 만든다.
    panel.mapManager.getAvailableBasemaps = () => [{ key: 'OSM', label: 'OSM 표준', group: 'world' }];
    panel.toggle();
    expect(panel.isActive()).toBe(false);
    expect(messages.at(-1)).toBe('비교할 레이어나 배경지도가 없습니다.');
    expect(document.getElementById('swipe-controls').hidden).toBe(true);
  });

  it('열면 첫 대상(맨 위 레이어)을 클립하고 막대·박스·버튼 상태가 켜진다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const b = { id: 'l-b', name: '위', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a, b], search: '?lab=swipe' });
    panel.toggle();
    expect(panel.isActive()).toBe(true);
    expect(Object.keys(b.olLayer.handlers).sort()).toEqual(['postrender', 'prerender']);
    expect(a.olLayer.handlers).toEqual({});
    expect(document.getElementById('swipe-target').value).toBe('layer:l-b');
    expect(document.getElementById('swipe-controls').hidden).toBe(false);
    expect(document.getElementById('swipe-divider').hidden).toBe(false);
    expect(document.getElementById('swipe-divider').style.left).toBe('50%');
    expect(document.getElementById('swipe-toggle').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('swipe-toggle').classList.contains('active')).toBe(true);

    panel.toggle();
    expect(panel.isActive()).toBe(false);
    expect(b.olLayer.handlers).toEqual({});
    expect(document.getElementById('swipe-divider').hidden).toBe(true);
    expect(document.getElementById('swipe-toggle').getAttribute('aria-pressed')).toBe('false');
  });

  it('레이어 이름은 이스케이프해서 목록에 넣는다', () => {
    const a = { id: 'l-a', name: '<img src=x onerror=alert(1)>', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    const select = document.getElementById('swipe-target');
    expect(select.querySelector('img')).toBeNull();
    expect(select.options[0].textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('대상을 바꾸면 앞 레이어는 떼고 새 레이어에 붙는다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const b = { id: 'l-b', name: '위', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a, b], search: '?lab=swipe' });
    panel.toggle();
    const select = document.getElementById('swipe-target');
    select.value = 'layer:l-a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(b.olLayer.handlers).toEqual({});
    expect(Object.keys(a.olLayer.handlers).sort()).toEqual(['postrender', 'prerender']);
  });

  it('방향을 바꾸면 막대 클래스와 위치가 바뀐다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    const select = document.getElementById('swipe-orientation');
    select.value = 'horizontal';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const divider = document.getElementById('swipe-divider');
    expect(divider.classList.contains('horizontal')).toBe(true);
    expect(divider.style.top).toBe('50%');
    expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(panel.tool.orientation).toBe('horizontal');
  });

  it('배경지도 대상은 임시 타일 레이어를 index 1 에 끼우고 닫을 때 뺀다', () => {
    const { panel, collection } = makeEnv({ search: '?lab=swipe' });
    panel.toggle();   // 레이어가 없으니 첫 대상은 basemap:SATELLITE
    expect(document.getElementById('swipe-target').value).toBe('basemap:SATELLITE');
    expect(collection.items).toHaveLength(3);
    expect(collection.items[1]).toBe(panel.tempLayer);
    expect(panel.tempLayer.opts.source).toEqual({ fake: 'source' });
    expect(Object.keys(panel.tempLayer.handlers).sort()).toEqual(['postrender', 'prerender']);
    panel.toggle();
    expect(collection.items).toEqual(['base', 'ref']);
    expect(panel.tempLayer).toBeNull();
  });

  it('닫기 버튼으로도 닫힌다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    document.getElementById('swipe-close').click();
    expect(panel.isActive()).toBe(false);
  });
});

describe('SwipePanel 과 3D 보기·지구본은 배타', () => {
  it('3D 가 켜져 있으면(주입) 열리지 않고 안내한다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel, messages } = makeEnv({
      layers: [a], search: '?lab=swipe', panelOptions: { isView3DActive: () => true }
    });
    panel.toggle();
    expect(panel.isActive()).toBe(false);
    expect(a.olLayer.handlers).toEqual({});
    expect(document.getElementById('swipe-controls').hidden).toBe(true);
    expect(document.getElementById('swipe-divider').hidden).toBe(true);
    expect(messages.at(-1)).toBe('3D 보기 중에는 스와이프 비교를 쓸 수 없습니다. 2D로 돌아간 뒤 여세요.');
  });

  it('기본 감지는 #view3d-toggle 의 active 상태를 본다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe' });
    const view3d = document.getElementById('view3d-toggle');
    view3d.classList.add('active');
    view3d.setAttribute('aria-pressed', 'true');
    panel.open();
    expect(panel.isActive()).toBe(false);

    view3d.classList.remove('active');
    view3d.setAttribute('aria-pressed', 'false');
    panel.open();
    expect(panel.isActive()).toBe(true);
  });

  it('지구본이 켜져 있으면(주입) 열리지 않고 지구본 안내를 한다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel, messages } = makeEnv({
      layers: [a], search: '?lab=swipe', panelOptions: { isGlobeActive: () => true }
    });
    panel.toggle();
    expect(panel.isActive()).toBe(false);
    expect(a.olLayer.handlers).toEqual({});
    expect(document.getElementById('swipe-controls').hidden).toBe(true);
    expect(document.getElementById('swipe-divider').hidden).toBe(true);
    expect(messages.at(-1)).toBe('지구본 보기 중에는 스와이프 비교를 쓸 수 없습니다. 지구본을 닫은 뒤 여세요.');
  });

  it('3D 와 지구본이 함께 켜져 있으면 3D 안내가 먼저다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel, messages } = makeEnv({
      layers: [a], search: '?lab=swipe',
      panelOptions: { isView3DActive: () => true, isGlobeActive: () => true }
    });
    panel.open();
    expect(panel.isActive()).toBe(false);
    expect(messages.at(-1)).toBe('3D 보기 중에는 스와이프 비교를 쓸 수 없습니다. 2D로 돌아간 뒤 여세요.');
  });

  it('isGlobeActive 를 주입하지 않으면 지구본 때문에 막히지 않는다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.open();
    expect(panel.isActive()).toBe(true);
  });

  it('close() 는 열려 있지 않아도 안전하다 (3D 를 켜기 전에 main.js 가 부른다)', () => {
    const { panel } = makeEnv({ search: '?lab=swipe' });
    expect(() => panel.close()).not.toThrow();
    expect(panel.isActive()).toBe(false);
  });
});

describe('SwipePanel 이벤트', () => {
  it('대상 레이어가 삭제되면 조용히 끝난다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel, layers } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    layers.length = 0;
    eventBus.emit(Events.LAYER_REMOVED, { layerId: 'l-a' });
    expect(panel.isActive()).toBe(false);
    expect(document.getElementById('swipe-divider').hidden).toBe(true);
  });

  it('다른 레이어가 삭제되면 목록만 갱신하고 계속된다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const b = { id: 'l-b', name: '위', olLayer: fakeOlLayer() };
    const { panel, layers } = makeEnv({ layers: [a, b], search: '?lab=swipe' });
    panel.toggle();   // 대상 l-b
    layers.splice(0, 1);
    eventBus.emit(Events.LAYER_REMOVED, { layerId: 'l-a' });
    expect(panel.isActive()).toBe(true);
    const values = [...document.querySelectorAll('#swipe-target option')].map((o) => o.value);
    expect(values).toEqual(['layer:l-b', 'basemap:SATELLITE']);
    expect(document.getElementById('swipe-target').value).toBe('layer:l-b');
  });

  it('실험을 끄면 진행 중인 스와이프도 끝난다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel, labs } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    labs.set('swipe', false);
    expect(panel.isActive()).toBe(false);
    expect(a.olLayer.handlers).toEqual({});
    expect(document.getElementById('swipe-toggle').hidden).toBe(true);
  });

  it('막대를 끌면 비율이 바뀌고, 놓은 뒤에는 안 따라온다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    const divider = document.getElementById('swipe-divider');
    document.getElementById('map').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    divider.setPointerCapture = () => {};
    divider.releasePointerCapture = () => {};
    // jsdom 에는 PointerEvent 가 없다. 핸들러는 clientX/clientY 만 읽으므로 MouseEvent 로 충분하다.
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, clientY: 300, bubbles: true }));
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 300, bubbles: true }));
    expect(panel.tool.ratio).toBe(0.25);
    expect(divider.style.left).toBe('25%');
    divider.dispatchEvent(new MouseEvent('pointerup', { clientX: 200, clientY: 300, bubbles: true }));
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 600, clientY: 300, bubbles: true }));
    expect(panel.tool.ratio).toBe(0.25);
  });
});

describe('glassRatioBounds (순수)', () => {
  const insets = { panel: 200, top: 120, bottom: 60 };
  it('세로 막대는 왼쪽 패널 끝부터 오른쪽 끝까지', () => {
    expect(glassRatioBounds('vertical', { width: 800, height: 600 }, insets)).toEqual({ min: 0.25, max: 1 });
  });
  it('가로 막대는 위 막대 아래부터 상태줄 위까지', () => {
    expect(glassRatioBounds('horizontal', { width: 800, height: 600 }, insets)).toEqual({ min: 0.2, max: 0.9 });
  });
  it('크기를 모르거나 오프셋이 없으면 제한하지 않는다', () => {
    expect(glassRatioBounds('vertical', { width: 0, height: 0 }, insets)).toEqual({ min: 0, max: 1 });
    expect(glassRatioBounds('vertical', { width: 800, height: 600 }, null)).toEqual({ min: 0, max: 1 });
  });
  it('오프셋이 지도보다 커도 min <= max 를 지킨다', () => {
    const b = glassRatioBounds('horizontal', { width: 800, height: 100 }, { panel: 0, top: 80, bottom: 80 });
    expect(b.min).toBeLessThanOrEqual(b.max);
  });
});

describe('SwipePanel 글래스 비율 제한', () => {
  const realGetComputedStyle = window.getComputedStyle;
  const realMatchMedia = window.matchMedia;
  const offsets = { '--glass-panel-offset': '200px', '--glass-top-offset': '120px', '--glass-bottom-offset': '60px' };

  function glassOn({ desktop = true } = {}) {
    document.documentElement.dataset.surface = 'glass';
    window.matchMedia = (q) => ({ matches: desktop, media: q });
    window.getComputedStyle = (el) => {
      if (el && el.id === 'map-container') {
        return { getPropertyValue: (p) => offsets[p] || '' };
      }
      return realGetComputedStyle(el);
    };
  }

  function openWithRect(options) {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const env = makeEnv({ layers: [a], search: '?lab=swipe', ...options });
    document.getElementById('map').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    const divider = document.getElementById('swipe-divider');
    divider.setPointerCapture = () => {};
    divider.releasePointerCapture = () => {};
    env.panel.toggle();
    return { ...env, divider };
  }

  afterEach(() => {
    delete document.documentElement.dataset.surface;
    window.getComputedStyle = realGetComputedStyle;
    window.matchMedia = realMatchMedia;
  });

  it('세로 막대는 왼쪽 패널 밑으로 끌려가지 않는다', () => {
    glassOn();
    const { panel, divider } = openWithRect();
    drag(divider, [400, 300], [50, 300]);
    expect(panel.tool.ratio).toBe(0.25);
    expect(divider.style.left).toBe('25%');
    drag(divider, [200, 300], [800, 300]);
    expect(panel.tool.ratio).toBe(1);
  });

  it('가로 막대는 툴바 밑·상태줄 밑으로 끌려가지 않는다', () => {
    glassOn();
    const { panel, divider } = openWithRect();
    const orient = document.getElementById('swipe-orientation');
    orient.value = 'horizontal';
    orient.dispatchEvent(new Event('change', { bubbles: true }));
    drag(divider, [400, 300], [400, 10]);
    expect(panel.tool.ratio).toBe(0.2);
    drag(divider, [400, 120], [400, 590]);
    expect(panel.tool.ratio).toBe(0.9);
    expect(divider.style.top).toBe('90%');
  });

  it('방향을 바꿀 때 현재 비율도 보이는 칸 안으로 끌어온다', () => {
    glassOn();
    const { panel, divider } = openWithRect();
    drag(divider, [400, 300], [800, 300]);   // 세로 1.0
    const orient = document.getElementById('swipe-orientation');
    orient.value = 'horizontal';
    orient.dispatchEvent(new Event('change', { bubbles: true }));
    expect(panel.tool.ratio).toBe(0.9);
  });

  it('글래스가 아니면 제한하지 않는다', () => {
    const { panel, divider } = openWithRect();
    drag(divider, [400, 300], [0, 300]);
    expect(panel.tool.ratio).toBe(0);
  });

  it('글래스라도 데스크톱 배치가 아니면(태블릿·휴대폰) 제한하지 않는다', () => {
    glassOn({ desktop: false });
    const { panel, divider } = openWithRect();
    drag(divider, [400, 300], [0, 300]);
    expect(panel.tool.ratio).toBe(0);
  });
});

describe('SwipePanel 드래그 견고성', () => {
  function openDraggable() {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const env = makeEnv({ layers: [a], search: '?lab=swipe' });
    env.panel.toggle();
    document.getElementById('map').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    const divider = document.getElementById('swipe-divider');
    divider.setPointerCapture = () => {};
    divider.releasePointerCapture = () => {};
    return { ...env, divider };
  }

  it('주 버튼이 아니면(오른쪽 클릭) 드래그를 시작하지 않는다', () => {
    const { panel, divider } = openDraggable();
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, clientY: 300, button: 2, bubbles: true }));
    expect(panel.dragging).toBe(false);
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 300, bubbles: true }));
    expect(panel.tool.ratio).toBe(0.5);
  });

  it('포인터 캡처를 잃으면 드래그가 끝난다', () => {
    const { panel, divider } = openDraggable();
    divider.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, clientY: 300, bubbles: true }));
    expect(panel.dragging).toBe(true);
    divider.dispatchEvent(new MouseEvent('lostpointercapture', { bubbles: true }));
    expect(panel.dragging).toBe(false);
    divider.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 300, bubbles: true }));
    expect(panel.tool.ratio).toBe(0.5);
  });
});

describe('SwipePanel 레이아웃 변경 시 재클램프', () => {
  it('열려 있는 동안 resize 가 오면 비율을 새 범위 안으로 끌어온다', () => {
    const insets = { panel: 100, top: 0, bottom: 0 };
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe', panelOptions: { glassInsets: () => insets } });
    document.getElementById('map').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    panel.toggle();
    expect(panel.tool.ratio).toBe(0.5);
    insets.panel = 600;   // 패널을 넓혔다
    window.dispatchEvent(new Event('resize'));
    expect(panel.tool.ratio).toBe(0.75);
    expect(document.getElementById('swipe-divider').style.left).toBe('75%');
  });

  it('닫은 뒤에는 resize 를 듣지 않는다', () => {
    const insets = { panel: 100, top: 0, bottom: 0 };
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a], search: '?lab=swipe', panelOptions: { glassInsets: () => insets } });
    document.getElementById('map').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    panel.toggle();
    panel.close();
    const spy = vi.spyOn(panel, 'clampToVisible');
    insets.panel = 600;
    window.dispatchEvent(new Event('resize'));
    expect(spy).not.toHaveBeenCalled();
    expect(panel.tool.ratio).toBe(0.5);
  });
});

describe('SwipePanel 목록·대상 전환', () => {
  it('LAYER_RENAMED 로 목록을 다시 채워도 지금 대상은 그대로 선택돼 있다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const b = { id: 'l-b', name: '위', olLayer: fakeOlLayer() };
    const { panel } = makeEnv({ layers: [a, b], search: '?lab=swipe' });
    panel.toggle();
    const select = document.getElementById('swipe-target');
    select.value = 'layer:l-a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    a.name = '새 이름';
    eventBus.emit(Events.LAYER_RENAMED, { layerId: 'l-a' });
    expect(select.value).toBe('layer:l-a');
    expect(select.options[select.selectedIndex].textContent).toBe('새 이름');
    expect(Object.keys(a.olLayer.handlers).sort()).toEqual(['postrender', 'prerender']);
  });

  it('배경지도 대상에서 레이어 대상으로 바꾸면 임시 타일 레이어를 뺀다', () => {
    const a = { id: 'l-a', name: '아래', olLayer: fakeOlLayer() };
    const { panel, collection } = makeEnv({ layers: [a], search: '?lab=swipe' });
    panel.toggle();
    const select = document.getElementById('swipe-target');
    select.value = 'basemap:SATELLITE';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const temp = panel.tempLayer;
    expect(collection.items[1]).toBe(temp);
    select.value = 'layer:l-a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(panel.tempLayer).toBeNull();
    expect(collection.items).toEqual(['base', 'ref']);
    expect(temp.handlers).toEqual({});
    expect(Object.keys(a.olLayer.handlers).sort()).toEqual(['postrender', 'prerender']);
  });
});
