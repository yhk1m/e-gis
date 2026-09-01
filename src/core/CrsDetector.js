// © 2026 김용현
/**
 * CrsDetector - 공간데이터의 원본 좌표계를 알아낸다.
 *
 * 지도·DOM·비동기에 의존하지 않는 순수 모듈이다. 로더 다섯 종(GeoJSON·Shapefile·
 * GeoPackage·표·DEM)이 형식마다 가진 근거를 이 한 곳에 넘기고 같은 규칙으로 판정받는다.
 *
 * 판정 순서:
 *   1. 명시적 근거 — .prj의 EPSG 코드, GeoPackage srs_id, GeoJSON crs 멤버, GeoTIFF EPSG 코드.
 *      단, 표본 좌표가 있는데 그 좌표계로는 한국 밖에 떨어지고 다른 후보는 한국 안에
 *      떨어뜨린다면(메타데이터와 실제 좌표가 어긋난 파일) 조용히 확정하지 않고 ambiguous로
 *      낮춰 사용자에게 되묻는다. 해외 자료는 이 검사에 걸리지 않는다.
 *   2. .prj 투영 파라미터가 알려진 좌표계와 일치
 *   3. 좌표 역검증 — 후보로 4326에 되돌려 한국 영역에 떨어지는지 본다
 */
import proj4 from 'proj4';
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

// 각도 허용오차 — 중앙경선(lon0)뿐 아니라 원점위도(lat0) 비교에도 쓴다.
// 5174(127.0028902…)와 2097(127.0)의 차이가 0.00289도라 이보다 촘촘해야 둘이 갈린다.
const ANGLE_TOLERANCE = 0.0005;

/**
 * 투영 파라미터로 좌표계를 맞춘다.
 *
 * 조건에 맞는 정의가 **하나일 때만** 확정한다. 5179(GRS80)와 5178(bessel),
 * 5181과 2097처럼 투영 수치가 똑같고 타원체만 다른 짝이 있어서, 타원체를 모르는
 * 채로 먼저 오는 것을 고르면 조용히 다른 데이텀으로 확정된다(500m급 오차).
 * 갈리지 않으면 null을 주어 좌표 역검증에 넘긴다 — 거기서 후보로 남아
 * 사용자가 미리보기로 고르게 된다.
 *
 * @param {{lon0:number, lat0:number, x0:number, y0:number, k:number, ellps:string}|null} params
 * @returns {string|null} 'EPSG:5186' 같은 코드, 못 맞추거나 갈리지 않으면 null
 */
export function matchByProjParams(params) {
  if (!params || typeof params.lon0 !== 'number') return null;
  const matches = [];
  for (const { code } of coordinateSystem.getAvailableCRS()) {
    const def = paramsOfDefinition(code);
    if (!def) continue;
    if (def.ellps && params.ellps && def.ellps !== params.ellps) continue;
    if (Math.abs(def.lon0 - params.lon0) > ANGLE_TOLERANCE) continue;
    if (Math.abs(def.lat0 - params.lat0) > ANGLE_TOLERANCE) continue;
    if (Math.abs(def.x0 - params.x0) > 1) continue;
    if (Math.abs(def.y0 - params.y0) > 1) continue;
    if (Math.abs(def.k - params.k) > 1e-6) continue;
    matches.push(code);
  }
  return matches.length === 1 ? matches[0] : null;
}

// 남한과 주변. 한국 자료가 압도적으로 많으므로 이 범위를 먼저 본다.
const KOREA_BOUNDS = { minLon: 124, maxLon: 132, minLat: 33, maxLat: 43 };
// 한국 안에서 후보가 하나도 안 남을 때(해외 자료) 쓰는 완화 범위
const WORLD_BOUNDS = { minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 };

/**
 * 표본 좌표가 경위도처럼 생겼는지 본다.
 * 미터 좌표계 값은 이 범위를 훌쩍 넘고, 경위도 값은 절대 넘지 않는다.
 */
function looksLikeDegrees(coords) {
  return coords.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90);
}

