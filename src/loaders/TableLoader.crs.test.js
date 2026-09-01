// © 2026 김용현
/**
 * 표 좌표 가져오기의 좌표계 처리 검증.
 *
 * 예전에는 무조건 위경도로 봤다. TM 좌표 표는 범위 검사(-90~90)에 걸려
 * 전 행이 버려지고 "유효한 좌표가 있는 행이 없습니다"만 떴다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { layerManager } from '../core/LayerManager.js';
import { tableLoader } from './TableLoader.js';

const SEOUL = [126.9784, 37.5667];

beforeAll(() => coordinateSystem.init());

function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('TableLoader 좌표계', () => {
  it('기본은 위경도다 (기존 동작)', () => {
    tableLoader.data = [{ 위도: SEOUL[1], 경도: SEOUL[0], 이름: '시청' }];
    const { layerId, featureCount } = tableLoader.createPointLayer('위도', '경도', '시청');
    expect(featureCount).toBe(1);
    expect(firstCoordOf(layerId)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(layerId);
    tableLoader.clear();
  });

  it('TM 좌표계를 고르면 그 좌표계로 변환한다', () => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
    tableLoader.data = [{ Y: y, X: x, 이름: '시청' }];
    const { layerId, featureCount } = tableLoader.createPointLayer('Y', 'X', '시청', 'EPSG:5186');
    expect(featureCount).toBe(1);
    const [mx, my] = firstCoordOf(layerId);
    expect(mx).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(my).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(layerId);
    tableLoader.clear();
  });

  it('TM 좌표를 위경도로 읽지 않는다 — 예전에는 전 행이 버려졌다', () => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
    tableLoader.data = [{ Y: y, X: x }];
    expect(() => tableLoader.createPointLayer('Y', 'X', '버려짐')).toThrow(/유효한 좌표/);
    tableLoader.clear();
  });

  it('레이어에 원본 좌표계를 기록한다', () => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:5186', SEOUL);
    tableLoader.data = [{ Y: y, X: x }];
    const { layerId } = tableLoader.createPointLayer('Y', 'X', '기록', 'EPSG:5186');
    expect(layerManager.getLayer(layerId).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(layerId);
    tableLoader.clear();
  });
});
