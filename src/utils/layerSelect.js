// © 2026 김용현
/**
 * layerSelect - 패널 레이어 드롭다운 공통 규칙
 *
 * 모든 기능(패널)은 레이어를 미리 고르지 않아도 열리고, 레이어는 패널 안에서 고른다.
 * 열 때 레이어 패널에서 선택 중인 레이어가 그 기능이 지원하는 레이어면 미리 골라 주고,
 * 지원하지 않는 레이어이거나 선택이 없으면 '-- 레이어 선택 --' 상태로 둔다.
 *
 * layerManager를 import하지 않는 순수 모듈이다. 호출부에서 선택 레이어 id를 넘긴다.
 */

export const LAYER_PLACEHOLDER = '-- 레이어 선택 --';

/**
 * 피처를 다룰 수 있는 벡터 레이어인지 판별한다.
 * 래스터(source 없음)·히트맵·도형표현도(구운 아이콘)는 제외한다.
 */
export function isVectorLayer(layerInfo) {
  return !!layerInfo &&
    layerInfo.type === 'vector' &&
    !!layerInfo.source &&
    typeof layerInfo.source.getFeatures === 'function';
}

/**
 * 드롭다운의 초기 선택값을 정한다.
 * @param {Array} layers 이 기능이 지원하는 레이어 목록
 * @param {string|null} selectedLayerId 현재 선택 중인 레이어 id
 * @returns {string} 목록에 있으면 그 id, 없으면 '' (플레이스홀더)
 */
export function resolveInitialLayerId(layers, selectedLayerId) {
  if (!selectedLayerId || !Array.isArray(layers)) return '';
  return layers.some(l => l && l.id === selectedLayerId) ? selectedLayerId : '';
}

/**
 * 레이어 <option> 목록 HTML을 만든다. 첫 항목은 항상 플레이스홀더다.
 * @param {Array} layers
 * @param {Object} [options]
 * @param {string} [options.selectedId] 미리 고를 레이어 id ('' 이면 플레이스홀더가 선택됨)
 * @param {string} [options.placeholder]
 * @param {boolean} [options.showCount] 이름 뒤에 피처 수 표시
 */
export function buildLayerOptions(layers, options = {}) {
  const selectedId = options.selectedId || '';
  const placeholder = options.placeholder || LAYER_PLACEHOLDER;
  const showCount = options.showCount === true;

  const head = '<option value=""' + (selectedId ? '' : ' selected') + '>' +
    escapeHtml(placeholder) + '</option>';

  const body = (layers || []).map(l => {
    const count = showCount && typeof l.featureCount === 'number' ? ' (' + l.featureCount + ')' : '';
    return '<option value="' + escapeHtml(l.id) + '"' +
      (l.id === selectedId ? ' selected' : '') + '>' +
      escapeHtml(l.name) + count + '</option>';
  }).join('');

  return head + body;
}

/**
 * 속성 목록을 만들 때 첫 피처만 보면 안 되는 이유:
 * 테이블 결합은 CSV에 짝이 있는 피처에만 필드를 붙이고, 공간 연산 결과도
 * 피처마다 필드 구성이 다를 수 있다. 첫 피처에 그 필드가 없다는 이유로
 * "적용할 수 있는 레이어가 없다"고 판정하면 안 된다.
 *
 * 그래서 아래 두 함수는 전체 피처를 훑어 필드 이름의 합집합을 만든다.
 * (이미 확정된 필드는 다시 검사하지 않아 실사용 레이어에서는 충분히 빠르다)
 */

/** 속성값이 숫자로 쓸 수 있는지 판별한다. 숫자 문자열("103")도 숫자로 본다. */
export function isNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && !isNaN(parseFloat(trimmed));
  }
  return false;
}

/**
 * 피처들의 속성 이름을 처음 나온 순서대로 모은다 (geometry 제외).
 * @param {Array} features OpenLayers 피처 배열
 * @returns {string[]}
 */
export function collectFieldNames(features) {
  const names = [];
  const seen = new Set();

  for (const feature of features || []) {
    for (const key of featureKeys(feature)) {
      if (key === 'geometry' || seen.has(key)) continue;
      seen.add(key);
      names.push(key);
    }
  }

  return names;
}

/**
 * 숫자로 쓸 수 있는 속성 이름을 모은다.
 * 어느 한 피처에서라도 숫자 값이 나오면 숫자 필드로 본다.
 * (값이 비어 있는 피처가 섞여 있어도 필드를 놓치지 않기 위해서다)
 * @param {Array} features OpenLayers 피처 배열
 * @returns {string[]}
 */
export function collectNumericFields(features) {
  const names = [];
  const numeric = new Set();

  for (const feature of features || []) {
    for (const key of featureKeys(feature)) {
      if (key === 'geometry' || numeric.has(key)) continue;
      if (isNumericValue(feature.get(key))) {
        numeric.add(key);
        names.push(key);
      }
    }
  }

  return names;
}

/** 피처의 속성 키 목록 (getKeys가 없으면 getProperties로 대체) */
function featureKeys(feature) {
  if (!feature) return [];
  if (typeof feature.getKeys === 'function') return feature.getKeys();
  if (typeof feature.getProperties === 'function') return Object.keys(feature.getProperties());
  return [];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
