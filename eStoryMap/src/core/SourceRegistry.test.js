// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { SourceRegistry } from './SourceRegistry.js';
import { parseEgisDoc } from './egisParse.js';
// 픽스처: dem + analysis + unknown 래스터 3레이어 (M2 스모크 픽스처 재사용)
import sampleDemRaw from '../../fixtures/sample_dem.egis?raw';

// MapView 대역: addLayer 기록만
function fakeMapView() {
  const added = [];
  return { added, addLayer(layer) { added.push(layer); } };
}

const VECTOR_LAYER = {
  id: 'L_v', name: '경계', type: 'vector', geometryType: 'Polygon',
  visible: true, color: '#ef4444', opacity: 1,
  features: { type: 'FeatureCollection', features: [] },
};

const DEM_LAYER = {
  id: 'L_d', name: '고도', type: 'raster', rasterKind: 'dem', visible: true, opacity: 0.8,
  raster: {
    data: {
      __encoding: 'base64', dtype: 'Float32Array',
      base64: 'AAAAAAAAyEIAAEhDAACWQwAAFkMAAHpDAACvQwAA4UMAAMhDAAD6QwAAFkQAAC9E',
    },
    width: 4, height: 3, extent: [0, 0, 400, 300], minVal: 0, maxVal: 700, noDataValue: -9999,
  },
};

function docWith(layers) {
  return parseEgisDoc({ version: '1.0', layers });
}

describe('SourceRegistry.addSource', () => {
  it('벡터·래스터를 빌드해 visible=false로 지도에 추가하고 builtLayerIds를 보고한다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const result = reg.addSource('src_1', docWith([VECTOR_LAYER, DEM_LAYER]));
    expect(result.builtLayerIds).toEqual(['L_v', 'L_d']);
    expect(result.skipped).toBe(0);
    expect(mv.added).toHaveLength(2);
    expect(mv.added.every((l) => l.getVisible() === false)).toBe(true);
  });

  it('egisLayerId가 소스 네임스페이스(src/layer)로 설정된다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER]));
    expect(mv.added[0].get('egisLayerId')).toBe('src_1/L_v');
  });

  it('unknown·데이터 결손 래스터는 스킵 카운트(e-GIS 스킵 정책)', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const result = reg.addSource('src_1', docWith([
      { id: 'L_u', name: '미상', type: 'raster', rasterKind: 'unknown' },
      VECTOR_LAYER,
    ]));
    expect(result.skipped).toBe(1);
    expect(result.builtLayerIds).toEqual(['L_v']);
  });

  it('손상 레이어는 격리되고 나머지는 계속(레이어별 try/catch)', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const corrupt = {
      ...DEM_LAYER, id: 'L_bad',
      raster: { ...DEM_LAYER.raster, data: { __encoding: 'base64', dtype: 'Float32Array', base64: 'AAAA' } },
    };
    const result = reg.addSource('src_1', docWith([corrupt, VECTOR_LAYER]));
    expect(result.skipped).toBe(1);
    expect(result.builtLayerIds).toEqual(['L_v']);
  });

  it('같은 layerId를 가진 두 소스가 충돌 없이 공존한다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER]));
    reg.addSource('src_2', docWith([VECTOR_LAYER]));
    expect(reg.getLayer('src_1', 'L_v')).not.toBe(reg.getLayer('src_2', 'L_v'));
    expect(mv.added).toHaveLength(2);
  });
});

describe('SourceRegistry 조회', () => {
  it('getLayer는 등록된 레이어, 없으면 null', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER]));
    expect(reg.getLayer('src_1', 'L_v')).toBe(mv.added[0]);
    expect(reg.getLayer('src_1', 'L_x')).toBeNull();
  });

  it('entriesList가 {sourceId, layerId, layer}를 순서대로 준다', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    reg.addSource('src_1', docWith([VECTOR_LAYER, DEM_LAYER]));
    const list = reg.entriesList();
    expect(list.map((e) => `${e.sourceId}:${e.layerId}`)).toEqual(['src_1:L_v', 'src_1:L_d']);
    expect(list[0].layer).toBe(mv.added[0]);
  });
});

describe('픽스처 통합', () => {
  it('sample_dem.egis → 2개 빌드, 1개 스킵(M2 픽스처 회귀)', () => {
    const mv = fakeMapView();
    const reg = new SourceRegistry(mv);
    const result = reg.addSource('src_1', parseEgisDoc(JSON.parse(sampleDemRaw)));
    expect(result.builtLayerIds).toEqual(['L_dem', 'L_slope']);
    expect(result.skipped).toBe(1);
  });
});
