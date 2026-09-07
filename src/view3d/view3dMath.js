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
