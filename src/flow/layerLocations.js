// © 2026 김용현
/**
 * 기준 레이어(행정경계 등)의 피처 → 위치 후보.
 * 면은 대표점(representativePoint)을, 점은 그 점을 그대로 쓴다.
 */
import GeoJSON from 'ol/format/GeoJSON';
import { toLonLat } from 'ol/proj';
import * as turf from '@turf/turf';
import { layerManager } from '../core/LayerManager.js';
import { collectFieldNames } from '../utils/layerSelect.js';

const geojson = new GeoJSON();

/** 위치 기준으로 쓸 수 있는 레이어 (피처가 있는 벡터 레이어) */
export function listCandidateLayers() {
  return layerManager.getAllLayers().filter((l) =>
    l.type !== 'raster' && l.type !== 'flow' && l.type !== 'chartmap' && l.type !== 'heatmap' &&
    l.source && typeof l.source.getFeatures === 'function' && l.source.getFeatures().length > 0
  );
}

export function layerFieldNames(layerInfo) {
  return collectFieldNames(layerInfo.source.getFeatures());
}

/** 이름 열 후보의 기본값: name/이름/NAME_KO 류가 있으면 그것, 없으면 첫 문자열 열 */
export function guessNameField(fields) {
  return fields.find((f) => /^(name_ko|name|이름|명칭|지역명|시도명|시군구명|sido_name|sgg_nm|gu_nm|ctp_kor_nm|sig_kor_nm|emd_kor_nm|adm_nm)$/i.test(f))
    || fields.find((f) => /name|이름|명|_nm$/i.test(f))
    || fields[0] || null;
}

/**
 * 면 피처의 대표점. MultiPolygon(섬 딸린 시도 등)에서 turf.pointOnFeature 를 바로 쓰면
 * 가장 먼 조각(작은 섬)에 점이 찍혀 인천이 먼바다 섬에, 경북·전남이 해안으로 끌려가는
 * 문제가 있었다. 가장 큰 조각을 고르고, 그 안에서 무게중심이 조각 안에 있으면 그걸,
 * 아니면(오목한 모양이라 무게중심이 밖으로 나가면) pointOnFeature 를 쓴다.
 * @param {Object} featureObj GeoJSON Feature
 * @returns {Object} GeoJSON Point Feature
 */
export function representativePoint(featureObj) {
  const geom = featureObj.geometry;
  if (!geom) return turf.pointOnFeature(featureObj);

  if (geom.type === 'MultiPolygon') {
    let best = null;
    let bestArea = -Infinity;
    geom.coordinates.forEach((coords) => {
      const poly = turf.polygon(coords);
      const area = turf.area(poly);
      if (area > bestArea) { bestArea = area; best = poly; }
    });
    // coordinates가 빈 배열이면(잘못 만들어진 도형) 조각이 하나도 안 걸린다 — pointOnFeature로 물러선다
    if (!best) return turf.pointOnFeature(featureObj);
    return representativePoint(best);
  }

  if (geom.type === 'Polygon') {
    const center = turf.centerOfMass(featureObj);
    if (turf.booleanPointInPolygon(center, featureObj)) return center;
    return turf.pointOnFeature(featureObj);
  }

  return turf.pointOnFeature(featureObj);
}

/**
 * @param {Object} layerInfo   LayerManager 의 레이어 정보
 * @param {string} nameField   이름 열
 * @param {string|null} codeField  코드 열 (있으면 코드로도 맞춘다)
 * @returns {Array<{ id, name, code, lon, lat }>}
 */
export function layerLocations(layerInfo, nameField, codeField = null) {
  const out = [];
  layerInfo.source.getFeatures().forEach((feature, i) => {
    const geom = feature.getGeometry();
    if (!geom) return;
    let lon, lat;
    const type = geom.getType();
    try {
      if (type === 'Point') {
        [lon, lat] = toLonLat(geom.getCoordinates());
      } else {
        const obj = geojson.writeFeatureObject(feature, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
        [lon, lat] = representativePoint(obj).geometry.coordinates;
      }
    } catch {
      // 좌표가 없는 빈 MultiPolygon 등 대표점을 낼 수 없는 도형은 이 피처만 건너뛴다
      return;
    }
    const name = String(feature.get(nameField) ?? '').trim();
    if (!name) return;
    const code = codeField ? String(feature.get(codeField) ?? '').trim() : '';
    out.push({ id: code || `f-${i}`, name, code, lon, lat });
  });
  return out;
}
