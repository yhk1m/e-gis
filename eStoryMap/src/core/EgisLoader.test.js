// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { loadEgisIntoMap } from './EgisLoader.js';

// MapView 대역: 호출 순서·인자만 기록 (OL 렌더링 없이 오케스트레이션 검증)
function fakeMapView() {
  const calls = [];
  return {
    calls,
    called(name) { return calls.filter(([n]) => n === name); },
    clearEgisLayers() { calls.push(['clearEgisLayers']); },
    addLayer(layer) { calls.push(['addLayer', layer]); },
    setView(center, zoom) { calls.push(['setView', center, zoom]); },
    fitToLayers(layers) { calls.push(['fitToLayers', layers]); },
  };
}

const VECTOR_LAYER = {
  id: 'L_a', name: '인구', type: 'vector', geometryType: 'Polygon',
  visible: true, color: '#ef4444', opacity: 1,
  features: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature', properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[129.0, 35.1], [129.1, 35.1], [129.1, 35.2], [129.0, 35.1]]],
      },
    }],
  },
};

describe('loadEgisIntoMap', () => {
  it('저장된 view가 있으면 setView로 복원하고 fit하지 않는다', () => {
    const mv = fakeMapView();
    loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8.5 }, layers: [VECTOR_LAYER],
    }, mv);
    expect(mv.called('setView')).toEqual([['setView', [129.0, 35.1], 8.5]]);
    expect(mv.called('fitToLayers')).toHaveLength(0);
  });

  it('저장된 view가 없으면 벡터 범위로 fit 폴백(setView 안 함)', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({ version: '1.0', layers: [VECTOR_LAYER] }, mv);
    expect(mv.called('setView')).toHaveLength(0);
    expect(mv.called('fitToLayers')).toHaveLength(1);
    expect(mv.called('fitToLayers')[0][1]).toEqual(result.layers);
  });

  it('view도 벡터도 없으면 카메라를 건드리지 않는다(MapView 초기 카메라 유지)', () => {
    const mv = fakeMapView();
    loadEgisIntoMap({ version: '1.0', layers: [] }, mv);
    expect(mv.called('setView')).toHaveLength(0);
    expect(mv.called('fitToLayers')).toHaveLength(0);
  });

  it('로드 시작 시 이전 egis 레이어를 제거한다(재로드 누적 방지)', () => {
    const mv = fakeMapView();
    loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8.5 }, layers: [VECTOR_LAYER],
    }, mv);
    const firstAddIdx = mv.calls.findIndex(([n]) => n === 'addLayer');
    const clearIdx = mv.calls.findIndex(([n]) => n === 'clearEgisLayers');
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(clearIdx).toBeLessThan(firstAddIdx);
  });

  it('벡터가 아닌 레이어는 스킵하고 개수를 보고한다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0',
      layers: [VECTOR_LAYER, { id: 'L_r', type: 'raster', rasterKind: 'dem', raster: {} }],
    }, mv);
    expect(result.vectorCount).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mv.called('addLayer')).toHaveLength(1);
  });
});
