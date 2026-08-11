// © 2026 김용현
/**
 * 공공데이터 불러오기 — 파라미터 폼 · 미리보기 · 포인트 레이어 생성.
 *
 * 중계 함수(/api/pubdata)가 좌표계 코드(epsg)만 실어 보내고 변환은 하지 않는다.
 * 지도는 EPSG:3857이므로 여기서 바꾼다. 포털은 위경도로도 주고 TM 좌표로도 준다.
 */

import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat, transform } from 'ol/proj.js';
import { layerManager } from '../../core/LayerManager.js';

const PREVIEW_ROWS = 5;

/** 항목이 요구하는 선택지를 폼으로 만든다 */
export function renderParamForm(entry) {
  const params = (entry && entry.params) || [];
  if (params.length === 0) return '';

  return params.map(param => {
    const control = param.type === 'select'
      ? `<select class="public-data-param" data-param="${param.key}">
           ${(param.options || []).map(option =>
             `<option value="${option.value}">${option.label}</option>`).join('')}
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
 * 정규화된 항목 → 지도 좌표계(EPSG:3857)의 피처.
 * 변환할 수 없는 좌표계면 그 점은 버린다 (지도 밖 엉뚱한 곳에 찍히는 것보다 낫다).
 */
export function toFeatures(items, epsg) {
  const code = Number(epsg) || 4326;
  const features = [];

  for (const item of items || []) {
    let coordinate;
    try {
      coordinate = code === 4326
        ? fromLonLat([item.lon, item.lat])
        : transform([item.lon, item.lat], `EPSG:${code}`, 'EPSG:3857');
    } catch (e) {
      continue;
    }
    if (!coordinate || !isFinite(coordinate[0]) || !isFinite(coordinate[1])) continue;

    features.push(new Feature({ geometry: new Point(coordinate), ...(item.props || {}) }));
  }

  return features;
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
