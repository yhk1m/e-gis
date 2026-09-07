// © 2026 김용현
/**
 * 화면 크기와 입력 방식에 맞는 3D 품질 등급.
 *
 * 태블릿·휴대폰 GPU에서 512² 격자와 2048 텍스처는 버겁다.
 * 화면이 작으면 어차피 그만한 해상도가 보이지도 않으므로 함께 낮춘다.
 *
 * 구분 기준은 이 저장소의 CSS 규약과 같다
 * (태블릿: pointer coarse & ≤1366px 또는 ≤1024px / 휴대폰: ≤768px).
 */

export const DESKTOP = { name: 'desktop', maxGrid: 512, maxTexture: 2048, pixelRatioCap: 2 };
export const TABLET = { name: 'tablet', maxGrid: 384, maxTexture: 1536, pixelRatioCap: 1.5 };
export const PHONE = { name: 'phone', maxGrid: 256, maxTexture: 1024, pixelRatioCap: 1.5 };

/**
 * @param {{width:number, coarsePointer?:boolean, devicePixelRatio?:number}} env
 * @returns {{name:string, maxGrid:number, maxTexture:number, pixelRatio:number}}
 */
export function qualityFor({ width, coarsePointer = false, devicePixelRatio = 1 }) {
  let tier = DESKTOP;
  if (width <= 768) tier = PHONE;
  else if (width <= 1024 || (coarsePointer && width <= 1366)) tier = TABLET;

  return {
    name: tier.name,
    maxGrid: tier.maxGrid,
    maxTexture: tier.maxTexture,
    pixelRatio: Math.min(devicePixelRatio || 1, tier.pixelRatioCap)
  };
}

/** 지금 브라우저 환경을 읽어 품질 등급을 정한다 */
export function currentQuality() {
  const coarsePointer = typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  return qualityFor({
    width: window.innerWidth,
    coarsePointer,
    devicePixelRatio: window.devicePixelRatio || 1
  });
}
