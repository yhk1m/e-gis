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
