// © 2026 김용현
// @vitest-environment jsdom
/**
 * 공간 연산의 속성 승계와 '자르기 / 피처 유지' 모드 검증.
 *
 * 예전에는 turf.intersect/union에 properties를 넘기지 않아 결과 레이어의
 * 속성 테이블이 통째로 비었다. 두 레이어 속성이 모두 따라와야 한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { spatialOperationsTool } from './SpatialOperationsTool.js';

/** 지도 좌표(EPSG:3857) 기준 사각형 */
function box(x1, y1, x2, y2, props = {}) {
  return new Feature({
    geometry: new Polygon([[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]),
    ...props
  });
}

/** 결과 레이어의 피처 속성 목록 (geometry 제외) */
function propsOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures().map(f => {
    const { geometry, ...rest } = f.getProperties();
    return rest;
  });
}

function areaOf(layerId, index = 0) {
  return layerManager.getLayer(layerId).source.getFeatures()[index].getGeometry().getArea();
}

let 구역, 하천;

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));

  // 구역 A는 하천과 겹치고, 구역 C는 떨어져 있다
  구역 = layerManager.addLayer({
    name: '구역',
    features: [
      box(0, 0, 100, 100, { 시군구: '강남구', 면적: 39.5 }),
      box(200, 200, 300, 300, { 시군구: '서초구', 면적: 47.0 })
    ]
  });
  하천 = layerManager.addLayer({
    name: '하천',
    features: [box(50, 50, 150, 150, { 시군구: '강남구', 면적: 12.1, 용도: '하천' })]
  });
});

describe('교차 — 자르기 모드 (기본)', () => {
  it('두 레이어 속성을 모두 승계한다', () => {
    const result = spatialOperationsTool.intersect(구역, 하천);
    const props = propsOf(result.layerId);

    expect(props).toHaveLength(1);
    expect(props[0]).toEqual({
      시군구: '강남구',   // 값이 같아 하나만
      면적: 39.5,
      면적_2: 12.1,       // 값이 달라 _2로 보존
      용도: '하천'
    });
  });

  it('지오메트리는 겹치는 부분만 남는다', () => {
    const result = spatialOperationsTool.intersect(구역, 하천);
    // 겹침은 (50,50)~(100,100) = 원본 A의 1/4
    expect(areaOf(result.layerId)).toBeGreaterThan(0);
    expect(areaOf(result.layerId)).toBeLessThan(100 * 100 * 0.5);
  });
});

describe('교차 — 피처 유지 모드', () => {
  it('겹치는 피처를 자르지 않고 원본 그대로 남긴다', () => {
    const result = spatialOperationsTool.intersect(구역, 하천, { keepFeatures: true });

    expect(result.featureCount).toBe(1); // 떨어져 있는 구역 C는 제외
    // 원본 A의 넓이(100×100)가 그대로 유지된다
    expect(areaOf(result.layerId)).toBeCloseTo(100 * 100, -1);
  });

  it('겹친 상대 피처의 속성도 함께 승계한다', () => {
    const result = spatialOperationsTool.intersect(구역, 하천, { keepFeatures: true });
    expect(propsOf(result.layerId)[0]).toEqual({
      시군구: '강남구',
      면적: 39.5,
      면적_2: 12.1,
      용도: '하천'
    });
  });
});

describe('클리핑', () => {
  it('교차와 같은 결과를 낸다 (옵션도 그대로 전달)', () => {
    const clipped = spatialOperationsTool.clip(구역, 하천, { keepFeatures: true });
    expect(clipped.featureCount).toBe(1);
    expect(areaOf(clipped.layerId)).toBeCloseTo(100 * 100, -1);
  });
});

describe('차집합 — 자르기 모드 (기본)', () => {
  it('입력 레이어 속성을 유지한다', () => {
    const result = spatialOperationsTool.difference(구역, 하천);
    const props = propsOf(result.layerId);

    expect(props).toHaveLength(2);
    expect(props[0]).toEqual({ 시군구: '강남구', 면적: 39.5 });
    expect(props[1]).toEqual({ 시군구: '서초구', 면적: 47.0 });
  });

  it('겹치는 부분이 잘려 넓이가 줄어든다', () => {
    const result = spatialOperationsTool.difference(구역, 하천);
    expect(areaOf(result.layerId, 0)).toBeLessThan(100 * 100 * 0.95);
  });
});

describe('차집합 — 피처 유지 모드', () => {
  it('겹치는 피처를 통째로 제외한다', () => {
    const result = spatialOperationsTool.difference(구역, 하천, { keepFeatures: true });
    const props = propsOf(result.layerId);

    expect(props).toHaveLength(1);
    expect(props[0]).toEqual({ 시군구: '서초구', 면적: 47.0 }); // 안 겹치는 구역 C만
    expect(areaOf(result.layerId)).toBeCloseTo(100 * 100, -1);  // 잘리지 않음
  });
});

describe('합집합', () => {
  it('병합 모드(기본)는 하나의 도형으로 합친다', () => {
    const result = spatialOperationsTool.union(구역, 하천);
    expect(result.featureCount).toBe(1);
  });

  it('피처 유지 모드는 각 피처의 속성과 출처를 남긴다', () => {
    const result = spatialOperationsTool.union(구역, 하천, { dissolve: false });
    const props = propsOf(result.layerId);

    expect(props).toHaveLength(3); // 구역 2개 + 하천 1개
    expect(props[0]).toEqual({ 시군구: '강남구', 면적: 39.5, 출처레이어: '구역' });
    expect(props[2]).toEqual({ 시군구: '강남구', 면적: 12.1, 용도: '하천', 출처레이어: '하천' });
  });
});

describe('겹치는 피처가 없을 때', () => {
  it('교차 피처 유지 모드도 명확한 오류를 낸다', () => {
    const 멀리 = layerManager.addLayer({
      name: '멀리',
      features: [box(9000, 9000, 9100, 9100, { a: 1 })]
    });
    expect(() => spatialOperationsTool.intersect(구역, 멀리, { keepFeatures: true }))
      .toThrow(/겹치는/);
  });
});
