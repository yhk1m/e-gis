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
  epsgFromNumber,
  parsePrjParams,
  matchByProjParams
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

// EPSG 코드 없이 파라미터만 있는 .prj — 정부 배포 자료에 흔하다
const PRJ_5186_NO_AUTHORITY = 'PROJCS["Korea_2000_Korea_Central_Belt",GEOGCS["GCS_Korea_2000",' +
  'DATUM["D_Korea_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",600000.0],' +
  'PARAMETER["Central_Meridian",127.0],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0]]';

const PRJ_5174_NO_AUTHORITY = 'PROJCS["Korean_1985_Modified_Central_Belt",GEOGCS["GCS_Korean_Datum_1985",' +
  'DATUM["D_Korean_Datum_1985",SPHEROID["Bessel_1841",6377397.155,299.1528128]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",200000.0],PARAMETER["False_Northing",500000.0],' +
  'PARAMETER["Central_Meridian",127.0028902777778],PARAMETER["Scale_Factor",1.0],' +
  'PARAMETER["Latitude_Of_Origin",38.0],UNIT["Meter",1.0]]';

const PRJ_UTM52N = 'PROJCS["WGS_1984_UTM_Zone_52N",GEOGCS["GCS_WGS_1984",' +
  'DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],' +
  'UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],' +
  'PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],' +
  'PARAMETER["Central_Meridian",129.0],PARAMETER["Scale_Factor",0.9996],' +
  'PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';

describe('parsePrjParams', () => {
  it('WKT 파라미터와 타원체를 뽑는다', () => {
    expect(parsePrjParams(PRJ_5186_NO_AUTHORITY)).toEqual({
      lon0: 127, lat0: 38, x0: 200000, y0: 600000, k: 1, ellps: 'grs80'
    });
  });

  it('타원체 이름으로 bessel을 알아본다', () => {
    expect(parsePrjParams(PRJ_5174_NO_AUTHORITY).ellps).toBe('bessel');
  });

  it('투영 파라미터가 없으면 null이다', () => {
    expect(parsePrjParams('GEOGCS["GCS_WGS_1984"]')).toBeNull();
  });
});

describe('matchByProjParams', () => {
  it('EPSG 코드 없는 중부원점 .prj를 5186으로 맞춘다', () => {
    expect(matchByProjParams(parsePrjParams(PRJ_5186_NO_AUTHORITY))).toBe('EPSG:5186');
  });

  it('타원체가 다르면 갈린다 — bessel 127.00289는 5174다', () => {
    expect(matchByProjParams(parsePrjParams(PRJ_5174_NO_AUTHORITY))).toBe('EPSG:5174');
  });

  it('중앙경선 0.0029도 차이로 2097과 5174를 구분한다', () => {
    const p2097 = { lon0: 127, lat0: 38, x0: 200000, y0: 500000, k: 1, ellps: 'bessel' };
    expect(matchByProjParams(p2097)).toBe('EPSG:2097');
  });

  it('UTM 52N을 알아본다', () => {
    expect(matchByProjParams(parsePrjParams(PRJ_UTM52N))).toBe('EPSG:32652');
  });

  it('아는 좌표계와 안 맞으면 null이다', () => {
    const belgium = { lon0: 4.367, lat0: 90, x0: 150000, y0: 5400000, k: 1, ellps: 'grs80' };
    expect(matchByProjParams(belgium)).toBeNull();
  });

  it('빈 값에 터지지 않는다', () => {
    expect(matchByProjParams(null)).toBeNull();
  });
});
