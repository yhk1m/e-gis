// © 2026 김용현
/**
 * GeoJSON 로더의 좌표계 처리 검증.
 *
 * 예전에는 dataProjection이 EPSG:4326으로 박혀 있어 TM 좌표 자료가
 * 지구 반대편에 찍혔다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { setCrsPrompt } from '../core/crsResolver.js';
import { layerManager } from '../core/LayerManager.js';
import { geojsonLoader } from './GeoJSONLoader.js';

const SEOUL = [126.9784, 37.5667];

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

function pointCollection(coords, extra = {}) {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }],
    ...extra
  };
}

// 레이어의 첫 피처 좌표(3857)를 꺼낸다
function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('GeoJSONLoader 좌표계', () => {
  it('위경도 자료는 그대로 제자리에 놓인다', async () => {
    const id = await geojsonLoader.loadFromString(pointCollection(SEOUL), '서울.geojson');
    const [x, y] = firstCoordOf(id);
    const [ex, ey] = fromLonLat(SEOUL);
    expect(x).toBeCloseTo(ex, 0);
    expect(y).toBeCloseTo(ey, 0);
    layerManager.removeLayer(id);
  });

  it('crs 멤버가 있으면 그 좌표계로 읽는다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL), {
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::5186' } }
    });
    const id = await geojsonLoader.loadFromString(gj, '중부원점.geojson');
    const [x, y] = firstCoordOf(id);
    const [ex, ey] = fromLonLat(SEOUL);
    expect(x).toBeCloseTo(ex, 0);
    expect(y).toBeCloseTo(ey, 0);
    layerManager.removeLayer(id);
  });

  it('판정한 좌표계를 레이어에 기록한다', async () => {
    const gj = pointCollection(SEOUL);
    const id = await geojsonLoader.loadFromString(gj, '서울.geojson');
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:4326');
    layerManager.removeLayer(id);
  });

  it('애매하면 프롬프트가 고른 좌표계를 쓴다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue('EPSG:5186'));
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await geojsonLoader.loadFromString(gj, '수수께끼.geojson');
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(id);
  });

  it('취소하면 레이어를 만들지 않고 null을 준다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const before = layerManager.getAllLayers().length;
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await geojsonLoader.loadFromString(gj, '취소.geojson');
    expect(id).toBeNull();
    expect(layerManager.getAllLayers()).toHaveLength(before);
  });
});