/**
 * 단위가 표본과 맞는 후보인지 본다.
 * 이 검사가 없으면 파리 좌표 [2.35, 48.85]가 3857로도 "세계 안"이라 후보가 둘이 된다.
 */
function unitsPlausible(code, degreeish) {
  const units = coordinateSystem.getCRSInfo(code)?.units;
  return degreeish ? units === 'degrees' : units === 'meters';
}

/**
 * 후보 좌표계로 표본을 4326에 되돌려, 결과가 주어진 범위 안에 떨어지는지 검증한다.
 * 좌표 크기로 짐작하는 대신 되돌려 확인하므로 범위가 겹치는 좌표계도 갈린다.
 *
 * @returns {Array<{crs:string, name:string, center:number[]}>} 살아남은 후보
 */
export function validateByReprojection(sampleCoords, bounds) {
  if (!Array.isArray(sampleCoords) || sampleCoords.length === 0) return [];
  const degreeish = looksLikeDegrees(sampleCoords);
  const survivors = [];

  for (const { code, name } of coordinateSystem.getAvailableCRS()) {
    if (!unitsPlausible(code, degreeish)) continue;

    let sumLon = 0;
    let sumLat = 0;
    let ok = true;

    for (const coord of sampleCoords) {
      let lon;
      let lat;
      try {
        [lon, lat] = proj4(code, 'EPSG:4326', coord);
      } catch (error) {
        ok = false;
        break;
      }
      if (!Number.isFinite(lon) || !Number.isFinite(lat) ||
          lon < bounds.minLon || lon > bounds.maxLon ||
          lat < bounds.minLat || lat > bounds.maxLat) {
        ok = false;
        break;
      }
      sumLon += lon;
      sumLat += lat;
    }

    if (ok) {
      survivors.push({
        crs: code,
        name,
        center: [sumLon / sampleCoords.length, sumLat / sampleCoords.length]
      });
    }
  }

  return survivors;
}

/** 후보를 하나도 못 좁혔을 때 사용자에게 보여줄 전체 목록 */
function allCandidates() {
  return coordinateSystem.getAvailableCRS().map(({ code, name }) => ({
    crs: code,
    name,
    center: null
  }));
}

function certain(crs, reason) {
  const info = coordinateSystem.getCRSInfo(crs);
  return {
    crs,
    confidence: 'certain',
    reason,
    candidates: [{ crs, name: info ? info.name : crs, center: null }]
  };
}

/**
 * 명시적 근거(.prj EPSG 코드·srsId·GeoJSON crs 멤버·GeoTIFF EPSG 코드)로 정한
 * 좌표계를 확정한다 — 단, 표본 좌표와 모순되면 그대로 확정하지 않는다.
 *
 * 모순이란: 선언된 좌표계로 표본을 4326에 되돌리면 한국 밖에 떨어지는데, 다른 후보
 * 중에는 한국 안에 떨어뜨리는 것이 하나라도 있다는 뜻이다 — 메타데이터가 실제 좌표와
 * 어긋난 파일에서 벌어진다. 예를 들어 .prj는 5179라는데 좌표는 5186 값인 경우,
 * 그대로 확정하면 결과가 대만 남쪽 바다에 찍혀도 확인 창 없이 조용히 넘어간다.
 *
 * 해외 자료는 어떤 후보도 한국에 안 떨어지므로(alternatives가 비므로) 이 검사가
 * 손대지 않는다 — 그대로 certain으로 남는다. 표본이 없으면 애초에 검사할 수 없으니
 * 마찬가지로 certain이다.
 */
function certainUnlessContradicted(crs, reason, sampleCoords) {
  const info = coordinateSystem.getCRSInfo(crs);
  const declared = { crs, name: info ? info.name : crs, center: null };

  if (Array.isArray(sampleCoords) && sampleCoords.length > 0) {
    const withinKorea = validateByReprojection(sampleCoords, KOREA_BOUNDS);
    const declaredOk = withinKorea.some((c) => c.crs === crs);
    if (!declaredOk) {
      const alternatives = withinKorea.filter((c) => c.crs !== crs);
      if (alternatives.length > 0) {
        return {
          crs,
          confidence: 'ambiguous',
          reason: reason + '라는데 좌표가 한국 밖에 떨어진다',
          candidates: [declared, ...alternatives]
        };
      }
    }
  }

  return { crs, confidence: 'certain', reason, candidates: [declared] };
}

