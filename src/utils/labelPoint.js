// © 2026 김용현
/**
 * labelPoint - 라벨을 붙일 지점 계산
 *
 * 여러 조각으로 된 행정구역(전남 40조각, 인천 11조각처럼 부속 도서가 많은 경우)은
 * 라벨이 본토 하나에만 붙어야 읽힌다.
 *
 * 그냥 두면 두 군데서 어긋난다:
 *  - OpenLayers의 Style.text는 MultiPolygon이면 조각마다 하나씩 그린다
 *    (TextBuilder가 getFlatInteriorPoints를 쓴다) → 섬 40개에 같은 이름이 40번
 *  - MultiPolygon에는 getInteriorPoint()가 없다(복수형만 있다). 이걸 부르던 쪽은
 *    예외로 떨어져 polygons[0]의 경계상자 중심을 썼는데, 그 첫 조각이 섬이면
 *    라벨이 바다 위에 찍힌다
 *
 * 그래서 "가장 넓은 조각의 내부점"을 한 곳에서 계산해 양쪽이 같이 쓴다.
 */

/** 지오메트리 → 라벨 좌표 캐시. 지오메트리는 만들고 나면 안 바뀌므로 안전하다. */
const pointCache = new WeakMap();

/** 링(외곽선)의 면적 — 신발끈 공식, 방향 무관하게 절댓값 */
function ringArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(sum) / 2;
}

/**
 * 가장 넓은 조각(본토)을 돌려준다.
 * @param {Object} geom OpenLayers 지오메트리
 * @returns {Object|null} Polygon (폴리곤 계열이 아니면 null)
 */
export function largestPolygon(geom) {
  if (!geom || typeof geom.getType !== 'function') return null;

  const type = geom.getType();
  if (type === 'Polygon') return geom;
  if (type !== 'MultiPolygon') return null;

  const polygons = geom.getPolygons();
  if (!polygons || polygons.length === 0) return null;
  if (polygons.length === 1) return polygons[0];

  let best = null;
  let bestArea = -Infinity;
  for (const polygon of polygons) {
    const rings = polygon.getCoordinates();
    const area = ringArea(rings && rings[0]);
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  return best;
}

/**
 * 라벨을 찍을 좌표. 폴리곤 계열이 아니면 null (호출 측이 기존 방식으로 처리한다).
 * @param {Object} geom OpenLayers 지오메트리
 * @returns {number[]|null} [x, y]
 */
export function labelPoint(geom) {
  if (!geom || typeof geom.getType !== 'function') return null;
  if (pointCache.has(geom)) return pointCache.get(geom);

  const polygon = largestPolygon(geom);
  if (!polygon) return null;

  let point = null;
  try {
    const interior = polygon.getInteriorPoint();
    const coords = interior && interior.getCoordinates();
    // 내부점은 [x, y, 폭] 3요소로 온다 — 앞 두 개만 쓴다
    if (coords && isFinite(coords[0]) && isFinite(coords[1])) {
      point = [coords[0], coords[1]];
    }
  } catch (e) {
    // 퇴화된 링이면 아래 경계상자 중심으로 폴백
  }

  if (!point) {
    const extent = polygon.getExtent();
    if (extent && isFinite(extent[0]) && isFinite(extent[2])) {
      point = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    }
  }

  if (point) pointCache.set(geom, point);
  return point;
}
