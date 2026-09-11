// © 2026 김용현
/**
 * flowGeometry — 화면 픽셀 좌표계의 순수 기하.
 * 곡선은 2차 베지어 하나로 충분하다(flowmap.blue 도 완만한 호 하나).
 */

/**
 * p0 → p1 굽은 곡선의 점 목록.
 * 진행 방향의 오른쪽으로 굽혀 A→B 와 B→A 가 서로 반대편으로 갈라진다.
 * @param {[number,number]} p0
 * @param {[number,number]} p1
 * @param {{ bend?: number, samples?: number }} [o]  bend = 현 길이 대비 굽힘 비율
 */
export function curvePoints(p0, p1, { bend = 0.2, samples = 24 } = {}) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [p0.slice(), p1.slice()];
  // 화면 좌표(y 아래)에서 (dx,dy)의 오른쪽 법선은 (-dy, dx)
  const cx = (p0[0] + p1[0]) / 2 + (-dy / len) * bend * len;
  const cy = (p0[1] + p1[1]) / 2 + (dx / len) * bend * len;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    pts.push([
      u * u * p0[0] + 2 * u * t * cx + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * cy + t * t * p1[1]
    ]);
  }
  return pts;
}

/**
 * 폴리라인을 따라 폭이 w0(출발) → w1(도착) 로 변하는 닫힌 다각형.
 * 왼쪽 변을 앞으로, 오른쪽 변을 뒤로 이어 fill 한 번으로 그린다.
 */
export function taperOutline(points, w0, w1) {
  const n = points.length;
  if (n < 2) return [];
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    let nx = -(next[1] - prev[1]);
    let ny = next[0] - prev[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const half = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    left.push([points[i][0] + nx * half, points[i][1] + ny * half]);
    right.push([points[i][0] - nx * half, points[i][1] - ny * half]);
  }
  return left.concat(right.reverse());
}

/** 점에서 폴리라인까지의 최단 거리 (테스트·검증용) */
export function distanceToPolyline(pt, points) {
  if (points.length === 1) return Math.hypot(pt[0] - points[0][0], pt[1] - points[0][1]);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const vx = bx - ax, vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.min(1, Math.max(0, ((pt[0] - ax) * vx + (pt[1] - ay) * vy) / len2));
    best = Math.min(best, Math.hypot(pt[0] - (ax + vx * t), pt[1] - (ay + vy * t)));
  }
  return best;
}