/**
 * 원본 좌표계를 판정한다.
 *
 * @param {Object} input - 형식마다 있는 근거만 넣는다
 * @param {string} [input.prj] - Shapefile .prj 내용(WKT)
 * @param {number} [input.srsId] - GeoPackage gpkg_geometry_columns.srs_id
 * @param {Object|string} [input.geojsonCrs] - GeoJSON crs 멤버
 * @param {number} [input.epsgCode] - GeoTIFF GeoKeys의 EPSG 코드
 * @param {Object} [input.projParams] - {lon0, lat0, x0, y0, k, ellps} (GeoTIFF GeoKeys 등)
 * @param {number[][]} [input.sampleCoords] - 원본 좌표계 그대로의 표본 좌표
 * @returns {{crs:string, confidence:'certain'|'ambiguous'|'unknown', reason:string,
 *            candidates:Array<{crs:string, name:string, center:number[]|null}>}}
 */
export function detectCrs(input = {}) {
  const { prj, srsId, geojsonCrs, epsgCode, projParams, sampleCoords = [] } = input;

  // 1. 명시적 근거 — 표본 좌표와 모순되면 certainUnlessContradicted가 ambiguous로 낮춘다
  const fromPrj = parseEpsgFromPrj(prj);
  if (fromPrj) return certainUnlessContradicted(fromPrj, '.prj의 EPSG 코드', sampleCoords);

  const fromSrsId = epsgFromNumber(srsId);
  if (fromSrsId) return certainUnlessContradicted(fromSrsId, 'GeoPackage srs_id', sampleCoords);

  const fromGeoJson = parseEpsgFromGeoJsonCrs(geojsonCrs);
  if (fromGeoJson) return certainUnlessContradicted(fromGeoJson, 'GeoJSON crs 멤버', sampleCoords);

  const fromEpsgCode = epsgFromNumber(epsgCode);
  if (fromEpsgCode) return certainUnlessContradicted(fromEpsgCode, 'GeoTIFF EPSG 코드', sampleCoords);

  // 2. 투영 파라미터
  const byParams = matchByProjParams(parsePrjParams(prj) || projParams || null);
  if (byParams) return certain(byParams, '투영 파라미터');

  // 3. 좌표 역검증
  let candidates = validateByReprojection(sampleCoords, KOREA_BOUNDS);
  let scope = '한국 영역';
  if (candidates.length === 0) {
    candidates = validateByReprojection(sampleCoords, WORLD_BOUNDS);
    scope = '전 지구 영역';
  }

  if (candidates.length === 1) {
    return {
      crs: candidates[0].crs,
      confidence: 'certain',
      reason: '좌표 역검증 (' + scope + '에 맞는 후보 하나)',
      candidates
    };
  }
  if (candidates.length > 1) {
    return {
      crs: candidates[0].crs,
      confidence: 'ambiguous',
      reason: '좌표 역검증 (' + scope + '에 맞는 후보 ' + candidates.length + '개)',
      candidates
    };
  }

  return {
    crs: 'EPSG:4326',
    confidence: 'unknown',
    reason: '판단할 근거가 없다',
    candidates: allCandidates()
  };
}

/**
 * GeoJSON에서 판정용 표본 좌표를 뽑는다.
 * 도형 종류마다 좌표 중첩 깊이가 달라 첫 좌표까지 파고든다.
 */
export function sampleCoordsFromGeoJSON(geojson, max = 20) {
  const features = geojson && geojson.features;
  if (!Array.isArray(features)) return [];
  const out = [];
  for (const feature of features) {
    let c = feature && feature.geometry && feature.geometry.coordinates;
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
    if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      out.push([c[0], c[1]]);
    }
    if (out.length >= max) break;
  }
  return out;
}
