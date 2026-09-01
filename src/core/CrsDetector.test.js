// © 2026 김용현
/**
 * 좌표계 판정 검증.
 *
 * 명시적 근거(EPSG 코드) → 투영 파라미터 → 좌표 역검증 순으로 판정한다.
 * 이 파일은 그 순서와 각 단계의 경계를 못박는다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import proj4 from 'proj4';
import { coordinateSystem } from './CoordinateSystem.js';
import {
  parseEpsgFromPrj,
  parseEpsgFromGeoJsonCrs,
  epsgFromNumber,
  parsePrjParams,
  matchByProjParams,
  detectCrs,
  sampleCoordsFromGeoJSON
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

const SEOUL = [126.9784, 37.5667];      // 서울시청
const BUSAN = [129.0756, 35.1796];      // 부산시청
const PARIS = [2.3522, 48.8566];

// 위경도 지점을 해당 좌표계 값으로 옮긴다
function at(code, lonlat) {
  return proj4('EPSG:4326', code, lonlat);
}

describe('detectCrs — 명시적 근거 우선', () => {
  it('.prj의 EPSG 코드가 좌표보다 우선한다', () => {
    // 좌표는 5186처럼 생겼지만 .prj는 5179라고 말한다 → .prj를 따른다
    const r = detectCrs({
      prj: 'PROJCS["뭐든",AUTHORITY["EPSG","5179"]]',
      sampleCoords: [at('EPSG:5186', SEOUL)]
    });
    expect(r.crs).toBe('EPSG:5179');
    expect(r.confidence).toBe('certain');
  });

  it('GeoPackage srs_id를 따른다', () => {
    const r = detectCrs({ srsId: 5187, sampleCoords: [at('EPSG:5187', BUSAN)] });
    expect(r.crs).toBe('EPSG:5187');
    expect(r.confidence).toBe('certain');
  });

  it('EPSG 코드가 없으면 투영 파라미터로 정한다', () => {
    const r = detectCrs({
      prj: PRJ_5186_NO_AUTHORITY,
      sampleCoords: [at('EPSG:5186', SEOUL)]
    });
    expect(r.crs).toBe('EPSG:5186');
    expect(r.confidence).toBe('certain');
  });
});

describe('detectCrs — 좌표 역검증', () => {
  it('위경도 자료는 4326 하나로 확정된다', () => {
    const r = detectCrs({ sampleCoords: [SEOUL, BUSAN] });
    expect(r.crs).toBe('EPSG:4326');
    expect(r.confidence).toBe('certain');
  });

  it('TM 자료는 후보가 여럿이라 애매하다 — 5186과 5181이 함께 남는다', () => {
    // 5186과 5181은 y_0만 10만 다르다. 둘 다 한국 안에 떨어지므로
    // 좌표만으로는 갈릴 수 없다. 사용자가 미리보기로 고른다.
    const r = detectCrs({ sampleCoords: [at('EPSG:5186', SEOUL), at('EPSG:5186', BUSAN)] });
    expect(r.confidence).toBe('ambiguous');
    const codes = r.candidates.map((c) => c.crs);
    expect(codes).toContain('EPSG:5186');
    expect(codes).toContain('EPSG:5181');
    // 정의 순서상 5186이 앞이므로 기본 선택이 된다
    expect(r.crs).toBe('EPSG:5186');
  });

  it('후보마다 변환 결과 중심을 함께 준다 (미리보기 설명용)', () => {
    const r = detectCrs({ sampleCoords: [at('EPSG:5186', SEOUL)] });
    const picked = r.candidates.find((c) => c.crs === 'EPSG:5186');
    expect(picked.center[0]).toBeCloseTo(SEOUL[0], 3);
    expect(picked.center[1]).toBeCloseTo(SEOUL[1], 3);
    expect(picked.name).toContain('중부원점');
  });

  it('단위가 안 맞는 후보는 뺀다 — 경위도 값에 미터 좌표계를 주지 않는다', () => {
    const r = detectCrs({ sampleCoords: [PARIS] });
    expect(r.candidates.map((c) => c.crs)).not.toContain('EPSG:3857');
  });

  it('한국 밖이면 전 지구 범위로 한 번 더 거른다', () => {
    const r = detectCrs({ sampleCoords: [PARIS] });
    expect(r.crs).toBe('EPSG:4326');
    expect(r.confidence).toBe('certain');
    expect(r.reason).toContain('전 지구');
  });

  it('아무 근거도 없으면 unknown이고 기본값은 4326이다', () => {
    const r = detectCrs({ sampleCoords: [] });
    expect(r.confidence).toBe('unknown');
    expect(r.crs).toBe('EPSG:4326');
    expect(r.candidates.length).toBeGreaterThan(10);
  });

  it('말이 안 되는 좌표도 터지지 않는다', () => {
    const r = detectCrs({ sampleCoords: [[1e12, -1e12]] });
    expect(r.confidence).toBe('unknown');
  });
});

describe('sampleCoordsFromGeoJSON', () => {
  it('도형 종류와 상관없이 첫 좌표를 뽑는다', () => {
    const gj = {
      type: 'FeatureCollection',
      features: [
        { geometry: { type: 'Point', coordinates: [1, 2] } },
        { geometry: { type: 'LineString', coordinates: [[3, 4], [5, 6]] } },
        { geometry: { type: 'Polygon', coordinates: [[[7, 8], [9, 10]]] } },
        { geometry: { type: 'MultiPolygon', coordinates: [[[[11, 12], [13, 14]]]] } }
      ]
    };
    expect(sampleCoordsFromGeoJSON(gj)).toEqual([[1, 2], [3, 4], [7, 8], [11, 12]]);
  });

  it('개수 상한을 지킨다', () => {
    const features = Array.from({ length: 50 }, (_, i) => ({
      geometry: { type: 'Point', coordinates: [i, i] }
    }));
    expect(sampleCoordsFromGeoJSON({ features }, 20)).toHaveLength(20);
  });

  it('빈 값과 지오메트리 없는 피처를 건너뛴다', () => {
    expect(sampleCoordsFromGeoJSON(null)).toEqual([]);
    expect(sampleCoordsFromGeoJSON({ features: [{ geometry: null }, {}] })).toEqual([]);
  });
});
