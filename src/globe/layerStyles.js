// © 2026 김용현
/**
 * 레이어 정보 + 피처 속성 → 지구본이 칠할 값 (순수).
 *
 * LayerManager.updateLayerStyle(src/core/LayerManager.js:690-850) 의 분기를
 * OpenLayers 없이 재현한다. 기본값은 그쪽과 같아야 한다 — 어긋나면 2D 와 지구본의
 * 색·두께가 달라 보인다. (utils/strokeStyle.js 는 ol/style 을 import 해서 여기선 안 쓴다.)
 *
 * 단계구분도·격자: type 'choropleth' + _choroplethConfig { attribute, breaks, colors, fills? }
 * 카토그램:       type 'vector'     + _cartogramConfig  { attribute, breaks, colors }
 * 등고선:         type 'vector'     + _contourConfig    { interval, majorRatio }  (속성 elevation)
 * 일반 벡터:      color·fillColor·strokeColor·fillOpacity·strokeOpacity·strokeWidth·pointRadius·strokeDash
 *
 * fillSpec 은 단계구분도 구간의 무늬 사양(cfg.fills[i]) — 그리는 쪽이
 * fillFor(fillSpec, fillColor, fillOpacity, pixelScale) 로 2D 와 같은 무늬를 만든다.
 */

export const STROKE_DASH = {
  solid: null,
  dashed: [10, 10],
  dotted: [2, 6],
  'dash-dot': [10, 5, 2, 5]
};

const GRAY = '#808080';

/**
 * ChoroplethTool.getColorIndex(src/tools/ChoroplethTool.js:185-190) — 값이 NaN 이거나
 * 구간이 없으면 -1. (2D 는 isNaN 만 거르므로 Infinity 는 마지막 구간이 된다 — 같게 둔다.)
 */
export function classIndex(value, breaks) {
  if (!Array.isArray(breaks) || breaks.length < 2 || typeof value !== 'number' || Number.isNaN(value)) return -1;
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value <= breaks[i + 1]) return i;
  }
  return breaks.length - 2;
}

/** 각 채널 -40 — ChoroplethTool.darkenColor 와 같은 계산 */
export function darkenColor(hex) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
  const ch = (i) => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - 40).toString(16).padStart(2, '0');
  return '#' + ch(1) + ch(3) + ch(5);
}

/** LayerManager.hexToRgba 와 같은 관용 — rgb(a) 문자열은 그대로, 없으면 회색 */
export function rgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(128, 128, 128, ${alpha})`;
  if (hex.startsWith('rgb')) return hex;
  const h = hex.startsWith('#') ? hex : '#' + hex;
  const r = parseInt(h.slice(1, 3), 16) || 0;
  const g = parseInt(h.slice(3, 5), 16) || 0;
  const b = parseInt(h.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** utils/strokeStyle.strokeWidthOf — 0 은 0 그대로 */
function widthOf(layerInfo, fallback) {
  return layerInfo.strokeWidth !== undefined ? layerInfo.strokeWidth : fallback;
}

function dashOf(layerInfo) {
  return STROKE_DASH[layerInfo.strokeDash || 'solid'] ?? null;
}

function isPointType(geometryType) {
  return geometryType === 'Point' || geometryType === 'MultiPoint';
}

function choroplethStyle(layerInfo, props) {
  const cfg = layerInfo._choroplethConfig;
  const idx = classIndex(parseFloat(props[cfg.attribute]), cfg.breaks);
  const color = idx < 0 ? GRAY : (cfg.colors[idx] || cfg.colors[0]);
  const sync = layerInfo.strokeSyncToFill !== false;
  return {
    fillColor: color,
    fillSpec: idx < 0 ? null : (cfg.fills?.[idx] ?? null),
    fillOpacity: layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.7,
    strokeColor: sync ? (idx < 0 ? '#666666' : darkenColor(color)) : (layerInfo.strokeColor || '#666666'),
    strokeOpacity: 1,
    strokeWidth: widthOf(layerInfo, 1),
    lineDash: dashOf(layerInfo),
    pointRadius: layerInfo.pointRadius || 6
  };
}

function cartogramStyle(layerInfo, props) {
  const cfg = layerInfo._cartogramConfig;
  const raw = classIndex(parseFloat(props[cfg.attribute]), cfg.breaks);
  const idx = Math.max(0, Math.min(raw, cfg.colors.length - 1));   // CartogramTool.cartoColorIndex
  const color = cfg.colors[idx] || cfg.colors[0];
  const sync = layerInfo.strokeSyncToFill !== false;
  return {
    fillColor: color,
    fillSpec: null,
    fillOpacity: layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.85,
    strokeColor: sync ? darkenColor(color) : (layerInfo.strokeColor || '#333333'),
    strokeOpacity: 1,
    strokeWidth: widthOf(layerInfo, 1),
    lineDash: dashOf(layerInfo),
    pointRadius: layerInfo.pointRadius || 6
  };
}

/** LayerManager 등고선 분기 — 계곡선(interval×5 배수)만 두께 × majorRatio */
function contourStyle(layerInfo, props) {
  const cfg = layerInfo._contourConfig;
  const minor = widthOf(layerInfo, 0.8);
  const isMajor = props.elevation % (cfg.interval * 5) === 0;
  const color = layerInfo.strokeColor || layerInfo.color || GRAY;
  return {
    fillColor: color,
    fillSpec: null,
    fillOpacity: 0,
    strokeColor: color,
    strokeOpacity: layerInfo.strokeOpacity !== undefined ? layerInfo.strokeOpacity : 1,
    strokeWidth: isMajor ? minor * cfg.majorRatio : minor,
    lineDash: dashOf(layerInfo),
    pointRadius: layerInfo.pointRadius || 6
  };
}

function plainStyle(layerInfo) {
  return {
    fillColor: layerInfo.fillColor || layerInfo.color || GRAY,
    fillSpec: null,
    fillOpacity: layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.3,
    strokeColor: layerInfo.strokeColor || layerInfo.color || GRAY,
    strokeOpacity: layerInfo.strokeOpacity !== undefined ? layerInfo.strokeOpacity : 1,
    strokeWidth: widthOf(layerInfo, 2),
    // 점 분기는 CircleStyle 테두리에 lineDash 를 안 넘긴다
    lineDash: isPointType(layerInfo.geometryType) ? null : dashOf(layerInfo),
    pointRadius: layerInfo.pointRadius || 6
  };
}

/**
 * @param {object} layerInfo LayerManager 의 레이어 객체
 * @param {object} props 피처 속성(GeoJSON properties)
 * @returns {{fillColor: string, fillSpec: object|null, fillOpacity: number, strokeColor: string,
 *            strokeOpacity: number, strokeWidth: number, lineDash: number[]|null, pointRadius: number}}
 */
export function featureStyle(layerInfo, props) {
  const p = props || {};
  if (layerInfo.type === 'choropleth' && layerInfo._choroplethConfig) return choroplethStyle(layerInfo, p);
  if (layerInfo._cartogramConfig) return cartogramStyle(layerInfo, p);
  if (layerInfo._contourConfig) return contourStyle(layerInfo, p);
  return plainStyle(layerInfo);
}
