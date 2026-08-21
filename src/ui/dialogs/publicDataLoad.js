// © 2026 김용현
/**
 * 공공데이터 불러오기 — 파라미터 폼 · 미리보기 · 포인트 레이어 생성.
 *
 * 중계 함수(/api/pubdata)가 좌표계 코드(epsg)만 실어 보내고 변환은 하지 않는다.
 * 지도는 EPSG:3857이므로 여기서 바꾼다. 포털은 위경도로도 주고 TM 좌표로도 준다.
 */

import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat, transform } from 'ol/proj.js';
import { layerManager } from '../../core/LayerManager.js';
import { choroplethTool } from '../../tools/ChoroplethTool.js';
import { heatmapTool } from '../../tools/HeatmapTool.js';
import { aggregateToGrid, estimateCellCount } from '../../tools/gridAggregate.js';

const PREVIEW_ROWS = 5;

/** 이보다 칸이 많아지면 그리지 않는다. 폴리곤 수가 폭발해 지도가 멈춘다. */
export const GRID_CELL_LIMIT = 20000;

/** 격자 칸의 속성 이름 — 속성 테이블·범례에 그대로 보이므로 한국어로 둔다 */
const COUNT_FIELD = '개수';
const VALUE_FIELD = '값';

/** 격자 색 (ColorBrewer Blues 5단계) */
const GRID_COLORS = ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'];

/**
 * 선택지를 그린다. 항목에 `group` 이 있으면 그 이름으로 묶는다.
 * 시군구처럼 200개가 넘는 목록을 한 줄로 늘어놓으면 학생이 찾지 못한다.
 */
function renderOptions(options) {
  const one = (option) => `<option value="${option.value}">${option.label}</option>`;
  if (!options.some(option => option.group)) {
    return options.map(one).join('');
  }

  // 묶음 순서는 목록에 나온 순서를 그대로 따른다 (시도 코드 순)
  const groups = [];
  for (const option of options) {
    const name = option.group || '기타';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(option);
    else groups.push({ name, items: [option] });
  }

  return groups.map(group =>
    `<optgroup label="${group.name}">${group.items.map(one).join('')}</optgroup>`
  ).join('');
}

/** 항목이 요구하는 선택지를 폼으로 만든다 */
export function renderParamForm(entry) {
  const params = (entry && entry.params) || [];
  if (params.length === 0) return '';

  return params.map(param => {
    const control = param.type === 'select'
      ? `<select class="public-data-param" data-param="${param.key}">
           ${renderOptions(param.options || [])}
         </select>`
      : `<input type="text" class="public-data-param" data-param="${param.key}"
                placeholder="${param.label}">`;

    return `<label class="public-data-field">
              <span>${param.label}${param.required ? ' *' : ''}</span>
              ${control}
            </label>`;
  }).join('');
}

/** 폼에서 고른 값을 모은다. 빈 값은 넣지 않는다(서버가 선택 항목만 검증한다) */
export function collectParams(root, entry) {
  const collected = {};
  for (const param of (entry && entry.params) || []) {
    const el = root.querySelector(`[data-param="${param.key}"]`);
    if (!el) continue;
    const value = String(el.value || '').trim();
    if (value) collected[param.key] = value;
  }
  return collected;
}

/** 불러온 결과를 눈으로 확인할 수 있게 요약한다 */
export function renderPreview(result, entry) {
  if (!result || result.count === 0) {
    return `<div class="public-data-notice">조건에 맞는 자료가 없습니다. 다른 지역을 골라 보세요.</div>`;
  }

  const rows = result.items.slice(0, PREVIEW_ROWS);
  const columns = Object.keys(rows[0].props || {}).slice(0, 4);

  const head = columns.map(column => `<th>${column}</th>`).join('');
  const body = rows.map(row =>
    `<tr>${columns.map(column => `<td>${row.props[column] ?? ''}</td>`).join('')}</tr>`
  ).join('');

  const skippedText = result.skipped > 0
    ? ` <span class="public-data-skipped">(좌표가 없는 ${result.skipped}건 제외)</span>`
    : '';

  return `
    <div class="public-data-summary"><strong>${result.count}건</strong>${skippedText}</div>
    <div class="public-data-table-wrap">
      <table class="public-data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>
  `;
}

