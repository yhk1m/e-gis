// © 2026 김용현
/**
 * voronoiHelpers - 보로노이 도구의 순수 헬퍼
 *
 * 이 파일은 아무것도 import하지 않는다. VoronoiTool.js는 layerManager를 통해
 * OpenLayers 전체를 끌어오므로, 순수 계산을 여기로 분리해 단위 테스트를 가볍게 유지한다.
 * 좌표는 모두 EPSG:3857 미터 단위다.
 */

/** 중복 판정 격자 크기(m). 1mm. */
const DEDUPE_PRECISION = 0.001;

/** bbox 여유 비율 (기준 extent 폭·높이 대비) */
const BBOX_PADDING_RATIO = 0.1;

/** extent 폭 또는 높이가 0일 때 쓸 절대 여유(m) */
const BBOX_MIN_PADDING = 1000;

/**
 * 겹친 시드를 제거한다.
 *
 * d3-voronoi는 겹친 좌표에 셀을 만들지 않고 sparse array에 구멍을 남긴다(예외는 아니다).
 * 걸러내지 않으면 그 점들이 조용히 셀 없이 사라져 사용자가 포인트보다 셀이 적은
 * 이유를 알 수 없다. 제거한 개수를 세어 보고하려고 선행한다.
 *
 * @param {Array<{coord: number[], properties: Object}>} seeds
 * @returns {{seeds: Array<{coord: number[], properties: Object}>, duplicates: number}} duplicates는 제거된 개수
 */
export function dedupeSeeds(seeds) {
  const seen = new Set();
  const kept = [];
  let duplicates = 0;

  for (const seed of seeds) {
    const key =
      Math.round(seed.coord[0] / DEDUPE_PRECISION) + ',' +
      Math.round(seed.coord[1] / DEDUPE_PRECISION);

    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    kept.push(seed);
  }

  return { seeds: kept, duplicates };
}

/**
 * 보로노이 클립 사각형을 만든다.
 *
 * 경계 레이어가 있으면 시드 extent와 합집합을 취한다. 경계 밖 시드도 경계 안쪽으로
 * 셀을 밀어넣기 때문에 시드 extent만 쓰면 안 된다.
 *
 * @param {number[]} seedExtent - [minX, minY, maxX, maxY] (EPSG:3857)
 * @param {number[]|null} boundaryExtent - 경계 레이어 extent, 없으면 null
 * @returns {number[]} [minX, minY, maxX, maxY]
 */
export function computeBBox(seedExtent, boundaryExtent = null) {
  let [minX, minY, maxX, maxY] = seedExtent;

  if (boundaryExtent) {
    minX = Math.min(minX, boundaryExtent[0]);
    minY = Math.min(minY, boundaryExtent[1]);
    maxX = Math.max(maxX, boundaryExtent[2]);
    maxY = Math.max(maxY, boundaryExtent[3]);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // 시드가 한 점이거나 일직선이면 비율 여유가 0이 되어 bbox가 축퇴한다.
  const padX = width > 0 ? width * BBOX_PADDING_RATIO : BBOX_MIN_PADDING;
  const padY = height > 0 ? height * BBOX_PADDING_RATIO : BBOX_MIN_PADDING;

  return [minX - padX, minY - padY, maxX + padX, maxY + padY];
}

/**
 * 기존 속성과 충돌하지 않는 필드명을 만든다.
 *
 * 원본 포인트에 이미 area_km2가 있을 수 있으므로 조용히 덮어쓰지 않는다.
 *
 * @param {string} baseName - 붙이려는 기본 필드명
 * @param {string[]} existingKeys - 검사 대상 전체 레코드에 등장하는 모든 키의 합집합.
 *   레코드 하나만 보고 넘기면 안 된다. 한 레이어 안에서도 피처마다 키가 다를 수 있다
 *   (TableJoinTool은 조인 키가 맞은 피처에만 필드를 붙인다 — TableJoinTool.js:237).
 * @returns {string} 충돌하지 않는 필드명
 */
export function resolveFieldName(baseName, existingKeys) {
  const taken = new Set(existingKeys);
  if (!taken.has(baseName)) return baseName;

  let i = 1;
  while (taken.has(`${baseName}_${i}`)) i++;
  return `${baseName}_${i}`;
}
