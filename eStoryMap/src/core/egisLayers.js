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

// 파선 매핑 — e-GIS LayerManager.STROKE_DASH_OPTIONS 이식(양쪽 동일해야 함)
const STROKE_DASH_OPTIONS = {
  solid: null,
  dashed: [10, 10],
  dotted: [2, 6],
  'dash-dot': [10, 5, 2, 5],
};

/** 세부 스타일 필드가 하나라도 있는지 — 없으면 구버전 .egis(단일색 폴백). */
function hasDetailStyle(s) {
  return s.strokeColor != null || s.fillColor != null || s.fillOpacity != null
    || s.strokeOpacity != null || s.strokeWidth != null || s.strokeDash != null
    || s.pointRadius != null;
}

/**
 * 스타일(정규화 레이어 또는 hex 문자열) + 지오메트리 타입 → OL Style.
 * - 세부 필드 있음(신버전 .egis): e-GIS LayerManager.updateLayerStyle 이식 — 채우기/테두리
 *   색·불투명도·굵기·파선·점 크기를 웹에서 지정한 대로 재현.
 * - 세부 필드 없음(구버전): 기존 단일색 스타일 유지(LayerManager.createStyle 이식) — 하위 호환.
 */
export function createVectorStyle(style, geometryType = 'Polygon') {
  const s = typeof style === 'string' ? { color: style } : (style || {});
  const color = s.color || '#3b82f6';

  if (hasDetailStyle(s)) {
    const strokeColor = s.strokeColor || color;
    const fillColor = s.fillColor || color;
    const fillOpacity = s.fillOpacity != null ? s.fillOpacity : 0.3;
    const strokeOpacity = s.strokeOpacity != null ? s.strokeOpacity : 1.0;
    const strokeWidth = s.strokeWidth != null ? s.strokeWidth : 2;
    const lineDash = STROKE_DASH_OPTIONS[s.strokeDash || 'solid'] || null;
    const rgbaFill = hexToRgba(fillColor, fillOpacity);
    const rgbaStroke = hexToRgba(strokeColor, strokeOpacity);

    if (geometryType === 'Point' || geometryType === 'MultiPoint') {
      return new Style({
        image: new CircleStyle({
          radius: s.pointRadius != null ? s.pointRadius : 6,
          fill: new Fill({ color: rgbaFill }),
          stroke: new Stroke({ color: rgbaStroke, width: strokeWidth }),
        }),
      });
    }
    if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
      return new Style({ stroke: new Stroke({ color: rgbaStroke, width: strokeWidth, lineDash }) });
    }
    return new Style({
      fill: new Fill({ color: rgbaFill }),
      stroke: new Stroke({ color: rgbaStroke, width: strokeWidth, lineDash }),
    });
  }

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
    style: createVectorStyle(layerData, geometryType), // 세부 스타일 포함(색·불투명도·파선 등)
    visible: layerData.visible,
    opacity: layerData.opacity,
  });
  layer.set('egisLayerId', layerData.id);
  layer.set('egisLayerName', layerData.name);
  return layer;
}
