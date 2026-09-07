// © 2026 김용현
/**
 * 지도 화면을 캔버스 한 장으로 합친다 — 3D 지형에 입힐 텍스처.
 *
 * OpenLayers는 레이어마다 캔버스를 따로 두고, 애니메이션 중에는 각 캔버스에
 * CSS transform을 걸어 둔다. 그 변형과 투명도를 그대로 재현해야 화면과 같아진다.
 *
 * html2canvas를 쓰지 않는 이유: DOM을 훑어 느리다. 3D는 이동할 때마다 다시 뽑아야 해서
 * 속도가 요건이다. 여기서는 drawImage 몇 번으로 끝난다.
 */

/** 텍스처 한 변의 최대 픽셀 — GPU 메모리를 지킨다 */
export const MAX_TEXTURE_SIZE = 2048;

/**
 * 무엇을 어떻게 그릴지 계산한다. 캔버스 API를 쓰지 않아 단독으로 테스트된다.
 *
 * 출력 크기는 **지도 뷰포트 크기 × 기기 픽셀비**다. 레이어 캔버스 크기가 아니다 —
 * OpenLayers는 뷰포트보다 큰 캔버스를 잡아 두고 transform으로 위치를 맞춘다.
 * 캔버스 크기를 그대로 쓰면 텍스처에 빈 여백이 생기고, 그 여백이 3D 지형에
 * 검은 띠로 나타난다. 반대로 CSS 픽셀 크기로 뽑으면 OL이 이미 그려 둔 해상도를
 * 버리게 된다(예: 1683px를 1122px로 줄여 씀).
 *
 * @param {Array} canvases OL 레이어 캔버스들 (DOM 순서)
 * @param {number[]} viewportSize 지도 크기 [너비, 높이] (CSS 픽셀)
 * @param {{pixelRatio?: number, maxSize?: number}} options
 * @returns {{width:number, height:number, scale:number,
 *            layers: Array<{canvas:Object, matrix:number[], alpha:number}>} | null}
 */
export function planComposition(canvases, viewportSize, { pixelRatio = 1, maxSize = MAX_TEXTURE_SIZE } = {}) {
  const drawable = Array.from(canvases).filter((c) => c.width > 0 && c.height > 0);
  if (drawable.length === 0) return null;

  const [viewportWidth, viewportHeight] = viewportSize || [];
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return null;

  const targetWidth = viewportWidth * pixelRatio;
  const targetHeight = viewportHeight * pixelRatio;
  const scale = Math.min(1, maxSize / Math.max(targetWidth, targetHeight));

  const width = Math.round(targetWidth * scale);
  const height = Math.round(targetHeight * scale);

  // 레이어의 transform은 CSS 픽셀 기준이라 픽셀비와 상한 배율을 함께 곱한다
  const k = pixelRatio * scale;

  const layers = drawable.map((canvas) => {
    const match = /^matrix\(([^)]+)\)$/.exec((canvas.style.transform || '').trim());
    const matrix = match
      ? match[1].split(',').map(Number).map((v) => v * k)
      // transform이 없으면 캔버스를 출력 크기에 맞춰 늘리거나 줄인다
      : [width / canvas.width, 0, 0, height / canvas.height, 0, 0];

    const raw = canvas.parentNode?.style?.opacity ?? canvas.style.opacity ?? '';
    const alpha = raw === '' ? 1 : Number(raw);

    return { canvas, matrix, alpha: Number.isFinite(alpha) ? alpha : 1 };
  });

  return { width, height, scale, layers };
}

/**
 * 지도 요소 안의 레이어 캔버스들을 한 장으로 합쳐 돌려준다.
 * 그릴 것이 없으면 null.
 *
 * @param {HTMLElement} mapElement `#map`
 * @param {{size?: number[], pixelRatio?: number, maxSize?: number, target?: HTMLCanvasElement}} options
 *        size는 지도 크기(map.getSize()). 없으면 요소 크기로 대신한다.
 *        pixelRatio는 OL이 그린 해상도(기본 기기 픽셀비).
 *        target을 주면 새로 만들지 않고 다시 쓴다(갱신마다 캔버스를 새로 만들지 않기 위함)
 * @returns {HTMLCanvasElement|null}
 */
export function composeMapCanvas(mapElement, {
  size, pixelRatio = window.devicePixelRatio || 1, maxSize = MAX_TEXTURE_SIZE, target
} = {}) {
  const viewportSize = size || [mapElement.clientWidth, mapElement.clientHeight];
  const canvases = mapElement.querySelectorAll('.ol-layer canvas, canvas.ol-layer');
  const plan = planComposition(canvases, viewportSize, { pixelRatio, maxSize });
  if (!plan) return null;

  const output = target || document.createElement('canvas');
  if (output.width !== plan.width) output.width = plan.width;
  if (output.height !== plan.height) output.height = plan.height;

  const ctx = output.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, output.width, output.height);

  for (const layer of plan.layers) {
    ctx.globalAlpha = layer.alpha;
    ctx.setTransform(...layer.matrix);
    ctx.drawImage(layer.canvas, 0, 0);
  }

  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return output;
}
