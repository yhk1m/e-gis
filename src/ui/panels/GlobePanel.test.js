// @vitest-environment jsdom
// © 2026 김용현
/**
 * 지구본 토글 버튼은 실험이 켜졌을 때만 보이고, 실험을 끄면 열려 있던 지구본도 닫힌다.
 * 컨트롤러는 동적 import 라 여기서는 가짜 로더를 주입한다.
 * 3D 와는 배타다 — 지구본을 켜면 3D 를 먼저 끄고(exitView3D), 3D 를 켜면 View3DPanel 의
 * beforeEnter 가 먼저 불린다(main.js 가 거기에 globePanel.exitIfActive 를 넘긴다).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GlobePanel, GLOBE_PNG_NAME } from './GlobePanel.js';
import { View3DPanel } from './View3DPanel.js';
import { Labs } from '../../labs/labs.js';

// View3DPanel 의 동적 import 대상 — three 를 싣지 않도록 가짜로 바꾼다
const view3dEntered = vi.fn();
vi.mock('../../view3d/View3DController.js', () => ({
  View3DController: function () {
    return {
      exaggeration: 2, pivotMarkerVisible: true,
      enter() { view3dEntered(); },
      exit() {},
      listTerrainSources() { return []; },
      findDems() { return [{}]; }
    };
  }
}));

function markup() {
  document.body.innerHTML = `
    <button id="globe-toggle" data-tool="globe" hidden aria-pressed="false"></button>
    <div id="map-container">
      <div id="globe-controls" hidden>
        <select id="globe-projection"></select>
        <input type="checkbox" id="globe-graticule" checked>
        <input type="checkbox" id="globe-land" checked>
        <p id="globe-skipped" hidden></p>
        <p id="globe-land-error" hidden></p>
        <button id="globe-save"></button>
        <button id="globe-close"></button>
      </div>
    </div>`;
}

function fakeController() {
  return {
    entered: false, exited: false, projectionKey: 'orthographic',
    graticule: null, land: null,
    onSkippedChanged: null, onLandFailed: null,
    enter() { this.entered = true; },
    exit() { this.exited = true; },
    setProjection(k) { this.projectionKey = k; },
    setGraticule(on) { this.graticule = on; },
    setLand(on) { this.land = on; },
    toDataURL() { return 'data:image/png;base64,AAAA'; }
  };
}

function makePanel({ search = '', controller = fakeController(), beforeEnter = vi.fn(), exitView3D, onMessage = vi.fn() } = {}) {
  const labs = new Labs();
  labs.init({ knownIds: ['globe'], search, baseUrl: 'https://e-gis.kr/' });
  const ctorArgs = [];
  const loadModule = vi.fn(async () => ({
    GlobeController: function (deps) { ctorArgs.push(deps); return controller; },
    PROJECTIONS: [{ key: 'orthographic', name: '지구본' }, { key: 'mercator', name: '메르카토르' }],
    DEFAULT_PROJECTION: 'orthographic'
  }));
  const panel = new GlobePanel({
    labs, mapManager: {}, layerManager: {}, onMessage, loadModule, beforeEnter, exitView3D
  });
  panel.init();
  return { panel, labs, controller, loadModule, beforeEnter, onMessage, ctorArgs };
}

beforeEach(markup);

describe('GlobePanel — 실험 스위치', () => {
  it('실험이 꺼져 있으면 버튼이 숨고, 켜면 보인다', () => {
    const { labs } = makePanel();
    const btn = document.getElementById('globe-toggle');
    expect(btn.hidden).toBe(true);
    labs.set('globe', true);
    expect(btn.hidden).toBe(false);
    labs.set('globe', false);
    expect(btn.hidden).toBe(true);
  });

  it('?lab=globe 로 열면 처음부터 보인다', () => {
    makePanel({ search: '?lab=globe' });
    expect(document.getElementById('globe-toggle').hidden).toBe(false);
  });
});

describe('GlobePanel — 토글', () => {
  it('켜면 모듈을 받아 컨트롤러를 만들고 투영법 목록을 채운다', async () => {
    const { panel, labs, controller, loadModule, beforeEnter, ctorArgs } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    expect(loadModule).toHaveBeenCalledTimes(1);
    expect(beforeEnter).toHaveBeenCalledTimes(1);
    expect(controller.entered).toBe(true);
    expect(panel.isActive()).toBe(true);
    expect(document.getElementById('globe-controls').hidden).toBe(false);
    expect(document.getElementById('globe-toggle').getAttribute('aria-pressed')).toBe('true');
    expect([...document.querySelectorAll('#globe-projection option')].map((o) => o.value)).toEqual(['orthographic', 'mercator']);
    expect(labs.isOn('globe')).toBe(true);
    expect(ctorArgs[0].container).toBe(document.getElementById('map-container'));
    expect(controller.graticule).toBe(true);
    expect(controller.land).toBe(true);
  });

  it('투영법 이름은 이스케이프해서 심는다', async () => {
    const { panel, loadModule } = makePanel({ search: '?lab=globe' });
    loadModule.mockImplementation(async () => ({
      GlobeController: function () { return fakeController(); },
      PROJECTIONS: [{ key: 'x"y', name: '<img src=x onerror=alert(1)>' }],
      DEFAULT_PROJECTION: 'x"y'
    }));
    await panel.toggle();
    const select = document.getElementById('globe-projection');
    expect(select.querySelector('img')).toBe(null);
    expect(select.options[0].value).toBe('x"y');
    expect(select.options[0].textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('투영법 select 가 컨트롤러로 간다', async () => {
    const { panel, controller } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    const select = document.getElementById('globe-projection');
    select.value = 'mercator';
    select.dispatchEvent(new Event('change'));
    expect(controller.projectionKey).toBe('mercator');
  });

  it('경위선·배경 육지 체크가 컨트롤러로 간다', async () => {
    const { panel, controller } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    const grat = document.getElementById('globe-graticule');
    grat.checked = false;
    grat.dispatchEvent(new Event('change'));
    const land = document.getElementById('globe-land');
    land.checked = false;
    land.dispatchEvent(new Event('change'));
    expect(controller.graticule).toBe(false);
    expect(controller.land).toBe(false);
  });

  it('다시 누르면 끈다', async () => {
    const { panel, controller } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    await panel.toggle();
    expect(controller.exited).toBe(true);
    expect(panel.isActive()).toBe(false);
    expect(document.getElementById('globe-controls').hidden).toBe(true);
    expect(document.getElementById('globe-toggle').getAttribute('aria-pressed')).toBe('false');
  });

  it('실험을 끄면 열려 있던 지구본이 닫힌다', async () => {
    const { panel, labs, controller } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    labs.set('globe', false);
    expect(controller.exited).toBe(true);
    expect(panel.isActive()).toBe(false);
  });

  it('여는 도중 실험을 끄면 켜지지 않는다', async () => {
    const { panel, labs, controller } = makePanel({ search: '?lab=globe' });
    const pending = panel.toggle();
    labs.set('globe', false);
    await pending;
    expect(controller.entered).toBe(false);
    expect(panel.isActive()).toBe(false);
    expect(document.getElementById('globe-controls').hidden).toBe(true);
  });

  it('닫기 버튼으로도 끈다', async () => {
    const { panel } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    document.getElementById('globe-close').click();
    expect(panel.isActive()).toBe(false);
  });

  it('exitIfActive 는 켜져 있을 때만 끈다', async () => {
    const { panel, controller } = makePanel({ search: '?lab=globe' });
    panel.exitIfActive();
    expect(controller.exited).toBe(false);
    await panel.toggle();
    panel.exitIfActive();
    expect(controller.exited).toBe(true);
    expect(panel.isActive()).toBe(false);
  });

  it('모듈을 못 받으면 메시지를 내고 꺼진 채로 남는다', async () => {
    const labs = new Labs();
    labs.init({ knownIds: ['globe'], search: '?lab=globe' });
    const onMessage = vi.fn();
    const panel = new GlobePanel({
      labs, mapManager: {}, layerManager: {}, onMessage,
      loadModule: async () => { throw new Error('boom'); }, beforeEnter: async () => {}
    });
    panel.init();
    await panel.toggle();
    expect(panel.isActive()).toBe(false);
    expect(onMessage).toHaveBeenCalledWith('지구본을 열지 못했습니다.');
    expect(document.getElementById('globe-toggle').disabled).toBe(false);
  });
});

describe('GlobePanel — 안내·저장', () => {
  it('건너뛴 레이어 요약과 육지 실패를 보여 준다', async () => {
    const { panel, controller } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    const skipped = document.getElementById('globe-skipped');
    controller.onSkippedChanged('래스터 2개는 지구본에 그리지 않습니다 <b>');
    expect(skipped.hidden).toBe(false);
    expect(skipped.textContent).toBe('래스터 2개는 지구본에 그리지 않습니다 <b>');
    expect(skipped.querySelector('b')).toBe(null);
    controller.onSkippedChanged('');
    expect(skipped.hidden).toBe(true);

    controller.onLandFailed();
    expect(document.getElementById('globe-land-error').hidden).toBe(false);
  });

  it('PNG 저장은 컨트롤러 그림을 지구본.png 로 내려받는다', async () => {
    const { panel } = makePanel({ search: '?lab=globe' });
    await panel.toggle();
    const clicked = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push({ href: this.href, download: this.download });
    });
    document.getElementById('globe-save').click();
    spy.mockRestore();
    expect(GLOBE_PNG_NAME).toBe('지구본.png');
    expect(clicked).toEqual([{ href: 'data:image/png;base64,AAAA', download: '지구본.png' }]);
  });

  it('그림을 못 뜨면 메시지를 낸다', async () => {
    const controller = fakeController();
    controller.toDataURL = () => { throw new Error('tainted'); };
    const { panel, onMessage } = makePanel({ search: '?lab=globe', controller });
    await panel.toggle();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.getElementById('globe-save').click();
    spy.mockRestore();
    expect(onMessage).toHaveBeenCalledWith('지구본을 저장하지 못했습니다.');
  });
});

describe('3D 배타', () => {
  it('지구본을 켜기 전에 exitView3D 를 기다린다', async () => {
    const order = [];
    const exitView3D = vi.fn(async () => { order.push('exit3d'); });
    const { panel, loadModule } = makePanel({ search: '?lab=globe', exitView3D });
    loadModule.mockImplementation(async () => {
      order.push('load');
      return {
        GlobeController: function () { return fakeController(); },
        PROJECTIONS: [{ key: 'orthographic', name: '지구본' }],
        DEFAULT_PROJECTION: 'orthographic'
      };
    });
    await panel.toggle();
    expect(exitView3D).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['exit3d', 'load']);
    expect(panel.isActive()).toBe(true);
  });

  it('지구본을 끌 때는 exitView3D 를 부르지 않는다', async () => {
    const exitView3D = vi.fn();
    const { panel } = makePanel({ search: '?lab=globe', exitView3D });
    await panel.toggle();
    await panel.toggle();
    expect(exitView3D).toHaveBeenCalledTimes(1);
  });

  describe('View3DPanel.beforeEnter', () => {
    afterEach(() => view3dEntered.mockReset());

    const mapManager = { getAvailableBasemaps: () => [], getBasemap: () => 'OSM' };

    /** 3D 요소를 덧붙이고 패널에 직접 잇는다 — jsdom 은 WebGL 이 없어 init() 이 일찍 돌아온다 */
    function wireView3D(panel) {
      document.body.insertAdjacentHTML('beforeend', `
        <button id="view3d-toggle"></button>
        <div id="view3d-panel" hidden></div>
        <div id="view3d-compass" hidden></div>
        <input id="view3d-exaggeration-value" value="2">
        <input type="checkbox" id="view3d-hide-pivot">
        <select id="view3d-terrain"></select>
        <select id="view3d-basemap"></select>`);
      panel.toggleButton = document.getElementById('view3d-toggle');
      panel.panel = document.getElementById('view3d-panel');
      panel.compass = document.getElementById('view3d-compass');
      panel.sliderValue = document.getElementById('view3d-exaggeration-value');
      panel.hidePivotCheck = document.getElementById('view3d-hide-pivot');
      panel.terrainSelect = document.getElementById('view3d-terrain');
      panel.basemapSelect = document.getElementById('view3d-basemap');
    }

    it('3D 를 켜기 전에 beforeEnter 를 기다리고, 끌 때는 부르지 않는다', async () => {
      const order = [];
      const beforeEnter = vi.fn(async () => { order.push('before'); });
      view3dEntered.mockImplementation(() => order.push('enter3d'));
      const panel = new View3DPanel({ mapManager, layerManager: {}, beforeEnter });
      wireView3D(panel);
      await panel.toggle();
      expect(order).toEqual(['before', 'enter3d']);
      expect(panel.controller).toBeTruthy();
      await panel.toggle();
      expect(panel.controller).toBe(null);
      expect(beforeEnter).toHaveBeenCalledTimes(1);
    });

    it('beforeEnter 가 없어도 켜진다', async () => {
      const panel = new View3DPanel({ mapManager, layerManager: {} });
      wireView3D(panel);
      await panel.toggle();
      expect(view3dEntered).toHaveBeenCalledTimes(1);
      expect(panel.controller).toBeTruthy();
    });

    it('지구본의 exitIfActive 를 beforeEnter 로 넘기면 3D 가 켜질 때 지구본이 닫힌다', async () => {
      const { panel: globe, controller } = makePanel({ search: '?lab=globe' });
      await globe.toggle();
      expect(globe.isActive()).toBe(true);
      const view3d = new View3DPanel({ mapManager, layerManager: {}, beforeEnter: () => globe.exitIfActive() });
      wireView3D(view3d);
      await view3d.toggle();
      expect(controller.exited).toBe(true);
      expect(globe.isActive()).toBe(false);
      expect(view3d.controller).toBeTruthy();
    });

    it('3D 가 켜져 있으면 지구본을 켤 때 3D 부터 끈다 (exitView3D 로 view3d.toggle)', async () => {
      const view3d = new View3DPanel({ mapManager, layerManager: {} });
      wireView3D(view3d);
      await view3d.toggle();
      expect(view3d.controller).toBeTruthy();
      const { panel: globe } = makePanel({
        search: '?lab=globe',
        exitView3D: () => (view3d.controller ? view3d.toggle() : undefined)
      });
      await globe.toggle();
      expect(view3d.controller).toBe(null);
      expect(globe.isActive()).toBe(true);
    });
  });
});
