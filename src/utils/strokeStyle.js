// © 2026 김용현
/**
 * strokeStyle - 선 두께를 다루는 공통 규칙
 *
 * 두께 0은 "테두리 없음"이라는 뜻이고, 사용자가 고를 수 있는 값이다.
 * 그런데 0은 falsy라 `layerInfo.strokeWidth || 2` 같은 코드에서 조용히 기본값으로
 * 되돌아가고, Stroke에 그대로 넘기면 캔버스가 lineWidth 0을 무시하고
 * 직전 값을 그대로 써서 엉뚱한 두께로 그려진다.
 * 두 함정을 이 파일에서 한 번에 막는다.
 */

import { Stroke } from 'ol/style';

/**
 * 저장된 선 두께를 읽는다. 0은 그대로 0으로 돌려준다.
 * @param {object} layerInfo - 레이어 메타데이터
 * @param {number} fallback - 값이 없을 때 쓸 기본 두께
 * @returns {number}
 */
export function strokeWidthOf(layerInfo, fallback) {
  return layerInfo && layerInfo.strokeWidth !== undefined ? layerInfo.strokeWidth : fallback;
}

/**
 * 두께가 0 이하면 Stroke를 만들지 않는다 (Style.stroke가 없으면 테두리를 안 그린다).
 * @param {object} options - ol/style/Stroke 옵션 ({ color, width, lineDash })
 * @returns {Stroke|undefined}
 */
export function makeStroke(options) {
  return options && options.width > 0 ? new Stroke(options) : undefined;
}
