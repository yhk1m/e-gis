// © 2026 김용현
/**
 * 시계열 단계구분도 — 순수 규칙.
 *
 * DOM·OpenLayers 를 모른다. 피처는 `get(key)` 만 있으면 된다(OL Feature 도 맞는다).
 * 시계열은 단계구분도 설정(_choroplethConfig)에 `timeSeries: { fields, index }` 를 더한 것이다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「4단계」
 */

/** 한 시계열에 넣을 수 있는 필드 수 (스펙: 30개까지) */
export const MAX_TIME_SERIES_FIELDS = 30;

/** 연도로 시작하는 필드 이름 — 스펙의 「연도 자동 선택」 규칙 */
export const YEAR_FIELD_RE = /^(19|20)\d{2}/;

/**
 * @param {string[]} fields 속성 이름 목록(속성 순서)
 * @returns {string[]} 연도로 시작하는 이름들, 같은 순서
 */
export function detectYearFields(fields) {
  return (fields || []).filter((f) => YEAR_FIELD_RE.test(String(f)));
}

/**
 * 선택한 모든 필드의 숫자 값을 합쳐 오름차순으로.
 * 구간을 연도 사이에 공유하려면 이 배열로 한 번만 계산해야 한다.
 */
export function unionValues(features, fields) {
  const values = [];
  for (const feature of features || []) {
    for (const field of fields || []) {
      const raw = feature.get(field);
      if (raw === null || raw === undefined || raw === '') continue;
      const num = typeof raw === 'number' ? raw : parseFloat(raw);
      if (Number.isFinite(num)) values.push(num);
    }
  }
  return values.sort((a, b) => a - b);
}

/** 재생 중 다음 칸 — 끝에서 처음으로 */
export function nextIndex(index, count) {
  if (!(count > 0)) return 0;
  return (index + 1) % count;
}

/** 범례 부제: 현재 필드와 위치 */
export function subtitleFor(field, index, count) {
  return `${field} (${index + 1}/${count})`;
}

/** 파생 레이어 이름 규칙 — 스펙: 원본_시계열_첫필드~끝필드 */
export function derivedLayerName(sourceName, fields) {
  return `${sourceName}_시계열_${fields[0]}~${fields[fields.length - 1]}`;
}

/**
 * 저장용 레코드(깊은 복사). 시계열이 아니면 undefined 라 JSON 에서 빠진다.
 * StateManager.saveLayer 와 ProjectManager.serialize 가 같은 함수를 쓴다.
 */
export function timeSeriesRecord(ts) {
  if (!ts || !Array.isArray(ts.fields) || ts.fields.length < 2) return undefined;
  return { fields: ts.fields.slice(), index: Number.isInteger(ts.index) ? ts.index : 0 };
}

/**
 * 복원값 정돈 — 저장본이 손상됐거나 옛 형식이어도 앱이 죽지 않게.
 * @returns {{fields: string[], index: number}|null}
 */
export function normalizeTimeSeries(raw) {
  if (!raw || !Array.isArray(raw.fields)) return null;
  const fields = raw.fields.filter((f) => typeof f === 'string' && f.length > 0).slice(0, MAX_TIME_SERIES_FIELDS);
  if (fields.length < 2) return null;
  const index = Number.isInteger(raw.index) ? Math.max(0, Math.min(fields.length - 1, raw.index)) : 0;
  return { fields, index };
}
