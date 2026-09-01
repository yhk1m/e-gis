// © 2026 김용현
/**
 * GeoPackage 로더의 좌표계 처리 검증.
 *
 * 예전에는 'EPSG:' + srs_id 를 그대로 썼다. proj4에 없는 코드면 변환이 실패했다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { setCrsPrompt } from '../core/crsResolver.js';
import { layerManager } from '../core/LayerManager.js';
import { geopackageLoader } from './GeoPackageLoader.js';

const SEOUL = [126.9784, 37.5667];

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

function featureList(coords) {
  return [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }];
}

function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('GeoPackageLoader 좌표계', () => {
  it('srs_id를 좌표계로 쓴다', async () => {
    const id = await geopackageLoader.createLayerFromFeatures(
      featureList(proj4('EPSG:4326', 'EPSG:5186', SEOUL)), '가게', 5186
    );
    expect(firstCoordOf(id)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(id);
  });

  it('우리가 모르는 srs_id면 좌표로 판정한다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5186');
    setCrsPrompt(prompt);
    // 31370(벨기에)은 정의에 없다 → 근거로 삼지 않고 역검증으로 넘어간다
    const id = await geopackageLoader.createLayerFromFeatures(
      featureList(proj4('EPSG:4326', 'EPSG:5186', SEOUL)), '수수께끼', 31370
    );
    expect(prompt).toHaveBeenCalledOnce();
    expect(firstCoordOf(id)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(id);
  });

  it('4326 자료는 묻지 않고 통과한다', async () => {
    const prompt = vi.fn();
    setCrsPrompt(prompt);
    const id = await geopackageLoader.createLayerFromFeatures(featureList(SEOUL), '위경도', 4326);
    expect(prompt).not.toHaveBeenCalled();
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:4326');
    layerManager.removeLayer(id);
  });

  it('취소하면 레이어를 만들지 않는다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const id = await geopackageLoader.createLayerFromFeatures(
      featureList(proj4('EPSG:4326', 'EPSG:5186', SEOUL)), '취소', 0
    );
    expect(id).toBeNull();
  });
});
