// © 2026 김용현
/**
 * OL 피처(EPSG:3857)를 GeoJSON FeatureCollection(EPSG:4326)으로.
 * d3-geo 는 경위도만 받는다. ol/format/GeoJSON 은 노드에서도 돈다.
 */
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import { geoArea } from 'd3';
import { toLonLatFeatures, layerToLonLat } from './toLonLatFeatures.js';

describe('toLonLatFeatures', () => {
  it('좌표를 경위도로 되돌리고 속성을 유지한다', () => {
    const f = new Feature({ geometry: new Point(fromLonLat([127, 37])), name: '서울', v: 3 });
    const fc = toLonLatFeatures([f]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    const [lon, lat] = fc.features[0].geometry.coordinates;
    expect(lon).toBeCloseTo(127, 5);
    expect(lat).toBeCloseTo(37, 5);
    expect(fc.features[0].properties).toEqual({ name: '서울', v: 3 });
  });

  it('폴리곤도 변환한다', () => {
    const ring = [[126, 36], [128, 36], [128, 38], [126, 36]].map((c) => fromLonLat(c));
    const f = new Feature(new Polygon([ring]));
    const fc = toLonLatFeatures([f]);
    expect(fc.features[0].geometry.type).toBe('Polygon');
    expect(fc.features[0].geometry.coordinates[0][1][0]).toBeCloseTo(128, 5);
  });

  it('반시계(RFC 7946) 외곽 링을 d3 규약(시계)으로 뒤집어 작은 폴리곤이 되게 한다', () => {
    // 반시계 사각형 (경도 126~127, 위도 37~38)
    const ring = [[126, 37], [127, 37], [127, 38], [126, 38], [126, 37]].map((c) => fromLonLat(c));
    const f = new Feature(new Polygon([ring]));
    const out = toLonLatFeatures([f]);
    expect(geoArea(out.features[0])).toBeLessThan(Math.PI);   // 뒤집히면 4π − 작은 값
  });

  it('지오메트리 없는 피처는 뺀다', () => {
    const empty = new Feature({ v: 1 });
    const ok = new Feature(new Point(fromLonLat([0, 0])));
    expect(toLonLatFeatures([empty, ok]).features).toHaveLength(1);
  });
});

describe('layerToLonLat', () => {
  it('layerInfo.source 의 피처를 변환한다', () => {
    const source = new VectorSource();
    source.addFeature(new Feature(new Point(fromLonLat([10, 20]))));
    const fc = layerToLonLat({ source });
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates[0]).toBeCloseTo(10, 5);
  });

  it('source 가 없으면 빈 컬렉션', () => {
    expect(layerToLonLat({})).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
