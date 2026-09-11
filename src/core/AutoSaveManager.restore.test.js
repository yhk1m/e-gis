// © 2026 김용현
// @vitest-environment jsdom
/**
 * 자동 저장 복원이 레이어 모양을 바꾸지 않는지 검증.
 *
 * 버그: 새로고침 후 복원하면 손대지 않은 포인트 레이어가
 *   "불투명 원색 + 흰 테두리" → "30% 투명 + 같은 색 테두리" 로 바뀐다.
 *
 * 뿌리는 스타일 생성 경로가 둘이고 서로 다른 모양을 낸다는 것:
 *   - createStyle (LayerManager.js:66-73)      포인트: 불투명 fill, 흰 stroke
 *   - updateLayerStyle (LayerManager.js:653-661) 포인트: rgba(색, fillOpacity), 색 stroke
 * addLayer가 심는 메타데이터(fillOpacity: 0.3, strokeColor: 색)가 포인트의 실제
 * 렌더링을 설명하지 못하기 때문이다.
 *
 * ProjectManager(.egis)는 이 함정을 알고 손대지 않은 레이어에는 updateLayerStyle을
 * 부르지 않도록 가드한다(ProjectManager.js:287-293). AutoSaveManager에는 그 가드가 없다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import GeoJSON from 'ol/format/GeoJSON.js';

// StateManager는 생성자에서 indexedDB.open을 부른다(StateManager.js:26). jsdom에는 없으므로
// import 전에 스텁을 심는다. 이 테스트는 restoreLayer의 스타일 처리만 보므로 DB는 쓰지 않는다.
globalThis.indexedDB = {
  open: () => ({ onerror: null, onsuccess: null, onupgradeneeded: null })
};

// OL Heatmap 생성자는 그라디언트를 굽느라 canvas 2D 컨텍스트를 쓴다(ol/layer/Heatmap.js:252).
// jsdom은 getContext를 구현하지 않으므로 최소 스텁을 심는다. 픽셀 값 자체는 검사하지 않고
// Heatmap 레이어가 만들어졌는지(getBlur/getRadius)만 보므로 이걸로 충분하다.
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

// 흐름 레이어는 FlowRenderer(캔버스 그리기)까지 끌고 오므로 도구를 통째로 목으로 대체한다.
// 여기서는 복원 경로가 restoreFlow 로 갈라지는지만 본다.
vi.mock('../tools/FlowTool.js', () => ({
  flowTool: { restoreFlow: vi.fn((layerData) => layerData.id) }
}));

const { layerManager, STYLE_FIELDS, pickStyleFields } = await import('./LayerManager.js');
const { autoSaveManager } = await import('./AutoSaveManager.js');
const { stateManager } = await import('./StateManager.js');
const { flowTool } = await import('../tools/FlowTool.js');

const COLOR = '#ff0000';

/** 렌더링에 실제로 영향을 주는 값만 뽑는다 (색 표기 차이는 정규화) */
function pointLook(style) {
  const img = style.getImage();
  const norm = (c) => {
    if (typeof c !== 'string') return c;
    // #rrggbb → rgba(r, g, b, 1) 로 통일해 표기 차이를 무시한다
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
    if (!m) return c;
    const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
    return `rgba(${r}, ${g}, ${b}, 1)`;
  };
  return {
    fill: norm(img.getFill().getColor()),
    stroke: norm(img.getStroke().getColor()),
    strokeWidth: img.getStroke().getWidth(),
    radius: img.getRadius()
  };
}

/** StateManager.saveLayer(LayerManager.js:200-218) 가 만드는 레코드 형태를 흉내낸다 */
function serializeLike(layerInfo) {
  const geoJSON = new GeoJSON();
  return {
    id: layerInfo.id + '-restored',
    name: layerInfo.name,
    type: layerInfo.type,
    geometryType: layerInfo.geometryType,
    color: layerInfo.color,
    ...pickStyleFields(layerInfo),
    visible: layerInfo.visible,
    features: geoJSON.writeFeaturesObject(layerInfo.source.getFeatures())
  };
}

