// © 2026 김용현
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import MultiPolygon from 'ol/geom/MultiPolygon';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { representativePoint, layerLocations, guessNameField } from './layerLocations.js';

describe('representativePoint', () => {
  it('MultiPolygon 은 가장 큰 조각 안의 점을 고른다 (섬처럼 멀리 떨어진 작은 조각을 피한다)', () => {
    const big = [[126.9, 36.9], [127.1, 36.9], [127.1, 37.1], [126.9, 37.1], [126.9, 36.9]];
    const tiny = [[125.99, 33.99], [126.01, 33.99], [126.01, 34.01], [125.99, 34.01], [125.99, 33.99]];
    const featureObj = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [[big], [tiny]] }
    };
    const pt = representativePoint(featureObj);
    const [lon, lat] = pt.geometry.coordinates;
    expect(lon).toBeGreaterThan(126.9);
    expect(lon).toBeLessThan(127.1);
    expect(lat).toBeGreaterThan(36.9);
    expect(lat).toBeLessThan(37.1);
  });

  it('단순 Polygon 은 무게중심이 안에 있으면 그 점을 쓴다', () => {
    const square = [[127.0, 37.0], [127.2, 37.0], [127.2, 37.2], [127.0, 37.2], [127.0, 37.0]];
    const featureObj = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [square] } };
    const pt = representativePoint(featureObj);
    const [lon, lat] = pt.geometry.coordinates;
    expect(lon).toBeCloseTo(127.1, 5);
    expect(lat).toBeCloseTo(37.1, 5);
  });
});

describe('layerLocations', () => {
  function sourceOf(features) {
    return new VectorSource({ features });
  }

  it('Point 피처는 그 점의 경위도를 그대로 쓴다', () => {
    const f = new Feature({ geometry: new Point(fromLonLat([127.0, 37.5])), name: '서울' });
    const layerInfo = { source: sourceOf([f]) };
    const locs = layerLocations(layerInfo, 'name');
    expect(locs).toHaveLength(1);
    expect(locs[0].lon).toBeCloseTo(127.0, 3);
    expect(locs[0].lat).toBeCloseTo(37.5, 3);
  });

  it('이름 값이 없는 피처는 건너뛴다', () => {
    const f1 = new Feature({ geometry: new Point(fromLonLat([127.0, 37.5])), name: '서울' });
    const f2 = new Feature({ geometry: new Point(fromLonLat([129.0, 35.1])), name: '' });
    const layerInfo = { source: sourceOf([f1, f2]) };
    const locs = layerLocations(layerInfo, 'name');
    expect(locs.map((l) => l.name)).toEqual(['서울']);
  });

  it('MultiPolygon 피처는 대표점을 위치로 쓴다 (섬 조각에 안 찍힌다)', () => {
    const toRing = (coords) => coords.map((c) => fromLonLat(c));
    const big = toRing([[126.9, 36.9], [127.1, 36.9], [127.1, 37.1], [126.9, 37.1], [126.9, 36.9]]);
    const tiny = toRing([[125.99, 33.99], [126.01, 33.99], [126.01, 34.01], [125.99, 34.01], [125.99, 33.99]]);
    const f = new Feature({ geometry: new MultiPolygon([[big], [tiny]]), name: '인천' });
    const layerInfo = { source: sourceOf([f]) };
    const locs = layerLocations(layerInfo, 'name');
    expect(locs).toHaveLength(1);
    expect(locs[0].lon).toBeGreaterThan(126.9);
    expect(locs[0].lon).toBeLessThan(127.1);
    expect(locs[0].lat).toBeGreaterThan(36.9);
    expect(locs[0].lat).toBeLessThan(37.1);
  });

  it('코드 열을 주면 코드를 id 로, 없으면 f-i 를 id 로 쓴다', () => {
    const f1 = new Feature({ geometry: new Point(fromLonLat([127.0, 37.5])), name: '서울', code: '11' });
    const f2 = new Feature({ geometry: new Point(fromLonLat([129.0, 35.1])), name: '경기' });
    const layerInfo = { source: sourceOf([f1, f2]) };
    expect(layerLocations(layerInfo, 'name', 'code').map((l) => l.id)).toEqual(['11', 'f-1']);
  });
});

describe('guessNameField', () => {
  it('CTP_KOR_NM 같은 넓어진 정확 일치 패턴을 고른다', () => {
    expect(guessNameField(['CTP_CD', 'CTP_KOR_NM'])).toBe('CTP_KOR_NM');
  });
});
