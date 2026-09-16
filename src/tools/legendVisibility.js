// © 2026 김용현
/**
 * 지도 위 범례의 표시 여부는 오직 그 레이어의 가시성이 정한다.
 *
 * 범례는 도구마다 따로 만들지만(단계구분·히트맵·도형표현·카토그램·래스터·DEM)
 * id 규약 `{접두사}-{layerId}`는 같다. 범례를 **만드는 곳**(새로 만들 때, 자동 저장이나
 * 프로젝트에서 복원할 때)과 **켜고 끄는 곳**(레이어 패널 체크박스, 지도 내보내기 창)이
 * 모두 여기를 거쳐야 숨긴 레이어의 범례가 되살아나지 않는다.
 *
 * 그동안은 레이어 패널 체크박스만 범례를 맞췄다. 그래서 `visible:false`로 복원된
 * 레이어의 범례가 그대로 보였고, 내보내기 창의 '범례 표시'는 모든 범례에
 * display=''를 걸어 숨긴 것까지 되살렸다.
 */
import { layerManager } from '../core/LayerManager.js';

/** 도구별 범례 id 접두사 — 각 도구의 createLegend와 같아야 한다 */
export const LEGEND_ID_PREFIXES = [
  'choropleth-legend', // 단계구분도
  'heatmap-legend',    // 히트맵
  'raster-legend',     // 래스터 분석
  'dem-legend',        // DEM
  'chart-legend',      // 도형표현도(차트맵)
  'legend'             // 카토그램
];

/** 레이어에 딸린 범례 요소들 (없으면 빈 배열) */
export function legendElementsOf(layerId, root = document) {
  return LEGEND_ID_PREFIXES
    .map((prefix) => root.getElementById(`${prefix}-${layerId}`))
    .filter(Boolean);
}

/** 범례를 지정한 상태로 보이거나 숨긴다 */
export function applyLegendVisibility(layerId, visible, root = document) {
  legendElementsOf(layerId, root).forEach((el) => {
    el.style.display = visible ? '' : 'none';
  });
}

/**
 * 레이어의 현재 가시성을 그 범례에 반영한다.
 * 레이어를 모르면(아직 등록 전) 보이는 것으로 둔다.
 * @returns {boolean} 반영된 표시 여부
 */
export function syncLegendVisibility(layerId, root = document) {
  const layer = layerManager.getLayer(layerId);
  const visible = layer ? layer.visible !== false : true;
  applyLegendVisibility(layerId, visible, root);
  return visible;
}
