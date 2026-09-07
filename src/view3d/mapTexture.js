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
 * @param {Array} canvases OL 레이어 캔버스들 (DOM 순서)
 * @param {number} maxSize 한 변 최대 픽셀
 * @returns {{width:number, height:number, scale:number,
 *            layers: Array<{canvas:Object, matrix:number[], alpha:number}>} | null}
 */
export function planComposition(canvases, maxSize = MAX_TEXTURE_SIZE) {
  const drawable = Array.from(canvases).filter((c) => c.width > 0 && c.height > 0);
  if (drawable.length === 0) return null;

  const sourceWidth = drawable[0].width;
  const sourceHeight = drawable[0].height;
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));

  const layers = drawable.map((canvas) => {
    const match = /^matrix\(([^)]+)\)$/.exec((canvas.style.transform || '').trim());
    const base = match ? match[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
    // 전체 배율을 앞에 곱한다 — 행렬 각 항에 그대로 곱하면 된다
    const matrix = base.map((v) => v * scale);

    const raw = canvas.parentNode?.style?.opacity ?? canvas.style.opacity ?? '';
    const alpha = raw === '' ? 1 : Number(raw);

    return { canvas, matrix, alpha: Number.isFinite(alpha) ? alpha : 1 };
  });

  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
    scale,
    layers
  };
}

/**
 * 지도 요소 안의 레이어 캔버스들을 한 장으로 합쳐 돌려준다.
 * 그릴 것이 없으면 null.
 *
 * @param {HTMLElement} mapElement `#map`
 * @param {{maxSize?: number, target?: HTMLCanvasElement}} options
 *        target을 주면 새로 만들지 않고 다시 쓴다(갱신마다 캔버스를 새로 만들지 않기 위함)
 * @returns {HTMLCanvasElement|null}
 */
export function composeMapCanvas(mapElement, { maxSize = MAX_TEXTURE_SIZE, target } = {}) {
  const plan = planComposition(mapElement.querySelectorAll('.ol-layer canvas'), maxSize);
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
