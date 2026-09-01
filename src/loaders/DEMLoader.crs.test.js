// © 2026 김용현
// @vitest-environment jsdom
/**
 * DEM 좌표계 판정 검증.
 *
 * GeoTIFF GeoKeys를 CrsDetector가 읽을 모양으로 바꾸는 부분을 본다.
 * 예전 matchKoreanTM은 중앙경선 125를 EPSG:5188로 보냈다 — 5188은 동해원점(131)이고
 * 125는 서부원점(5185)이다.
 *
 * createDEMLayer는 확인 창이 없어 애매(ambiguous)할 때 콘솔 경고만 남긴다 —
 * 그 경고가 실제로 찍히는지도 함께 본다. (jsdom 환경: buildDEMLayer가 범례를
 * document.createElement로 만들기 때문. #map 엘리먼트는 없으니 실제로 붙지는 않는다.)
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { layerManager } from '../core/LayerManager.js';
import { demLoader, geoKeysToParams } from './DEMLoader.js';
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

const SEOUL = [126.9784, 37.5667];
const BUSAN = [129.0756, 35.1796];

// CrsDetector.test.js의 "TM 자료는 후보가 여럿이라 애매하다" 픽스처와 같다 —
// 5186과 5181은 y_0만 10만 달라 좌표만으로는 갈리지 않는다.
function ambiguousBbox() {
  const p1 = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
  const p2 = proj4('EPSG:4326', 'EPSG:5186', BUSAN);
  return [p1[0], p1[1], p2[0], p2[1]];
}

// GeoTIFF 이미지 객체를 흉내낸다 — createDEMLayer가 실제로 쓰는 메서드만 갖춘다
function fakeImage(bbox) {
  return {
    readRasters: async () => [new Float32Array([1, 2, 3, 4])],
    getWidth: () => 2,
    getHeight: () => 2,
    getBoundingBox: () => bbox,
    getGeoKeys: () => null, // GeoKeys 없음 → 좌표 역검증으로 넘어감
    getGDALNoData: () => null
  };
}

describe('createDEMLayer — 애매한 좌표계', () => {
  afterEach(() => vi.restoreAllMocks());

  it('DEM은 확인 창이 없어 첫 후보를 조용히 쓰되, 콘솔에 경고를 남긴다', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const layerId = await demLoader.createDEMLayer(fakeImage(ambiguousBbox()), 'DEM 애매', {
      fitExtent: false
    });

    // 첫 후보(5186)로 조용히 진행 — 레이어는 만들어진다
    expect(layerManager.getLayer(layerId)).toBeTruthy();

    // 무엇을 골랐고 다른 후보가 무엇이었는지 콘솔 경고로 남는다
    const warned = warnSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(warned).toMatch(/애매/);
    expect(warned).toContain('EPSG:5186');
    expect(warned).toContain('EPSG:5181');

    layerManager.removeLayer(layerId);
  });
});
