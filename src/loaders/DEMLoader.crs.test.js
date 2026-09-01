// © 2026 김용현
/**
 * DEM 좌표계 판정 검증.
 *
 * GeoTIFF GeoKeys를 CrsDetector가 읽을 모양으로 바꾸는 부분을 본다.
 * 예전 matchKoreanTM은 중앙경선 125를 EPSG:5188로 보냈다 — 5188은 동해원점(131)이고
 * 125는 서부원점(5185)이다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { geoKeysToParams } from './DEMLoader.js';
import { matchByProjParams } from '../core/CrsDetector.js';

beforeAll(() => coordinateSystem.init());

function tmGeoKeys(lon, fn = 600000, k = 1) {
  return {
    ProjCoordTransGeoKey: 1,
    GeogSemiMajorAxisGeoKey: 6378137,
    ProjNatOriginLongGeoKey: lon,
    ProjNatOriginLatGeoKey: 38,
    ProjFalseEastingGeoKey: 200000,
    ProjFalseNorthingGeoKey: fn,
    ProjScaleAtNatOriginGeoKey: k
  };
}

describe('geoKeysToParams', () => {
  it('GeoKeys를 CrsDetector가 읽는 모양으로 바꾼다', () => {
    expect(geoKeysToParams(tmGeoKeys(127))).toEqual({
      lon0: 127, lat0: 38, x0: 200000, y0: 600000, k: 1, ellps: 'grs80'
    });
  });

  it('중앙경선 125는 서부원점(5185)이다 — 예전에는 5188로 갔다', () => {
    expect(matchByProjParams(geoKeysToParams(tmGeoKeys(125)))).toBe('EPSG:5185');
  });

  it('중앙경선 131은 동해원점(5188)이다', () => {
    expect(matchByProjParams(geoKeysToParams(tmGeoKeys(131)))).toBe('EPSG:5188');
  });

  it('UTM-K(127.5, k=0.9996)를 알아본다', () => {
    const keys = tmGeoKeys(127.5, 2000000, 0.9996);
    keys.ProjFalseEastingGeoKey = 1000000;
    expect(matchByProjParams(geoKeysToParams(keys))).toBe('EPSG:5179');
  });

  it('횡축 메르카토르가 아니면 null이다', () => {
    expect(geoKeysToParams({ ProjCoordTransGeoKey: 8 })).toBeNull();
    expect(geoKeysToParams(null)).toBeNull();
  });
});
