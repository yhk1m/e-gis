// © 2026 김용현
/**
 * CrsDetector - 공간데이터의 원본 좌표계를 알아낸다.
 *
 * 지도·DOM·비동기에 의존하지 않는 순수 모듈이다. 로더 다섯 종(GeoJSON·Shapefile·
 * GeoPackage·표·DEM)이 형식마다 가진 근거를 이 한 곳에 넘기고 같은 규칙으로 판정받는다.
 *
 * 판정 순서:
 *   1. 명시적 근거 — .prj의 EPSG 코드, GeoPackage srs_id, GeoJSON crs 멤버
 *   2. .prj 투영 파라미터가 알려진 좌표계와 일치
 *   3. 좌표 역검증 — 후보로 4326에 되돌려 한국 영역에 떨어지는지 본다
 */
import { coordinateSystem } from './CoordinateSystem.js';

/**
 * 숫자 EPSG 코드를 'EPSG:xxxx' 로 바꾼다.
 * 우리가 변환할 수 없는 좌표계라면 근거로 삼지 않는다(null).
 * 32767은 GeoTIFF에서 "사용자 정의"를 뜻하므로 코드가 아니다.
 */
export function epsgFromNumber(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n === 32767) return null;
  const code = 'EPSG:' + n;
  return coordinateSystem.isSupported(code) ? code : null;
}

/**
 * .prj(WKT)에서 좌표계 자신의 EPSG 코드를 읽는다.
 *
 * WKT는 타원체·데이텀·투영법이 저마다 AUTHORITY를 달고 있고, 좌표계 자신의
 * AUTHORITY는 맨 끝에 온다. 그래서 마지막 것을 쓴다.
 */
export function parseEpsgFromPrj(prj) {
  if (!prj || typeof prj !== 'string') return null;
  const matches = [...prj.matchAll(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/gi)];
  if (matches.length === 0) return null;
  return epsgFromNumber(matches[matches.length - 1][1]);
}

/**
 * GeoJSON의 crs 멤버를 읽는다.
 * 2016년 규격에서 빠졌지만 국내 공공데이터에는 아직 흔하다.
 * 'urn:ogc:def:crs:EPSG::5186' 과 'EPSG:5186' 둘 다 받는다.
 */
export function parseEpsgFromGeoJsonCrs(crs) {
  if (!crs) return null;
  const name = typeof crs === 'string' ? crs : crs?.properties?.name;
  if (typeof name !== 'string') return null;
  const m = name.match(/EPSG:{1,2}(\d+)/i);
  return m ? epsgFromNumber(m[1]) : null;
}

/**
 * 타원체 이름을 한 낱말로 줄인다.
 * WKT('GRS_1980')와 proj4('+ellps=GRS80')의 표기가 달라 그대로는 비교되지 않는다.
 */
function normalizeEllipsoid(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  if (s.includes('bessel')) return 'bessel';
  if (s.includes('grs')) return 'grs80';
  if (s.includes('wgs')) return 'wgs84';
  return null;
}

function numberFrom(text, pattern) {
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * .prj(WKT)에서 투영 파라미터를 뽑는다.
 * @returns {{lon0:number, lat0:number, x0:number, y0:number, k:number, ellps:string}|null}
 */
export function parsePrjParams(prj) {
  if (!prj || typeof prj !== 'string') return null;
  const lon0 = numberFrom(prj, /"?central_meridian"?\s*,\s*(-?[\d.]+)/i);
  const lat0 = numberFrom(prj, /"?latitude_of_origin"?\s*,\s*(-?[\d.]+)/i);
  const x0 = numberFrom(prj, /"?false_easting"?\s*,\s*(-?[\d.]+)/i);
  const y0 = numberFrom(prj, /"?false_northing"?\s*,\s*(-?[\d.]+)/i);
  const k = numberFrom(prj, /"?scale_factor"?\s*,\s*(-?[\d.]+)/i);
  if (lon0 === undefined || x0 === undefined || y0 === undefined) return null;
  const spheroid = prj.match(/SPHEROID\s*\[\s*"([^"]+)"/i);
  return {
    lon0,
    lat0: lat0 === undefined ? 0 : lat0,
    x0,
    y0,
    k: k === undefined ? 1 : k,
    ellps: normalizeEllipsoid(spheroid ? spheroid[1] : prj)
  };
}

/**
 * CRS_DEFINITIONS의 proj4 문자열에서 같은 모양의 파라미터를 뽑는다.
 * 비교용 표를 따로 두면 정의와 어긋나므로 정의에서 파생시킨다.
 */
function paramsOfDefinition(code) {
  const def = coordinateSystem.getCRSInfo(code);
  if (!def) return null;
  const s = def.proj4;
  const utm = s.match(/\+proj=utm[\s\S]*?\+zone=(\d+)/);
  if (utm) {
    return {
      lon0: 6 * Number(utm[1]) - 183,
      lat0: 0,
      x0: 500000,
      y0: 0,
      k: 0.9996,
      ellps: normalizeEllipsoid(s.includes('+datum=WGS84') ? 'wgs84' : s)
    };
  }
  // 경위도·메르카토르는 투영 파라미터로 맞출 대상이 아니다
  if (!s.includes('+proj=tmerc')) return null;
  const get = (key) => numberFrom(s, new RegExp('\\+' + key + '=(-?[\\d.]+)'));
  const ell = s.match(/\+ellps=(\w+)/);
  const lat0 = get('lat_0');
  const k = get('k');
  return {
    lon0: get('lon_0'),
    lat0: lat0 === undefined ? 0 : lat0,
    x0: get('x_0'),
    y0: get('y_0'),
    k: k === undefined ? 1 : k,
    ellps: normalizeEllipsoid(ell ? ell[1] : s)
  };
}

// 중앙경선 허용오차. 5174(127.0028902…)와 2097(127.0)의 차이가 0.00289도라
// 이보다 촘촘해야 둘이 갈린다.
const LON_TOLERANCE = 0.0005;

/**
 * 투영 파라미터로 좌표계를 맞춘다.
 * @param {{lon0:number, lat0:number, x0:number, y0:number, k:number, ellps:string}|null} params
 * @returns {string|null} 'EPSG:5186' 같은 코드, 못 맞추면 null
 */
export function matchByProjParams(params) {
  if (!params || typeof params.lon0 !== 'number') return null;
  for (const { code } of coordinateSystem.getAvailableCRS()) {
    const def = paramsOfDefinition(code);
    if (!def) continue;
    if (def.ellps && params.ellps && def.ellps !== params.ellps) continue;
    if (Math.abs(def.lon0 - params.lon0) > LON_TOLERANCE) continue;
    if (Math.abs(def.lat0 - params.lat0) > LON_TOLERANCE) continue;
    if (Math.abs(def.x0 - params.x0) > 1) continue;
    if (Math.abs(def.y0 - params.y0) > 1) continue;
    if (Math.abs(def.k - params.k) > 1e-6) continue;
    return code;
  }
  return null;
}
