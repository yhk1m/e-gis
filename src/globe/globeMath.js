// © 2026 김용현
/**
 * 지구본 조작 수학 — d3·DOM 을 모른다.
 *
 * d3 투영의 rotate([λ, φ, γ]) 는 "지구를 얼마나 돌렸나"라서, 경위도 (lon, lat) 를
 * 화면 가운데 두려면 [-lon, -lat] 이다. 이 부호 뒤집기를 여기 두 함수에 가둔다.
 */

/** 드래그 감도: scale 이 1 일 때 1px 당 도. 실제 감도는 DRAG_DEG_PER_PX / scale. */
export const DRAG_DEG_PER_PX = 75;

/** 맞춤 배율(fit) 대비 확대 범위 */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;

/** 휠 한 눈금(deltaY 100)당 약 1.22배 */
const WHEEL_SENSITIVITY = 0.002;

export function normalizeLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function clampLat(lat) {
  return Math.max(-90, Math.min(90, lat));
}

/** 화면 가운데 경위도 → d3 rotate */
export function rotationFromCenter([lon, lat]) {
  return [-lon, -lat, 0];
}

/** d3 rotate → 화면 가운데 경위도 */
export function centerFromRotation([lambda, phi]) {
  return [normalizeLon(-lambda), clampLat(-phi)];
}

/**
 * 드래그 뒤 회전.
 * 오른쪽으로 끌면(dx>0) 지구가 오른쪽으로 돌아 서쪽이 가운데로 온다 → λ 증가.
 * 아래로 끌면(dy>0) 북쪽이 가운데로 온다 → φ 감소.
 * @param {number[]} rotation [λ, φ, γ]
 * @param {'azimuthal'|'cylindrical'} kind cylindrical 은 λ 만
 */
export function rotationAfterDrag(rotation, dx, dy, scale, kind) {
  // 배율이 0 이하·NaN 이거나 이동량이 유한하지 않으면 돌리지 않는다 — NaN 이 회전에 스며들면 지구본이 사라진다
  if (!(scale > 0) || !Number.isFinite(dx + dy)) return rotation;
  const degPerPx = DRAG_DEG_PER_PX / scale;
  const lambda = normalizeLon(rotation[0] + dx * degPerPx);
  const phi = kind === 'azimuthal' ? clampLat(rotation[1] - dy * degPerPx) : rotation[1];
  return [lambda, phi, rotation[2] || 0];
}

export function clampScale(scale, fit) {
  return Math.min(fit * MAX_ZOOM, Math.max(fit * MIN_ZOOM, scale));
}

/** 휠·트랙패드: deltaY 가 음수(위로)면 확대 */
export function scaleAfterWheel(scale, deltaY, fit) {
  return clampScale(scale * Math.exp(-deltaY * WHEEL_SENSITIVITY), fit);
}
