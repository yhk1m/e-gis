// © 2026 김용현
/**
 * 3D 카메라와 2D 지도 뷰 사이의 환산.
 *
 * three도 OpenLayers도 import 하지 않는다 — 숫자만 다룬다.
 */

const toRad = (deg) => (deg * Math.PI) / 180;

/** 세로 sizeMeters 만큼을 화면에 담으려면 카메라가 얼마나 떨어져야 하는가 */
export function distanceForExtent(sizeMeters, fovDeg) {
  return sizeMeters / 2 / Math.tan(toRad(fovDeg) / 2);
}

/** 그 거리에서의 지도 해상도(미터/픽셀) */
export function resolutionForDistance(distance, fovDeg, viewportHeightPx) {
  const visible = 2 * distance * Math.tan(toRad(fovDeg) / 2);
  return visible / viewportHeightPx;
}

/**
 * 씬 좌표 → 지도 좌표(EPSG:3857).
 * sceneX = mapX - cx, sceneZ = -(mapY - cy) 의 역이다.
 */
export function sceneToMap({ x, z }, [cx, cy]) {
  return [cx + x, cy - z];
}

/**
 * 메시 원점이 oldCenter에서 newCenter로 옮겨갈 때,
 * 화면이 튀지 않도록 카메라와 타깃을 밀 양.
 */
export function rebaseOffset([oldCx, oldCy], [newCx, newCy]) {
  return { dx: oldCx - newCx, dz: newCy - oldCy };
}

/**
 * 여러 범위를 합친 가운데 좌표. 쓸 만한 범위가 하나도 없으면 null.
 *
 * 3D를 켤 때 회전 중심(고정점)을 화면 한가운데가 아니라
 * **지금 올라와 있는 레이어의 가운데**에 두려고 쓴다.
 *
 * @param {Array<number[]|null|undefined>} extents [minX, minY, maxX, maxY] 목록
 * @returns {number[]|null} [x, y]
 */
export function combinedExtentCenter(extents) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const extent of extents || []) {
    if (!extent || extent.length < 4) continue;
    if (!extent.every(Number.isFinite)) continue;   // OL은 빈 소스에 무한대 범위를 준다
    minX = Math.min(minX, extent[0]);
    minY = Math.min(minY, extent[1]);
    maxX = Math.max(maxX, extent[2]);
    maxY = Math.max(maxY, extent[3]);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * 카메라가 바라보는 방위각(라디안). 북쪽 기준 시계 방향.
 *
 * 씬 좌표에서 북쪽은 -Z다(sceneZ = -(mapY - cy)). 방위표시는 이 값의 반대로
 * 돌리면 된다 — 카메라가 동쪽을 보면 북쪽은 화면 왼쪽에 있다.
 *
 * @param {{x:number, z:number}} camera 카메라 위치
 * @param {{x:number, z:number}} target 바라보는 점
 * @returns {number} 라디안 (-π, π]. 수직으로 내려다보면 0
 */
export function viewBearing(camera, target) {
  const fx = target.x - camera.x;
  const fz = target.z - camera.z;
  if (fx === 0 && fz === 0) return 0;
  return Math.atan2(fx, -fz);
}
