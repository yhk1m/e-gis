// © 2026 김용현
// eStoryMap/src/core/egisLayers.js
// .egis 벡터 레이어 → OpenLayers. 이식 원본: e-GIS src/core/LayerManager.js
// (createStyle, hexToRgba) + ProjectManager.js(readFeatures 투영 규약).
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

/** hex 색을 rgba 문자열로. e-GIS LayerManager.hexToRgba 이식. */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(128, 128, 128, ${alpha})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  if (!hex.startsWith('#')) hex = '#' + hex;
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 색 + 지오메트리 타입 → OL Style. e-GIS LayerManager.createStyle 이식. */
export function createVectorStyle(color, geometryType = 'Polygon') {
  if (geometryType === 'Point' || geometryType === 'MultiPoint') {
    return new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    });
  }
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
    return new Style({ stroke: new Stroke({ color, width: 3 }) });
  }
  return new Style({
    fill: new Fill({ color: hexToRgba(color, 0.3) }),
    stroke: new Stroke({ color, width: 2 }),
  });
}

/** .egis features(GeoJSON FC, EPSG:4326) → OL Feature[] (지도 투영 EPSG:3857). */
export function readVectorFeatures(featuresGeoJSON) {
  if (!featuresGeoJSON) return [];
  return new GeoJSON().readFeatures(featuresGeoJSON, {
    featureProjection: 'EPSG:3857',
    dataProjection: 'EPSG:4326',
  });
}

/** 정규화된 벡터 레이어 데이터(egisParse 산출) → OL VectorLayer. */
export function buildVectorLayer(layerData) {
  const features = readVectorFeatures(layerData.features);
  const firstGeom = features[0] && features[0].getGeometry();
  const geometryType =
    layerData.geometryType || (firstGeom && firstGeom.getType()) || 'Polygon';
  const layer = new VectorLayer({
    source: new VectorSource({ features }),
    style: createVectorStyle(layerData.color, geometryType),
    visible: layerData.visible,
  });
  layer.set('egisLayerId', layerData.id);
  layer.set('egisLayerName', layerData.name);
  return layer;
}
