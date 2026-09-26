// © 2026 김용현
// @vitest-environment jsdom
/**
 * 자동 저장 복원이 단계구분도 설정의 timeSeries 를 살려 두는지.
 * 복원 직후에는 저장된 인덱스의 정적 단계구분도로 서고, 컨트롤은 STATE_RESTORED 를 듣는
 * main.js 가 되살린다(TimeSeriesTool.restoreControls). 여기서는 설정과 이벤트만 본다.
 * 스텁은 AutoSaveManager.restore.test.js 와 같은 이유로 같은 것을 심는다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis.indexedDB = {
  open: () => ({ onerror: null, onsuccess: null, onupgradeneeded: null })
};
HTMLCanvasElement.prototype.getContext = function () {
  return {
    canvas: this,
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    set fillStyle(_v) {},
    get fillStyle() { return '#000'; }
  };
};
vi.mock('../tools/FlowTool.js', () => ({
  flowTool: { restoreFlow: vi.fn((layerData) => layerData.id) }
}));

const { layerManager } = await import('./LayerManager.js');
const { autoSaveManager } = await import('./AutoSaveManager.js');
const { stateManager } = await import('./StateManager.js');
const { eventBus, Events } = await import('../utils/EventBus.js');

const SQUARE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[126.9, 37.5], [127.0, 37.5], [127.0, 37.6], [126.9, 37.6], [126.9, 37.5]]] }, properties: { '2015': 10, '2020': 30 } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[127.0, 37.5], [127.1, 37.5], [127.1, 37.6], [127.0, 37.6], [127.0, 37.5]]] }, properties: { '2015': 20, '2020': 60 } }
  ]
};

function savedTimeSeriesLayer() {
  return {
    id: 'ts-derived',
    name: '구_시계열_2015~2020',
    type: 'choropleth',
    geometryType: 'Polygon',
    color: '#3b82f6',
    visible: true,
    features: SQUARE,
    choroplethConfig: {
      attribute: '2020',
      breaks: [0, 30, 60],
      colors: ['#deebf7', '#2171b5'],
      title: '구 (2015~2020)',
      unit: '', format: 'comma', rounding: 0,
      timeSeries: { fields: ['2015', 7, '2020'], index: 5 }    // 일부러 지저분한 저장본
    }
  };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('restoreLayer + timeSeries', () => {
  it('설정에 정돈된 timeSeries 가 붙고 attribute 는 저장값 그대로', async () => {
    await autoSaveManager.restoreLayer(savedTimeSeriesLayer());
    const info = layerManager.getLayer('ts-derived');
    expect(info).toBeTruthy();
    expect(info._choroplethConfig.timeSeries).toEqual({ fields: ['2015', '2020'], index: 1 });
    expect(info._choroplethConfig.attribute).toBe('2020');
    expect(document.getElementById('choropleth-legend-ts-derived')).toBeTruthy();
  });

  it('timeSeries 가 없거나 망가졌으면 붙이지 않는다', async () => {
    const data = savedTimeSeriesLayer();
    data.choroplethConfig.timeSeries = { fields: ['2015'] };
    await autoSaveManager.restoreLayer(data);
    expect(layerManager.getLayer('ts-derived')._choroplethConfig.timeSeries).toBeUndefined();
  });
});

describe('restoreState', () => {
  it('끝나면 STATE_RESTORED 를 한 번 낸다', async () => {
    vi.spyOn(stateManager, 'getMapState').mockReturnValue(null);
    vi.spyOn(stateManager, 'getAllLayers').mockResolvedValue([savedTimeSeriesLayer()]);
    const cb = vi.fn();
    eventBus.on(Events.STATE_RESTORED, cb);
    await autoSaveManager.restoreState();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ layerCount: 1 });
    eventBus.off(Events.STATE_RESTORED, cb);
  });
});
