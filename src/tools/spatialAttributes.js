// © 2026 김용현
/**
 * spatialAttributes - 공간 연산 결과의 속성 승계 규칙
 *
 * 교차·클리핑처럼 두 레이어에서 하나의 피처가 만들어질 때 양쪽 속성을 모두 물려준다.
 * - 이름과 값이 모두 같으면 → 하나만 남긴다 (같은 정보를 두 칸에 적지 않는다)
 * - 이름만 같고 값이 다르면 → 레이어2 쪽에 _2를 붙여 둘 다 보존한다 (정보 손실 방지)
 *
 * layerManager·turf에 의존하지 않는 순수 모듈이다.
 */

/** 승계에서 제외할 키 (OpenLayers 피처의 지오메트리 슬롯) */
const EXCLUDED_KEYS = ['geometry'];

/** 접미사 탐색 상한 — 같은 이름이 이만큼 겹치는 일은 실사용에서 없다 */
const SUFFIX_LIMIT = 100;

/**
 * 두 속성값이 같은 정보인지 판단한다.
 * 원시값은 엄격 비교(5와 "5"는 다른 값), 객체·배열은 내용으로 비교한다.
 */
export function isSameValue(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  }
  return false;
}

/**
 * target에 아직 없는 이름을 key_2, key_3... 순으로 찾는다.
 */
export function uniqueKey(target, key) {
  for (let i = 2; i < 2 + SUFFIX_LIMIT; i++) {
    const candidate = key + '_' + i;
    if (!(candidate in target)) return candidate;
  }
  return key + '_dup';
}

/**
 * 두 피처의 속성을 병합한다. 레이어1 값이 우선이다.
 * @param {Object|null} props1 레이어1 속성
 * @param {Object|null} props2 레이어2 속성
 * @returns {Object} 병합된 속성
 */
export function mergeProperties(props1, props2) {
  const merged = {};

  for (const [key, value] of Object.entries(props1 || {})) {
    if (EXCLUDED_KEYS.includes(key)) continue;
    merged[key] = value;
  }

  for (const [key, value] of Object.entries(props2 || {})) {
    if (EXCLUDED_KEYS.includes(key)) continue;
    if (!(key in merged)) {
      merged[key] = value;
    } else if (!isSameValue(merged[key], value)) {
      merged[uniqueKey(merged, key)] = value;
    }
    // 이름·값이 모두 같으면 아무것도 하지 않는다 (하나만 승계)
  }

  return merged;
}

/**
 * 속성에 값을 덧붙이되, 이름이 겹치면 _2를 붙여 원본을 보존한다.
 * (합집합 '피처 유지' 모드의 출처 레이어 표시에 쓴다)
 */
export function withTag(props, key, value) {
  const tagged = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (EXCLUDED_KEYS.includes(k)) continue;
    tagged[k] = v;
  }
  tagged[key in tagged ? uniqueKey(tagged, key) : key] = value;
  return tagged;
}
