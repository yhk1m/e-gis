// © 2026 김용현
// eStoryMap/src/core/egisLayers.js
// .egis 벡터 레이어 → OpenLayers. 이식 원본: e-GIS src/core/LayerManager.js
// (createStyle, hexToRgba) + ProjectManager.js(readFeatures 투영 규약).
import GeoJSON from 'ol/format/GeoJSON';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle, Text, Icon } from 'ol/style';

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

/** 사용자가 세부 스타일을 실제로 바꿨는지 — 필드가 없거나(구버전 .egis) 전부
 *  기본값(색 파생 포함)이면 false → 기존 단일색 스타일로 렌더(웹 초기 모양과 일치). */
function hasDetailStyle(s) {
  const c = s.color;
  return (s.strokeColor != null && s.strokeColor !== c)
    || (s.fillColor != null && s.fillColor !== c)
    || (s.fillOpacity != null && s.fillOpacity !== 0.3)
    || (s.strokeOpacity != null && s.strokeOpacity !== 1)
    || (s.strokeWidth != null && s.strokeWidth !== 2)
    || (s.strokeDash != null && s.strokeDash !== 'solid')
    || (s.pointRadius != null && s.pointRadius !== 6);
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

/** 계급 인덱스 — 웹 ChoroplethTool.getColorIndex 이식(양쪽 동일해야 함). */
function getColorIndex(value, breaks) {
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value <= breaks[i + 1]) return i;
  }
  return breaks.length - 2;
}

/** hex를 40씩 어둡게 — 웹 ChoroplethTool.darkenColor 이식(테두리색). */
function darkenColor(hex) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 단계구분도 스타일 함수 — 웹 LayerManager.updateLayerStyle choropleth 분기 이식.
 * @param {{attribute:string, breaks:number[], colors:string[]}} cfg
 * @param {{fillOpacity?:number, strokeWidth?:number}} layerData - 저장된 세부 스타일(선택)
 */
export function createChoroplethStyle(cfg, layerData = {}) {
  const fillOpacity = layerData.fillOpacity != null ? layerData.fillOpacity : 0.7;
  const strokeWidth = layerData.strokeWidth != null ? layerData.strokeWidth : 1;
  return function (feature) {
    const val = parseFloat(feature.get(cfg.attribute));
    if (isNaN(val)) {
      return new Style({
        fill: new Fill({ color: `rgba(128, 128, 128, ${fillOpacity})` }),
        stroke: new Stroke({ color: '#666', width: strokeWidth }),
      });
    }
    const color = cfg.colors[getColorIndex(val, cfg.breaks)] || cfg.colors[0];
    return new Style({
      fill: new Fill({ color: hexToRgba(color, fillOpacity) }),
      stroke: new Stroke({ color: darkenColor(color), width: strokeWidth }),
    });
  };
}

/**
 * 카토그램 스타일 함수 — 웹 CartogramTool.cartogramStyle 이식(분류색 + 선택 라벨).
 * @param {{attribute:string, breaks:number[], colors:string[], showLabels?:boolean}} cfg
 */
export function createCartogramStyle(cfg) {
  const { attribute, colors, breaks, showLabels } = cfg;
  return function (feature) {
    const val = parseFloat(feature.get(attribute));
    const idx = isNaN(val) || !breaks || breaks.length < 2
      ? 0
      : Math.max(0, Math.min(getColorIndex(val, breaks), colors.length - 1));
    const color = colors[idx] || colors[0];
    return new Style({
      fill: new Fill({ color: hexToRgba(color, 0.85) }),
      stroke: new Stroke({ color: '#333', width: 1 }),
      text: showLabels ? new Text({
        text: String(feature.get('name') || feature.get('NAME') || ''),
        font: 'bold 11px sans-serif',
        fill: new Fill({ color: '#333' }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
        overflow: true,
      }) : undefined,
    });
  };
}

const SVG_DATA_PREFIX = 'data:image/svg+xml;utf8,';

/** 데이터 URL 속 SVG에 xmlns가 없으면 주입(순수) — xmlns 없는 SVG는 <img>류(Icon)로
 *  렌더되지 않는다(브라우저 규칙). 초기 버전 웹이 구운 파일 하위 호환. */
export function ensureSvgXmlns(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(SVG_DATA_PREFIX)) return dataUrl;
  const svg = decodeURIComponent(dataUrl.slice(SVG_DATA_PREFIX.length));
  if (/<svg[^>]*\sxmlns=/.test(svg)) return dataUrl;
  return SVG_DATA_PREFIX + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
}

/**
 * 도형표현도 스타일 함수 — 웹 ChartMapTool이 피처에 구운 차트 SVG(_chartSvg 데이터 URL)를
 * 아이콘으로 그린다(캔버스 렌더 → 발표·PDF 캡처에 그대로 실림). 스타일 객체는 SVG별 캐시.
 */
export function createChartIconStyle() {
  const cache = new Map(); // dataURL → Style
  return function (feature) {
    const src = feature.get('_chartSvg');
    if (!src) return null;
    let style = cache.get(src);
    if (!style) {
      style = new Style({ image: new Icon({ src: ensureSvgXmlns(src) }) });
      cache.set(src, style);
    }
    return style;
  };
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
  // 스타일: 주제도(도형표현도/단계구분도/카토그램)는 전용 함수, 그 외는 세부/단일색 스타일
  let style;
  if (layerData.chartMapConfig) style = createChartIconStyle();
  else if (layerData.choroplethConfig) style = createChoroplethStyle(layerData.choroplethConfig, layerData);
  else if (layerData.cartogramConfig) style = createCartogramStyle(layerData.cartogramConfig);
  else style = createVectorStyle(layerData, geometryType);
  const layer = new VectorLayer({
    source: new VectorSource({ features }),
    style,
    visible: layerData.visible,
    opacity: layerData.opacity,
  });
  layer.set('egisLayerId', layerData.id);
  layer.set('egisLayerName', layerData.name);
  return layer;
}
