// © 2026 김용현
/**
 * 좌표계 판정 검증.
 *
 * 명시적 근거(EPSG 코드) → 투영 파라미터 → 좌표 역검증 순으로 판정한다.
 * 이 파일은 그 순서와 각 단계의 경계를 못박는다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { coordinateSystem } from './CoordinateSystem.js';
import {
  parseEpsgFromPrj,
  parseEpsgFromGeoJsonCrs,
  epsgFromNumber
} from './CrsDetector.js';

beforeAll(() => coordinateSystem.init());

// 국토지리정보원 자료에 흔한 형태. 안쪽 AUTHORITY(타원체·데이텀)가 먼저 나오고
// 좌표계 자신의 AUTHORITY가 맨 끝에 온다.
const PRJ_5186 = 'PROJCS["Korea_2000_Korea_Central_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101,AUTHORITY["EPSG","7019"]],' +
  'AUTHORITY["EPSG","6737"]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433],' +
  'AUTHORITY["EPSG","4737"]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",127.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0],AUTHORITY["EPSG","5186"]]';

describe('parseEpsgFromPrj', () => {
  it('맨 바깥 AUTHORITY를 읽는다 (안쪽 타원체 코드가 아니라)', () => {
    expect(parseEpsgFromPrj(PRJ_5186)).toBe('EPSG:5186');
  });

  it('AUTHORITY가 없으면 null이다', () => {
    const prj = 'PROJCS["Korea_2000_Korea_Central_Belt",PROJECTION["Transverse_Mercator"]]';
    expect(parseEpsgFromPrj(prj)).toBeNull();
  });

  it('정의에 없는 코드는 받아들이지 않는다', () => {
    // 값은 읽히지만 우리가 변환할 수 없는 좌표계다
    const prj = 'PROJCS["Belge_Lambert_72",AUTHORITY["EPSG","31370"]]';
    expect(parseEpsgFromPrj(prj)).toBeNull();
  });

  it('빈 값에 터지지 않는다', () => {
    expect(parseEpsgFromPrj(null)).toBeNull();
    expect(parseEpsgFromPrj('')).toBeNull();
  });
});

describe('parseEpsgFromGeoJsonCrs', () => {
  it('OGC URN 형식을 읽는다', () => {
    const crs = { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::5186' } };
    expect(parseEpsgFromGeoJsonCrs(crs)).toBe('EPSG:5186');
  });

  it('짧은 형식을 읽는다', () => {
    const crs = { type: 'name', properties: { name: 'EPSG:5179' } };
    expect(parseEpsgFromGeoJsonCrs(crs)).toBe('EPSG:5179');
  });

  it('crs 멤버가 없으면 null이다', () => {
    expect(parseEpsgFromGeoJsonCrs(undefined)).toBeNull();
  });
});

describe('epsgFromNumber', () => {
  it('숫자 srs_id를 코드로 바꾼다', () => {
    expect(epsgFromNumber(5186)).toBe('EPSG:5186');
  });

  it('GeoTIFF의 user-defined(32767)는 근거가 아니다', () => {
    expect(epsgFromNumber(32767)).toBeNull();
  });

  it('정의에 없는 코드는 받아들이지 않는다', () => {
    expect(epsgFromNumber(31370)).toBeNull();
    expect(epsgFromNumber(0)).toBeNull();
    expect(epsgFromNumber(null)).toBeNull();
  });
});
