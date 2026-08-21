// © 2026 김용현
/**
 * gridPoints - 레이어의 피처에서 격자 집계에 쓸 점을 뽑는다.
 *
 * OpenLayers·레이어를 모르는 순수 모듈이다. 피처는 getGeometry()/getProperties()
 * 만 있으면 되고, 도형은 좌표를 돌려주는 것으로 충분하다.
 */

/** 격자로 묶을 수 있는 도형인가 — 점 계열만 받는다 */
const POINT_TYPES = new Set(['Point', 'MultiPoint']);

/**
 * 피처 목록에서 점 좌표와 속성을 뽑는다.
 * MultiPoint 는 점 하나하나를 따로 센다 — 한 피처가 여러 자리에 있으면 그게 맞다.
 *
 * @param {Array} features ol/Feature 배열
 * @returns {Array<{x:number, y:number, props:Object}>}
 */
export function featuresToPoints(features) {
  const points = [];

  for (const feature of features || []) {
    if (!feature || typeof feature.getGeometry !== 'function') continue;

    const geometry = feature.getGeometry();
    if (!geometry || typeof geometry.getType !== 'function') continue;
    if (!POINT_TYPES.has(geometry.getType())) continue;

    const props = { ...(typeof feature.getProperties === 'function' ? feature.getProperties() : {}) };
    delete props.geometry;

    const coordinates = geometry.getType() === 'Point'
      ? [geometry.getCoordinates()]
      : geometry.getCoordinates();

    for (const coordinate of coordinates || []) {
      const x = Number(coordinate && coordinate[0]);
      const y = Number(coordinate && coordinate[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      points.push({ x, y, props });
    }
  }

  return points;
}

/** 격자 크기 선택지 (m). '직접 입력'은 값이 비어 있다. */
export const CELL_SIZE_OPTIONS = [
  { value: '500', label: '500m' },
  { value: '1000', label: '1km' },
  { value: '5000', label: '5km' },
  { value: '10000', label: '10km' },
  { value: '', label: '직접 입력' }
];

/** 직접 입력에서 받아들일 최소 크기(m). 더 잘게 쪼개면 칸 수가 폭발한다. */
export const MIN_CELL_SIZE = 10;

/**
 * 고른 값과 직접 입력값에서 격자 크기를 정한다.
 * @param {string} selected 드롭다운 값 ('' 이면 직접 입력)
 * @param {string} typed 직접 입력 칸의 값
 * @returns {{cellSize:number}|{error:string}}
 */
export function resolveCellSize(selected, typed) {
  const raw = selected === '' ? typed : selected;
  const text = String(raw === undefined || raw === null ? '' : raw).trim();

  if (text === '') {
    return { error: '격자 크기를 입력해 주세요.' };
  }

  const size = Number(text);
  if (!Number.isFinite(size) || size <= 0) {
    return { error: '격자 크기는 0보다 큰 숫자여야 합니다.' };
  }
  if (size < MIN_CELL_SIZE) {
    return { error: `격자 크기는 ${MIN_CELL_SIZE}m 이상이어야 합니다.` };
  }

  return { cellSize: size };
}

/**
 * 숫자로 집계할 수 있는 속성 이름을 고른다 (합계·평균에서 쓴다).
 * 한 점이라도 숫자로 읽히면 후보로 본다 — 결측이 섞인 자료가 흔하다.
 *
 * @param {Array<{props:Object}>} points
 * @returns {Array<string>}
 */
export function numericFields(points) {
  const names = [];
  const seen = new Set();

  for (const point of points || []) {
    for (const [name, value] of Object.entries(point.props || {})) {
      if (seen.has(name)) continue;
      const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
      if (String(value ?? '').trim() !== '' && Number.isFinite(number)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  return names;
}
