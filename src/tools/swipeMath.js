// © 2026 김용현
/**
 * 스와이프 비교 — 순수 계산.
 *
 * DOM·OpenLayers 를 모른다. SwipeTool(클립)과 SwipePanel(막대·목록)이 여기 결과를 쓴다.
 * 좌표는 전부 지도 뷰포트 기준 CSS 픽셀이다. 캔버스 픽셀로의 변환은
 * SwipeTool 이 ol/render.getRenderPixel 로 한다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「3단계」
 */

export const ORIENTATIONS = ['vertical', 'horizontal'];

/** 0~1 로 자른다. 숫자가 아니면 가운데. */
export function clampRatio(ratio) {
  if (typeof ratio !== 'number' || Number.isNaN(ratio)) return 0.5;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * 대상 레이어가 보이는 사각형의 네 모서리(시계 방향, 왼쪽 위부터).
 * 세로 막대: 왼쪽 ratio 만큼. 가로 막대: 위쪽 ratio 만큼.
 * @param {number[]|null|undefined} size map.getSize() — [폭, 높이]
 * @param {number} ratio 0~1
 * @param {'vertical'|'horizontal'} orientation
 * @returns {number[][]} [[x,y] × 4]
 */
export function swipeClipCorners(size, ratio, orientation) {
  const w = size && size[0] > 0 ? size[0] : 0;
  const h = size && size[1] > 0 ? size[1] : 0;
  const r = clampRatio(ratio);
  if (orientation === 'horizontal') {
    const y = h * r;
    return [[0, 0], [w, 0], [w, y], [0, y]];
  }
  const x = w * r;
  return [[0, 0], [x, 0], [x, h], [0, h]];
}

/**
 * 포인터 위치 → 비율. 지도 사각형 밖이면 0 또는 1.
 * @param {{clientX: number, clientY: number}} event
 * @param {{left: number, top: number, width: number, height: number}} rect 지도 요소의 getBoundingClientRect()
 * @param {'vertical'|'horizontal'} orientation
 */
export function ratioFromPointer(event, rect, orientation) {
  if (orientation === 'horizontal') {
    if (!rect.height) return 0.5;
    return clampRatio((event.clientY - rect.top) / rect.height);
  }
  if (!rect.width) return 0.5;
  return clampRatio((event.clientX - rect.left) / rect.width);
}

/** 막대 요소의 인라인 스타일. 세로면 left, 가로면 top 만 움직인다. */
export function dividerStyle(ratio, orientation) {
  const pct = `${clampRatio(ratio) * 100}%`;
  return orientation === 'horizontal' ? { left: '0', top: pct } : { left: pct, top: '0' };
}

/**
 * 비교 대상 select 의 항목.
 * 레이어는 화면에서 위에 있는 것(layerOrder 의 끝)부터, 배경지도는 현재 것과 hidden 묶음을 뺀다.
 * 히트맵(type 'heatmap', ol/layer/Heatmap)은 WebGL 로 그려서 뺀다. 렌더 이벤트의 context 가
 * WebGLRenderingContext 라 2D save/clip 이 없다(자르려면 gl.scissor 가 필요 — 1차 범위 밖).
 * @param {{id: string, name: string, type?: string}[]} layers layerManager.getAllLayers() (index 0 이 맨 아래)
 * @param {{key: string, label: string, group: string}[]} basemaps mapManager.getAvailableBasemaps()
 * @param {string} currentBasemap mapManager.getBasemap()
 * @returns {{value: string, label: string, group: 'layer'|'basemap'}[]}
 */
export function swipeTargetOptions(layers, basemaps, currentBasemap) {
  const layerOptions = layers.filter((l) => l.type !== 'heatmap').reverse().map((l) => ({
    value: `layer:${l.id}`, label: l.name || l.id, group: 'layer'
  }));
  const basemapOptions = basemaps
    .filter((b) => b.group !== 'hidden' && b.key !== currentBasemap)
    .map((b) => ({
      value: `basemap:${b.key}`,
      label: b.group === 'korea' ? `VWorld ${b.label}` : b.label,
      group: 'basemap'
    }));
  return [...layerOptions, ...basemapOptions];
}

/** select 값 'layer:<id>' | 'basemap:<key>' 를 푼다. 모양이 아니면 null. */
export function parseTargetValue(value) {
  if (typeof value !== 'string') return null;
  const idx = value.indexOf(':');
  if (idx <= 0) return null;
  const kind = value.slice(0, idx);
  const id = value.slice(idx + 1);
  if ((kind !== 'layer' && kind !== 'basemap') || !id) return null;
  return { kind, id };
}
