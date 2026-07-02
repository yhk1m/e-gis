// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { fromLonLat } from 'ol/proj';
import {
  matchKoreanTM, inferSourceProjection, guessProjectionFromBbox,
  toMercatorExtent, extentTo3857, computeMinMax, demDataFromGeoTiff,
} from './geotiffParse.js';

const TM_BASE = {
  GeogSemiMajorAxisGeoKey: 6378137,
  ProjNatOriginLatGeoKey: 38,
  ProjFalseEastingGeoKey: 200000,
  ProjFalseNorthingGeoKey: 600000,
  ProjScaleAtNatOriginGeoKey: 1,
};

describe('matchKoreanTM', () => {
  it('중부원점(lon 127) → EPSG:5186', () => {
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 127 })).toBe('EPSG:5186');
  });
  it('동부(129)/서부(125) → 5187/5188', () => {
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 129 })).toBe('EPSG:5187');
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 125 })).toBe('EPSG:5188');
  });
  it('UTM-K 파라미터 → EPSG:5179', () => {
    expect(matchKoreanTM({
      GeogSemiMajorAxisGeoKey: 6378137,
      ProjNatOriginLongGeoKey: 127.5, ProjNatOriginLatGeoKey: 38,
      ProjFalseEastingGeoKey: 1000000, ProjFalseNorthingGeoKey: 2000000,
      ProjScaleAtNatOriginGeoKey: 0.9996,
    })).toBe('EPSG:5179');
  });
  it('타원체가 GRS80이 아니거나 파라미터 불일치면 null', () => {
    expect(matchKoreanTM({ ...TM_BASE, GeogSemiMajorAxisGeoKey: 6377397, ProjNatOriginLongGeoKey: 127 })).toBeNull();
    expect(matchKoreanTM({ ...TM_BASE, ProjNatOriginLongGeoKey: 128 })).toBeNull();
  });
});

describe('inferSourceProjection', () => {
  it('ProjectedCSTypeGeoKey 우선, 32767(user-defined)은 무시하고 TM 추론', () => {
    expect(inferSourceProjection({ ProjectedCSTypeGeoKey: 5186 })).toBe('EPSG:5186');
    expect(inferSourceProjection({ GeographicTypeGeoKey: 4326 })).toBe('EPSG:4326');
    expect(inferSourceProjection({
      ProjCoordTransGeoKey: 1, ...TM_BASE, ProjNatOriginLongGeoKey: 127,
    })).toBe('EPSG:5186');
    expect(inferSourceProjection(null)).toBeNull();
  });
});

describe('guessProjectionFromBbox', () => {
  it('경위도/웹메르카토르/UTM/불명 순으로 추측한다', () => {
    expect(guessProjectionFromBbox([129.0, 35.1, 129.1, 35.2])).toBe('EPSG:4326');
    expect(guessProjectionFromBbox([14360214, 4177479, 14371346, 4191094])).toBe('EPSG:3857');
    expect(guessProjectionFromBbox([200000, 600000, 210000, 610000])).toBe('UTM');
    expect(guessProjectionFromBbox([-5e7, -5e7, 5e7, 5e7])).toBeNull();
  });
});

describe('toMercatorExtent', () => {
  it('4326 bbox를 웹메르카토르로 수동 변환(OL fromLonLat과 일치)', () => {
    const ext = toMercatorExtent([129.0, 35.1, 129.1, 35.2]);
    const min = fromLonLat([129.0, 35.1]);
    const max = fromLonLat([129.1, 35.2]);
    expect(Math.abs(ext[0] - min[0])).toBeLessThan(1);
    expect(Math.abs(ext[1] - min[1])).toBeLessThan(1);
    expect(Math.abs(ext[2] - max[0])).toBeLessThan(1);
    expect(Math.abs(ext[3] - max[1])).toBeLessThan(1);
  });
});

describe('extentTo3857', () => {
  it('이미 3857이면 그대로', () => {
    const bbox = [14360214, 4177479, 14371346, 4191094];
    expect(extentTo3857(bbox, 'EPSG:3857')).toBe(bbox);
  });
  it('sourceProj가 없고 4326 형태면 수동 변환 폴백', () => {
    const ext = extentTo3857([129.0, 35.1, 129.1, 35.2], null);
    expect(Math.abs(ext[0] - fromLonLat([129.0, 35.1])[0])).toBeLessThan(1);
  });
  it('EPSG:5186은 proj4 등록으로 실제 변환된다(원점 검증)', () => {
    // 5186 원점 (200000, 600000) = 경위도 (127, 38)
    const ext = extentTo3857([200000, 600000, 201000, 601000], 'EPSG:5186');
    const [ox, oy] = fromLonLat([127, 38]);
    expect(Math.abs(ext[0] - ox)).toBeLessThan(50);
    expect(Math.abs(ext[1] - oy)).toBeLessThan(50);
  });
});

describe('computeMinMax', () => {
  it('노데이터/NaN/비유한 값을 제외하고 계산한다', () => {
    const { minVal, maxVal } = computeMinMax(
      new Float32Array([10, -9999, 20, NaN, 40, Infinity]), -9999);
    expect(minVal).toBe(10);
    expect(maxVal).toBe(40);
  });
});

describe('demDataFromGeoTiff', () => {
  const fakeImage = (over = {}) => ({
    readRasters: async () => [new Float32Array([10, 20, -9999, 40])],
    getWidth: () => 2,
    getHeight: () => 2,
    getBoundingBox: () => [129.0, 35.1, 129.1, 35.2],
    getGeoKeys: () => ({ GeographicTypeGeoKey: 4326 }),
    getGDALNoData: () => null,
    ...over,
  });

  it('GeoTIFF 이미지 → demData(extent는 3857로 정렬, GDAL 노데이터 기본 -9999)', async () => {
    const dem = await demDataFromGeoTiff(fakeImage());
    expect(dem.width).toBe(2);
    expect(dem.height).toBe(2);
    expect(dem.noDataValue).toBe(-9999);
    expect(dem.minVal).toBe(10);
    expect(dem.maxVal).toBe(40);
    expect(Math.abs(dem.extent[0] - fromLonLat([129.0, 35.1])[0])).toBeLessThan(1);
    expect(dem.data).toBeInstanceOf(Float32Array);
  });
});
