// © 2026 김용현
/**
 * gridLayer - 점을 격자로 묶어 폴리곤 레이어로 만든다.
 *
 * 집계 자체는 gridAggregate.js 가 한다. 여기서는 그 결과를 레이어로 앉히고
 * 단계구분도 규약(분류·색·범례)을 붙인다. 공공데이터 화면과 「격자 만들기」
 * 패널이 같은 함수를 쓰도록 따로 두었다 — 격자 만드는 규약이 두 벌로 갈라지면
 * 저장·복원·주제도 편집에서 서로 다르게 굴게 된다.
 */

import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { layerManager } from '../core/LayerManager.js';
import { choroplethTool } from './ChoroplethTool.js';
import { aggregateToGrid, estimateCellCount } from './gridAggregate.js';

/** 이보다 칸이 많아지면 그리지 않는다. 폴리곤 수가 폭발해 지도가 멈춘다. */
export const GRID_CELL_LIMIT = 20000;

/** 격자 칸의 속성 이름 — 속성 테이블·범례에 그대로 보이므로 한국어로 둔다 */
export const COUNT_FIELD = '개수';
export const VALUE_FIELD = '값';

/** 격자 색 (ColorBrewer Blues 5단계) */
export const GRID_COLORS = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];

/**
 * 점들을 격자로 묶어 레이어를 만든다.
 *
 * @param {string} name 레이어 이름
 * @param {Array<{x:number, y:number, props?:Object}>} points 지도 좌표(EPSG:3857)의 점
 * @param {Object} options { cellSize, method, field }
 * @returns {string} 만들어진 레이어 id
 */
export function createGridLayer(name, points, options = {}) {
  const { cellSize, method = 'count', field } = options;

  if (!points || points.length === 0) {
    throw new Error('지도에 표시할 수 있는 좌표가 없습니다.');
  }

  const estimated = estimateCellCount(points, cellSize);
  if (estimated > GRID_CELL_LIMIT) {
    throw new Error(
      `격자가 너무 촘촘합니다 (약 ${estimated.toLocaleString()}칸). ` +
      `${GRID_CELL_LIMIT.toLocaleString()}칸 아래가 되도록 격자 크기를 키워 주세요.`
    );
  }

  const cells = aggregateToGrid(points, { cellSize, method, field });
  const features = cells.map(cell => new Feature({
    geometry: new Polygon([[
      [cell.minX, cell.minY], [cell.maxX, cell.minY],
      [cell.maxX, cell.maxY], [cell.minX, cell.maxY], [cell.minX, cell.minY]
    ]]),
    [COUNT_FIELD]: cell.count,
    [VALUE_FIELD]: cell.value
  }));

  // 분류·색·범례는 단계구분도 규약을 그대로 쓴다 (저장/복원도 그 덕에 따라온다).
  // choroplethTool.apply()는 원본에서 파생 레이어를 새로 만드는 구조라 격자가 두 개가 된다.
  // 카토그램이 하는 것처럼 설정만 붙이고 렌더링은 LayerManager의 분기에 맡긴다.
  const layerId = layerManager.addLayer({
    name, features, geometryType: 'Polygon', type: 'choropleth'
  });

  const values = choroplethTool.getAttributeValues(layerId, VALUE_FIELD);
  const breaks = choroplethTool.calculateBreaks(values, GRID_COLORS.length, 'quantile');

  const layerInfo = layerManager.getLayer(layerId);
  layerInfo._choroplethConfig = {
    attribute: VALUE_FIELD,
    breaks,
    colors: GRID_COLORS,
    tool: choroplethTool
  };
  layerManager.updateLayerStyle(layerId);
  choroplethTool.createLegend(layerId, name, VALUE_FIELD, breaks, GRID_COLORS);

  return layerId;
}
