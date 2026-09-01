// © 2026 김용현
/**
 * Shapefile 로더의 좌표계 처리 검증.
 *
 * shp 바이너리를 만들지 않고 createLayerFromGeoJSON에 직접 넣어 검증한다.
 * (shp 파싱은 shpjs의 몫이고, 여기서 볼 것은 좌표계 처리다.)
 *
 * 예전에는 .prj를 문자열 부분일치로 훑어 EPSG:5185를 반환했는데
 * 그 좌표계는 proj4에 등록조차 없어 변환이 조용히 깨졌다.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import proj4 from 'proj4';
import { fromLonLat } from 'ol/proj';
import { coordinateSystem } from '../core/CoordinateSystem.js';
import { setCrsPrompt } from '../core/crsResolver.js';
import { layerManager } from '../core/LayerManager.js';
import { shapefileLoader } from './ShapefileLoader.js';

const SEOUL = [126.9784, 37.5667];

const PRJ_5186 = 'PROJCS["Korea_2000_Korea_Central_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",127.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0],AUTHORITY["EPSG","5186"]]';

// 서부원점. 예전 코드가 EPSG:5185를 반환하면서 정의가 없어 깨지던 자리다.
const PRJ_5185 = 'PROJCS["Korea_2000_Korea_West_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",125.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0],AUTHORITY["EPSG","5185"]]';

beforeAll(() => coordinateSystem.init());
beforeEach(() => setCrsPrompt(null));

function pointCollection(coords) {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} }]
  };
}

function firstCoordOf(layerId) {
  return layerManager.getLayer(layerId).source.getFeatures()[0].getGeometry().getCoordinates();
}

describe('ShapefileLoader 좌표계', () => {
  it('.prj의 EPSG 코드로 읽는다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '학교', PRJ_5186);
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(id);
  });

  it('서부원점(5185)도 변환된다 — 예전에는 정의가 없어 깨졌다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5185', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '서부', PRJ_5185);
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    layerManager.removeLayer(id);
  });

  it('.prj가 없으면 좌표 역검증으로 넘어간다', async () => {
    const prompt = vi.fn().mockResolvedValue('EPSG:5186');
    setCrsPrompt(prompt);
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, 'prj없음', null);
    expect(prompt).toHaveBeenCalledOnce();
    expect(firstCoordOf(id)[0]).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    layerManager.removeLayer(id);
  });

  it('취소하면 레이어를 만들지 않는다', async () => {
    setCrsPrompt(vi.fn().mockResolvedValue(null));
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '취소', null);
    expect(id).toBeNull();
  });

  it('shpjs가 .prj로 이미 변환해 준 좌표를 다시 변환하지 않는다', async () => {
    // shpjs는 .prj가 있으면 스스로 WGS84로 재투영해서 준다.
    // 그때 .prj는 "원본이 무엇이었나"를 말할 뿐, 손에 든 좌표를 설명하지 않는다.
    // 이걸 놓치면 이미 경위도인 값을 5186 미터로 읽어 590km 밖에 그린다.
    // (서울 LSMD_CONT_UM730 파일로 실측한 값이다.)
    const gj = pointCollection(SEOUL);
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '이중변환', PRJ_5186);
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:4326');
    layerManager.removeLayer(id);
  });

  it('shpjs가 변환하지 못해 원본 TM이 그대로 오면 .prj를 근거로 쓴다', async () => {
    // .prj의 좌표계를 shpjs의 proj4가 모르면 재투영 없이 원본을 준다.
    // 그때는 .prj가 손에 든 좌표의 설명이 맞다.
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '원본TM', PRJ_5186);
    const [x, y] = firstCoordOf(id);
    expect(x).toBeCloseTo(fromLonLat(SEOUL)[0], 0);
    expect(y).toBeCloseTo(fromLonLat(SEOUL)[1], 0);
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(id);
  });

  it('판정한 좌표계를 레이어에 기록한다', async () => {
    const gj = pointCollection(proj4('EPSG:4326', 'EPSG:5186', SEOUL));
    const id = await shapefileLoader.createLayerFromGeoJSON(gj, '기록', PRJ_5186);
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(id);
  });
});
