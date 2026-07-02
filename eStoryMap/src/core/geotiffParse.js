// © 2026 김용현
// eStoryMap/src/core/geotiffParse.js
// GeoTIFF 이미지 → demData — CRS 추론과 extent 3857 정렬. geotiff.js Image
// 인터페이스에만 의존(순수). 이식 원본: e-GIS DEMLoader.createDEMLayer 상단부
// (matchKoreanTM / guessProjection / toMercator / min-max 스캔).
import { transformExtent } from 'ol/proj';
import './proj.js'; // 한국 TM(5179/5186~5188) 등록 (부수효과)

/** 한국 TM 좌표계 추론 — EPSG 코드가 user-defined(32767)일 때 TM 파라미터로 판별. */
export function matchKoreanTM(geoKeys) {
  // GRS80 타원체 (한국 좌표계의 공통)
  const a = geoKeys.GeogSemiMajorAxisGeoKey;
  if (a && Math.abs(a - 6378137) > 0.1) return null;

  const lon = geoKeys.ProjNatOriginLongGeoKey;
  const lat = geoKeys.ProjNatOriginLatGeoKey;
  const fe = geoKeys.ProjFalseEastingGeoKey;
  const fn = geoKeys.ProjFalseNorthingGeoKey;
  const k = geoKeys.ProjScaleAtNatOriginGeoKey ?? 1;
  const near = (x, target, tol = 0.001) => x !== undefined && Math.abs(x - target) < tol;

  if (near(lat, 38) && near(fe, 200000) && near(fn, 600000) && near(k, 1)) {
    if (near(lon, 127)) return 'EPSG:5186';
    if (near(lon, 129)) return 'EPSG:5187';
    if (near(lon, 125)) return 'EPSG:5188';
  }
  if (near(lat, 38) && near(lon, 127.5) && near(fe, 1000000) && near(fn, 2000000) && near(k, 0.9996)) {
    return 'EPSG:5179';
  }
  return null;
}

/** GeoKeys → 소스 좌표계('EPSG:xxxx' | null). */
export function inferSourceProjection(geoKeys) {
  if (!geoKeys) return null;
  if (geoKeys.ProjectedCSTypeGeoKey && geoKeys.ProjectedCSTypeGeoKey !== 32767) {
    return `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
  }
  if (geoKeys.GeographicTypeGeoKey && geoKeys.GeographicTypeGeoKey !== 32767) {
    return `EPSG:${geoKeys.GeographicTypeGeoKey}`;
  }
  // 정부 GeoTIFF에서 흔히 EPSG 코드 없이 TM 파라미터만 채워짐
  if (geoKeys.ProjCoordTransGeoKey === 1) return matchKoreanTM(geoKeys);
  return null;
}

/** bbox 값으로 좌표계 추측. */
export function guessProjectionFromBbox(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  if (minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90) return 'EPSG:4326';
  // UTM/TM 범위(대략 100000~1000000)가 3857 범위에 포함되므로 UTM을 먼저 검사한다.
  // (원본 e-GIS DEMLoader.guessProjection은 3857을 먼저 검사해 UTM 분기가 도달 불가했다.)
  if (minX > 100000 && maxX < 1000000 && minY > 0) return 'UTM';
  if (Math.abs(minX) > 180 && Math.abs(maxX) < 20037509 &&
      Math.abs(minY) > 90 && Math.abs(maxY) < 20037509) return 'EPSG:3857';
  return null;
}

/** 4326 bbox → 3857 수동 웹메르카토르 변환(원본 toMercator). */
export function toMercatorExtent(bbox) {
  const toM = (lon, lat) => {
    const x = lon * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;
    return [x, y];
  };
  const min = toM(bbox[0], bbox[1]);
  const max = toM(bbox[2], bbox[3]);
  return [min[0], min[1], max[0], max[1]];
}

/** bbox를 EPSG:3857로 정렬. 변환 실패 시 bbox 추측 폴백(원본 createDEMLayer 흐름). */
export function extentTo3857(bbox, sourceProj) {
  if (sourceProj === 'EPSG:3857') return bbox;
  if (sourceProj) {
    try {
      return transformExtent(bbox, sourceProj, 'EPSG:3857');
    } catch (e) {
      console.warn('좌표계 변환 실패, bbox로 추측:', e);
    }
  }
  const guessed = guessProjectionFromBbox(bbox);
  if (guessed === 'EPSG:4326') return toMercatorExtent(bbox);
  return bbox; // 3857 추정이거나 알 수 없음 — 그대로 사용(원본 동작)
}

/** 밴드에서 min/max 계산(노데이터·NaN·비유한 제외). */
export function computeMinMax(data, noDataValue) {
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v !== noDataValue && !Number.isNaN(v) && Number.isFinite(v)) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  return { minVal, maxVal };
}

/** GeoTIFF 이미지 객체 → demData. */
export async function demDataFromGeoTiff(image) {
  const rasters = await image.readRasters();
  const data = rasters[0]; // 첫 밴드 = 고도
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const sourceProj = inferSourceProjection(image.getGeoKeys());
  const extent = extentTo3857(bbox, sourceProj);
  const noDataValue = image.getGDALNoData() || -9999;
  const { minVal, maxVal } = computeMinMax(data, noDataValue);
  return { data, width, height, extent, minVal, maxVal, noDataValue };
}