/**
 * 합계·평균에 쓸 수 있는(숫자로 읽히는) 속성 이름을 데이터에서 찾는다.
 * 카탈로그 메모보다 실제 응답이 정확하다 — 포털은 값이 '-'로 비는 칸이 흔하다.
 */
export function numericFields(result) {
  const rows = (result && result.items) || [];
  if (rows.length === 0) return [];

  const candidates = Object.keys(rows[0].props || {});
  return candidates.filter(key => rows.some(row => {
    const value = row.props ? row.props[key] : undefined;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string' && value.trim() !== '') return Number.isFinite(Number(value));
    return false;
  }));
}

/**
 * 항목 하나를 지도 좌표(EPSG:3857)로 옮긴다.
 * 변환할 수 없는 좌표계면 null (지도 밖 엉뚱한 곳에 찍히는 것보다 버리는 게 낫다).
 */
function toMapCoordinate(item, code) {
  try {
    const coordinate = code === 4326
      ? fromLonLat([item.lon, item.lat])
      : transform([item.lon, item.lat], `EPSG:${code}`, 'EPSG:3857');
    if (!coordinate || !isFinite(coordinate[0]) || !isFinite(coordinate[1])) return null;
    return coordinate;
  } catch (e) {
    return null;
  }
}

/** 정규화된 항목 → 지도 좌표계(EPSG:3857)의 포인트 피처 */
export function toFeatures(items, epsg) {
  const code = Number(epsg) || 4326;
  const features = [];

  for (const item of items || []) {
    const coordinate = toMapCoordinate(item, code);
    if (!coordinate) continue;
    features.push(new Feature({ geometry: new Point(coordinate), ...(item.props || {}) }));
  }

  return features;
}

/** 격자 집계에 쓸 점 목록 (지도 좌표 + 속성) */
function toMapPoints(items, epsg) {
  const code = Number(epsg) || 4326;
  const points = [];

  for (const item of items || []) {
    const coordinate = toMapCoordinate(item, code);
    if (!coordinate) continue;
    points.push({ x: coordinate[0], y: coordinate[1], props: item.props || {} });
  }

  return points;
}

/**
 * 포인트 레이어로 추가한다.
 * @returns {string} 레이어 ID
 */
export function addPointLayer(name, result) {
  const features = toFeatures(result.items, result.epsg);
  if (features.length === 0) {
    throw new Error('지도에 표시할 수 있는 좌표가 없습니다.');
  }

  return layerManager.addLayer({ name, features, geometryType: 'Point' });
}

/**
 * 격자로 묶어 칸마다 집계한 폴리곤 레이어를 만든다.
 * 중간에 포인트 레이어를 남기지 않는다 — 결과는 격자 하나다.
 *
 * @param {string} name 레이어 이름
 * @param {Object} result 중계 함수가 준 결과
 * @param {Object} options { cellSize, method, field }
 * @returns {string} 레이어 ID
 */
export function addGridLayer(name, result, options = {}) {
  const { cellSize, method = 'count', field } = options;

  const points = toMapPoints(result.items, result.epsg);
  if (points.length === 0) {
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

/**
 * 히트맵으로 만든다. 히트맵은 포인트 레이어를 받아 만들어지므로
 * 포인트를 먼저 올리고 원본은 숨긴다(기존 히트맵 도구의 규약).
 * @returns {string} 히트맵 레이어 ID
 */
export function addHeatmapLayer(name, result, options = {}) {
  // 히트맵 도구가 원본 이름 뒤에 '_히트맵'을 붙인다 — 여기서 군더더기를 더하지 않는다
  const pointLayerId = addPointLayer(name, result);
  return heatmapTool.createHeatmap(pointLayerId, {
    hideSource: true,
    weight: options.weight || null
  });
}
