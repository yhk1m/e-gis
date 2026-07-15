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

/**
 * 겹친 시드를 제거한다.
 *
 * turf.voronoi가 중복 좌표에서 TypeError로 죽기 때문에 반드시 선행되어야 한다.
 *
 * @param {Array<{coord: number[], properties: Object}>} seeds
 * @returns {{seeds: Array, duplicates: number}} duplicates는 제거된 개수
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
