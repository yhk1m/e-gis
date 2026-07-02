// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildRasterLayer, canBuildRasterLayer } from './DemRenderer.js';

const DEM_LAYER_DATA = {
  id: 'L_dem', name: '고도', type: 'raster', rasterKind: 'dem',
  visible: false, color: '#3b82f6', opacity: 0.8, features: null,
  raster: {
    data: new Float32Array([0, 100, 200, 700]),
    width: 2, height: 2,
    extent: [0, 0, 100, 100],
    minVal: 0, maxVal: 700, noDataValue: -9999,
  },
};

describe('buildRasterLayer', () => {
  it('dem 래스터 → ImageLayer(메타·visible·opacity·extent 반영)', () => {
    const layer = buildRasterLayer(DEM_LAYER_DATA);
    expect(layer.get('egisLayerId')).toBe('L_dem');
    expect(layer.get('egisLayerName')).toBe('고도');
    expect(layer.getVisible()).toBe(false);
    expect(layer.getOpacity()).toBe(0.8);
    expect(layer.getExtent()).toEqual([0, 0, 100, 100]);
    expect(layer.getSource()).toBeTruthy();
  });

  it('analysis 래스터도 빌드된다', () => {
    const layer = buildRasterLayer({
      ...DEM_LAYER_DATA, id: 'L_sl', rasterKind: 'analysis', visible: true, opacity: 0.9,
      raster: { ...DEM_LAYER_DATA.raster, colorScheme: 'slope', minVal: 0, maxVal: 45 },
    });
    expect(layer.get('egisLayerId')).toBe('L_sl');
    expect(layer.getOpacity()).toBe(0.9);
  });
});

describe('canBuildRasterLayer', () => {
  it('dem/analysis + 완전한 raster만 true', () => {
    expect(canBuildRasterLayer(DEM_LAYER_DATA)).toBe(true);
    expect(canBuildRasterLayer({ ...DEM_LAYER_DATA, rasterKind: 'unknown' })).toBe(false);
    expect(canBuildRasterLayer({ ...DEM_LAYER_DATA, raster: {} })).toBe(false);
    expect(canBuildRasterLayer({ ...DEM_LAYER_DATA, raster: null })).toBe(false);
    expect(canBuildRasterLayer({ type: 'vector' })).toBe(false);
  });
});
