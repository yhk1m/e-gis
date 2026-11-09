// © 2026 김용현
/**
 * 여러 레이어 스타일을 한꺼번에 바꿀 때의 규칙.
 *
 * 스타일 팝업(LayerPanel.showColorPicker)에 레이어 id 배열이 오면
 *  1. 스타일을 못 바꾸는 레이어(흐름, 도형표현도, 래스터, 히트맵)를 걸러 내고,
 *  2. 남은 레이어의 지오메트리 종류 모두에 의미 있는 항목만 보여 주고,
 *  3. 바꾼 값을 남은 레이어 모두에 layerManager.setLayer* 로 건다.
 * 팝업 마크업과 떨어뜨려 두어 규칙만 따로 시험할 수 있게 했다.
 */

/** 스타일 팝업으로 바꿀 수 없는 레이어 종류 */
export const STYLE_LOCKED_TYPES = ['flow', 'chartmap', 'raster', 'heatmap'];

/**
 * @param {Array<object|null>} layers - layerManager.getLayer 결과 목록
 * @returns {{eligible: object[], excluded: object[]}}
 */
export function partitionStyleTargets(layers) {
  const eligible = [];
  const excluded = [];
  (layers || []).forEach((l) => {
    if (!l) return;
    if (STYLE_LOCKED_TYPES.includes(l.type)) excluded.push(l);
    else eligible.push(l);
  });
  return { eligible, excluded };
}

/** 'point' | 'line' | 'polygon' (지오메트리 정보가 없으면 면으로 본다. 단일 팝업과 같은 규칙) */
export function geometryKind(layer) {
  const g = layer && layer.geometryType;
  if (g === 'Point' || g === 'MultiPoint') return 'point';
  if (g === 'LineString' || g === 'MultiLineString') return 'line';
  return 'polygon';
}

/**
 * 종류마다 단일 팝업이 보여 주는 항목. 순서가 곧 팝업에 그리는 순서다.
 * (점 레이어는 선 모양을 그리지 않고, 선 투명도는 단일 팝업에서도 선 레이어에만 있다)
 */
const CONTROL_ORDER = ['fillColor', 'fillOpacity', 'strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDash'];
const CONTROLS_BY_KIND = {
  point: ['fillColor', 'fillOpacity', 'strokeColor', 'strokeWidth'],
  line: ['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDash'],
  polygon: ['fillColor', 'fillOpacity', 'strokeColor', 'strokeWidth', 'strokeDash']
};

/** 고른 레이어의 지오메트리 종류 모두에 있는 항목만 */
export function commonStyleControls(layers) {
  if (!layers || layers.length === 0) return [];
  const kinds = new Set(layers.map(geometryKind));
  return CONTROL_ORDER.filter((c) => [...kinds].every((k) => CONTROLS_BY_KIND[k].includes(c)));
}

/**
 * 한 항목의 값을 고른 레이어 모두에 건다. 스타일을 못 바꾸는 레이어와 없는 레이어는 건너뛴다.
 * 선 레이어의 선 색은 단일 팝업처럼 setLayerColor(색, 선 색, 면 색을 함께 바꿈)를 쓴다.
 * 분류 레이어의 면 색은 setter 쪽이 알아서 막는다.
 * @param {string[]} ids
 * @param {string} key - CONTROL_ORDER 의 한 항목
 * @param {*} value
 * @param {object} lm - layerManager
 */
export function applyStyleToAll(ids, key, value, lm) {
  ids.forEach((id) => {
    const layer = lm.getLayer(id);
    if (!layer || STYLE_LOCKED_TYPES.includes(layer.type)) return;
    switch (key) {
      case 'strokeColor':
        if (geometryKind(layer) === 'line') lm.setLayerColor(id, value);
        else lm.setLayerStrokeColor(id, value);
        break;
      case 'fillColor': lm.setLayerFillColor(id, value); break;
      case 'fillOpacity': lm.setLayerFillOpacity(id, value); break;
      case 'strokeOpacity': lm.setLayerStrokeOpacity(id, value); break;
      case 'strokeWidth': lm.setLayerStrokeWidth(id, value); break;
      case 'strokeDash': lm.setLayerStrokeDash(id, value); break;
      default: break;
    }
  });
}
