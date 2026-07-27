// © 2026 김용현
/**
 * colorRamp - 색 램프에서 원하는 개수만큼 색을 뽑는 공통 규칙
 *
 * 팔레트는 칸 수가 정해져 있지만 실제로 칠해야 할 구간 수는 그때그때 다르다.
 * 앞에서부터 한 칸씩 잘라 쓰면 구간이 적을 때는 램프의 한쪽 끝만,
 * 구간이 많을 때는 마지막 색이 계속 되풀이된다.
 * 여기서는 언제나 램프 전체를 쓰도록 양 끝을 고정하고 사이를 보간한다.
 */

/**
 * 두 색 사이를 보간한다.
 * @param {string} color1 - '#rrggbb'
 * @param {string} color2 - '#rrggbb'
 * @param {number} t - 0이면 color1, 1이면 color2
 * @returns {string} '#rrggbb'
 */
export function lerpColor(color1, color2, t) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}

/**
 * 램프에서 count개를 고르게 뽑는다. 양 끝 색은 반드시 포함된다.
 * 램프 칸 수보다 많이 뽑아도 색이 겹치지 않는다 — 사이를 보간해서 채운다.
 *
 * @param {string[]} rampColors - 램프 색상 ('#rrggbb', 낮음 → 높음 순)
 * @param {number} count - 뽑을 색 개수
 * @returns {string[]} count개의 색상
 */
export function sampleColorRamp(rampColors, count) {
  if (!rampColors || rampColors.length === 0) return [];
  if (count <= 0) return [];
  if (rampColors.length === 1) return Array(count).fill(rampColors[0]);
  // 하나만 뽑을 땐 램프의 대표색(높음 쪽 끝)
  if (count === 1) return [rampColors[rampColors.length - 1]];

  const result = [];
  for (let i = 0; i < count; i++) {
    const pos = (i / (count - 1)) * (rampColors.length - 1);
    const idx = Math.floor(pos);
    if (idx >= rampColors.length - 1) {
      result.push(rampColors[rampColors.length - 1]);
    } else {
      result.push(lerpColor(rampColors[idx], rampColors[idx + 1], pos - idx));
    }
  }
  return result;
}

/**
 * '#rrggbb'를 rgba() 문자열로 바꾼다 (반투명 채움용).
 * @param {string} hex - '#rrggbb'
 * @param {number} alpha - 0~1
 */
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
