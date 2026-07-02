// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { loadEgisIntoMap } from './EgisLoader.js';
// jsdom 환경에서 import.meta.url이 http 스킴이라 fs+URL 조합이 불가 → Vite ?raw로 픽스처 로드
import sampleDemRaw from '../../fixtures/sample_dem.egis?raw';

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

  it('복원 불가 래스터는 스킵하고 개수를 보고한다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0',
      layers: [VECTOR_LAYER, { id: 'L_r', type: 'raster', rasterKind: 'dem', raster: {} }],
    }, mv);
    expect(result.vectorCount).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mv.called('addLayer')).toHaveLength(1);
  });

  const DEM_RASTER = {
    id: 'L_dem', name: '고도', type: 'raster', rasterKind: 'dem',
    visible: true, opacity: 0.8,
    raster: {
      data: {
        __encoding: 'base64', dtype: 'Float32Array',
        base64: 'AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E',
      },
      width: 4, height: 3, extent: [0, 0, 400, 300],
      minVal: 0, maxVal: 700, noDataValue: -9999,
    },
  };

  it('dem 래스터를 ImageLayer로 로드하고 rasterCount로 보고한다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8 }, layers: [DEM_RASTER],
    }, mv);
    expect(result.rasterCount).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mv.called('addLayer')).toHaveLength(1);
    expect(mv.called('addLayer')[0][1].get('egisLayerId')).toBe('L_dem');
  });

  it('rasterKind unknown은 스킵한다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8 },
      layers: [{ id: 'L_u', name: '미상', type: 'raster', rasterKind: 'unknown' }],
    }, mv);
    expect(result.rasterCount).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mv.called('addLayer')).toHaveLength(0);
  });

  it('view가 없으면 래스터도 fit 폴백 대상에 포함된다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({ version: '1.0', layers: [DEM_RASTER] }, mv);
    expect(mv.called('setView')).toHaveLength(0);
    expect(mv.called('fitToLayers')).toHaveLength(1);
    expect(mv.called('fitToLayers')[0][1]).toEqual(result.layers);
  });

  it('손상된 레이어는 건너뛰고 나머지는 계속 로드한다(레이어별 격리)', () => {
    const mv = fakeMapView();
    const corrupt = {
      id: 'L_bad', name: '손상', type: 'raster', rasterKind: 'dem',
      visible: true, opacity: 0.8,
      raster: {
        // 'AAAA'는 3바이트 → Float32Array 생성 시 RangeError (가드는 통과)
        data: { __encoding: 'base64', dtype: 'Float32Array', base64: 'AAAA' },
        width: 1, height: 1, extent: [0, 0, 1, 1],
        minVal: 0, maxVal: 1, noDataValue: -9999,
      },
    };
    const result = loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8 },
      layers: [corrupt, VECTOR_LAYER],
    }, mv);
    expect(result.skipped).toBe(1);
    expect(result.vectorCount).toBe(1);
    expect(mv.called('addLayer')).toHaveLength(1);
  });

  it('analysis 래스터도 로더에서 로드된다', () => {
    const mv = fakeMapView();
    const result = loadEgisIntoMap({
      version: '1.0', view: { center: [129.0, 35.1], zoom: 8 },
      layers: [{
        ...DEM_RASTER, id: 'L_an', rasterKind: 'analysis',
        raster: { ...DEM_RASTER.raster, colorScheme: 'slope', minVal: 0, maxVal: 45 },
      }],
    }, mv);
    expect(result.rasterCount).toBe(1);
    expect(mv.called('addLayer')[0][1].get('egisLayerId')).toBe('L_an');
  });

  it('스모크 픽스처(sample_dem.egis)가 래스터 2개·스킵 1개로 로드된다', () => {
    const raw = JSON.parse(sampleDemRaw);
    const mv = fakeMapView();
    const result = loadEgisIntoMap(raw, mv);
    expect(result.rasterCount).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.vectorCount).toBe(0);
  });
});