describe('AutoSaveManager.restoreLayer — 스타일 보존', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('손대지 않은 포인트 레이어는 복원해도 모양이 같아야 한다', async () => {
    const originalId = layerManager.addLayer({
      name: '관측소',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);
    const expected = pointLook(original.olLayer.getStyle());

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    const restored = layerManager.getLayer(restoredId);

    expect(pointLook(restored.olLayer.getStyle())).toEqual(expected);
  });

  it('히트맵은 히트맵으로 복원되어야 한다 (포인트로 떨어지지 않게)', async () => {
    const geoJSON = new GeoJSON();
    const layerData = {
      id: 'heatmap-restore-test',
      name: '강수량 히트맵',
      type: 'heatmap',
      geometryType: 'Point',
      visible: true,
      features: geoJSON.writeFeaturesObject([
        new Feature({ geometry: new Point([0, 0]) }),
        new Feature({ geometry: new Point([100, 100]) })
      ]),
      heatmapConfig: {
        sourceLayerId: null,
        blur: 22,
        radius: 14,
        weight: null,
        gradient: ['#0000ff', '#ff0000'],
        hideSource: false
      }
    };

    const id = await autoSaveManager.restoreLayer(layerData);
    const info = layerManager.getLayer(id);

    expect(info.type).toBe('heatmap');
    // OL Heatmap 레이어여야 한다. 평범한 VectorLayer로 오면 점만 찍힌다.
    expect(typeof info.olLayer.getBlur).toBe('function');
    expect(info.olLayer.getBlur()).toBe(22);
    expect(info.olLayer.getRadius()).toBe(14);
  });

  it('사용자가 바꾼 스타일은 복원 시 반영되어야 한다', async () => {
    const originalId = layerManager.addLayer({
      name: '관측소',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);

    // 사용자가 레이어 패널에서 반경과 채우기 투명도를 바꾼 상황
    original.pointRadius = 12;
    original.fillOpacity = 0.5;
    layerManager.updateLayerStyle(originalId);
    const expected = pointLook(original.olLayer.getStyle());

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    const restored = layerManager.getLayer(restoredId);

    const actual = pointLook(restored.olLayer.getStyle());
    expect(actual).toEqual(expected);
    expect(actual.radius).toBe(12);
  });

  it('strokeSyncToFill이 복원 후에도 유지된다', async () => {
    const originalId = layerManager.addLayer({
      name: '동기화 해제 레이어',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const original = layerManager.getLayer(originalId);

    // 기본값은 true여야 한다
    expect(original.strokeSyncToFill).toBe(true);

    // 사용자가 동기화를 끈다
    original.strokeSyncToFill = false;

    const restoredId = await autoSaveManager.restoreLayer(serializeLike(original));
    expect(layerManager.getLayer(restoredId).strokeSyncToFill).toBe(false);
  });
});

describe('흐름 레이어 자동 저장·복원', () => {
  const FLOW_CONFIG = {
    dataset: { locations: [], flows: [], meta: {} },
    style: {},
    selectedIds: ['a']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('restoreLayer: 흐름 레코드는 피처를 읽지 않고 flowTool.restoreFlow 로 넘긴다', async () => {
    const layerData = {
      id: 'f1', name: '흐름', type: 'flow', visible: false, flowConfig: FLOW_CONFIG
    };
    const readFeatures = vi.spyOn(autoSaveManager.geoJSON, 'readFeatures');

    const id = await autoSaveManager.restoreLayer(layerData);

    expect(id).toBe('f1');
    expect(flowTool.restoreFlow).toHaveBeenCalledTimes(1);
    expect(flowTool.restoreFlow).toHaveBeenCalledWith(layerData);
    // 흐름 레코드에는 features 가 없다 — readFeatures(undefined) 로 죽으면 안 된다
    expect(readFeatures).not.toHaveBeenCalled();
    readFeatures.mockRestore();
  });

  it('saveLayer: 흐름 레이어는 source 가 없어도 flowConfig 를 담은 레코드로 저장된다', async () => {
    // indexedDB 스텁은 onsuccess 를 부르지 않으므로 waitForReady 가 영원히 기다린다 → 준비된 척한다
    stateManager.isReady = true;
    const put = vi.spyOn(stateManager, '_putLayerRecord').mockResolvedValue('f1');

    const layerInfo = {
      id: 'f1', name: '흐름', type: 'flow', visible: true,
      source: null,                       // 흐름 레이어는 VectorSource 가 없다
      olLayer: { getZIndex: () => 7 },
      _flowConfig: FLOW_CONFIG
    };
    const id = await stateManager.saveLayer(layerInfo);

    expect(id).toBe('f1');
    expect(put).toHaveBeenCalledTimes(1);
    const record = put.mock.calls[0][0];
    expect(record).toMatchObject({
      id: 'f1', name: '흐름', type: 'flow', geometryType: 'Flow', visible: true, zIndex: 7,
      flowConfig: { dataset: FLOW_CONFIG.dataset, style: FLOW_CONFIG.style, selectedIds: ['a'] }
    });
    expect(record.features).toBeUndefined();
    expect(typeof record.timestamp).toBe('number');
    put.mockRestore();
  });

  it('saveLayer: 벡터 레이어는 여전히 피처를 GeoJSON 으로 담아 같은 헬퍼로 저장된다', async () => {
    stateManager.isReady = true;
    const put = vi.spyOn(stateManager, '_putLayerRecord').mockImplementation(async (rec) => rec.id);

    const layerId = layerManager.addLayer({
      name: '관측소',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const id = await stateManager.saveLayer(layerManager.getLayer(layerId));

    expect(id).toBe(layerId);
    expect(put).toHaveBeenCalledTimes(1);
    const record = put.mock.calls[0][0];
    expect(record.type).toBe('vector');
    expect(record.color).toBe(COLOR);
    expect(record.features.type).toBe('FeatureCollection');
    expect(record.features.features).toHaveLength(1);
    expect(record.flowConfig).toBeUndefined();
    put.mockRestore();
  });

  it('saveLayer: 래스터처럼 source 가 없는 비-흐름 레이어는 저장하지 않는다', async () => {
    stateManager.isReady = true;
    const put = vi.spyOn(stateManager, '_putLayerRecord');

    const id = await stateManager.saveLayer({ id: 'r1', name: '위성', type: 'raster', source: null });

    expect(id).toBe('r1');
    expect(put).not.toHaveBeenCalled();
    put.mockRestore();
  });
});

describe('pickStyleFields', () => {
  it('STYLE_FIELDS의 모든 필드를 빠짐없이 담는다', () => {
    const id = layerManager.addLayer({
      name: '필드 확인용',
      features: [new Feature({ geometry: new Point([0, 0]) })],
      color: COLOR
    });
    const picked = pickStyleFields(layerManager.getLayer(id));
    expect(Object.keys(picked).sort()).toEqual([...STYLE_FIELDS].sort());
  });
});
