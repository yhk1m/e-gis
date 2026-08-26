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
import Point from 'ol/geom/Point.js';
import { layerManager } from '../core/LayerManager.js';
import { spatialOperationsTool } from './SpatialOperationsTool.js';

/** 지도 좌표(EPSG:3857) 기준 사각형 */
function box(x1, y1, x2, y2, props = {}) {
  return new Feature({
    geometry: new Polygon([[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]),
    ...props
  });
}

/** 지도 좌표(EPSG:3857) 기준 점 */
function dot(x, y, props = {}) {
  return new Feature({ geometry: new Point([x, y]), ...props });
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

/**
 * 포인트 추출 — 안과 밖.
 *
 * 밖은 안의 여집합이라야 한다. 같은 판정(pointGeomInPolygon)을 뒤집을 뿐이므로
 * 경계 위의 점이 양쪽에 다 들어가거나 어디에도 안 들어가는 일이 있어서는 안 된다.
 */
describe('포인트 추출', () => {
  let 관측소;

  beforeEach(() => {
    관측소 = layerManager.addLayer({
      name: '관측소',
      features: [
        dot(50, 50, { 이름: '가', 강수량: 100 }),      // 강남구 안
        dot(250, 250, { 이름: '나', 강수량: 200 }),    // 서초구 안
        dot(500, 500, { 이름: '다', 강수량: 300 }),    // 어느 폴리곤에도 안 들어감
        dot(0, 0, { 이름: '라', 강수량: 400 })         // 강남구 경계 위(꼭짓점)
      ]
    });
  });

  it('밖 모드는 폴리곤에 안 들어간 포인트만 남긴다', () => {
    const result = spatialOperationsTool.pointsInPolygons(구역, 관측소, { outside: true });
    const 이름들 = propsOf(result.layerId).map(p => p.이름);
    expect(이름들).toEqual(['다']);
  });

  it('밖 결과에는 poly_ 태그가 붙지 않고 원본 속성은 그대로다', () => {
    const result = spatialOperationsTool.pointsInPolygons(구역, 관측소, { outside: true });
    expect(propsOf(result.layerId)).toEqual([{ 이름: '다', 강수량: 300 }]);
  });

  it('안 개수와 밖 개수를 합치면 전체 포인트 수가 된다', () => {
    // 경계 위의 점이 어느 쪽에도 빠지거나 양쪽에 겹치면 이 합이 깨진다
    const 안 = spatialOperationsTool.pointsInPolygons(구역, 관측소);
    const 밖 = spatialOperationsTool.pointsInPolygons(구역, 관측소, { outside: true });
    expect(안.insidePoints + 밖.outsidePoints).toBe(4);
    expect(안.totalPoints).toBe(4);
    expect(밖.totalPoints).toBe(4);
  });

  it('결과 레이어 이름이 안·밖에 따라 다르다', () => {
    const 안 = spatialOperationsTool.pointsInPolygons(구역, 관측소);
    const 밖 = spatialOperationsTool.pointsInPolygons(구역, 관측소, { outside: true });
    expect(layerManager.getLayer(안.layerId).name).toContain('폴리곤내');
    expect(layerManager.getLayer(밖.layerId).name).toContain('폴리곤밖');
  });

  it('전부 폴리곤 안에 있으면 밖 모드는 오류로 알린다', () => {
    const 안쪽만 = layerManager.addLayer({
      name: '안쪽만',
      features: [dot(50, 50, { 이름: '가' }), dot(250, 250, { 이름: '나' })]
    });
    expect(() => spatialOperationsTool.pointsInPolygons(구역, 안쪽만, { outside: true }))
      .toThrow(/밖/);
  });

  it('안 모드는 예전과 같다 (회귀 방지)', () => {
    const result = spatialOperationsTool.pointsInPolygons(구역, 관측소);
    const props = propsOf(result.layerId);
    expect(props.map(p => p.이름)).toEqual(['가', '나', '라']);
    expect(props[0].poly_시군구).toBe('강남구');
    expect(props[0].poly_index).toBe(0);
    expect(props[1].poly_시군구).toBe('서초구');
  });
});
