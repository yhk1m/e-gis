// © 2026 김용현
/**
 * 기준 레이어(행정경계 등)의 피처 → 위치 후보.
 * 면은 turf.pointOnFeature 로 면 안에 놓이는 점을, 점은 그 점을 대표점으로 쓴다.
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
    l.type !== 'raster' && l.type !== 'flow' && l.type !== 'chartmap' &&
    l.source && typeof l.source.getFeatures === 'function' && l.source.getFeatures().length > 0
  );
}

export function layerFieldNames(layerInfo) {
  return collectFieldNames(layerInfo.source.getFeatures());
}

/** 이름 열 후보의 기본값: name/이름/NAME_KO 류가 있으면 그것, 없으면 첫 문자열 열 */
export function guessNameField(fields) {
  return fields.find((f) => /^(name_ko|name|이름|명칭|지역명|시도명|시군구명|sido_name|sgg_nm|gu_nm)$/i.test(f))
    || fields.find((f) => /name|이름|명/i.test(f))
    || fields[0] || null;
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
    if (type === 'Point') {
      [lon, lat] = toLonLat(geom.getCoordinates());
    } else {
      const obj = geojson.writeFeatureObject(feature, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
      [lon, lat] = turf.pointOnFeature(obj).geometry.coordinates;
    }
    const name = String(feature.get(nameField) ?? '').trim();
    if (!name) return;
    const code = codeField ? String(feature.get(codeField) ?? '').trim() : '';
    out.push({ id: code || `f-${i}`, name, code, lon, lat });
  });
  return out;
}
