// © 2026 김용현
/**
 * layerSwatch - 레이어 목록의 색 표시를 지도와 같은 값에서 만든다.
 *
 * 예전에는 목록이 늘 사각형이었고, 채움·테두리도 지도와 다른 규칙으로 칠해졌다.
 * 그래서 포인트 레이어인데 색 테두리 사각형이 보이고, 라인 레이어가 꽉 찬 네모로 보였다.
 * 여기서는 LayerManager가 addLayer에서 layerInfo에 심어 둔 바로 그 값만 읽는다
 * (fillColor·strokeColor·fillOpacity·strokeOpacity·strokeWidth·pointRadius).
 * 값이 한 곳에서 나와야 다시 어긋나지 않는다.
 *
 * 점선표는 LayerManager가 갖고 있으므로 호출부가 풀어서 넘긴다 —
 * 표를 여기에 베껴 두면 그것부터 어긋나기 시작한다.
 *
 * OL/DOM에 기대지 않아 Node에서 단위 테스트가 된다.
 */

import { strokeWidthOf } from '../../utils/strokeStyle.js';

/** 분류색을 스스로 정하는 레이어 — 단색 하나로는 표현할 수 없어 사각형으로 둔다 */
const THEMATIC_TYPES = ['choropleth', 'heatmap', 'raster', 'chartmap', 'dem'];

function isThematic(layerInfo) {
  // 카토그램은 type이 'vector'라 타입만으로는 못 알아본다 (CartogramTool.js:205)
  return THEMATIC_TYPES.includes(layerInfo.type) || !!layerInfo._cartogramConfig;
}

function shapeOf(geometryType) {
  if (geometryType === 'Point' || geometryType === 'MultiPoint') return 'point';
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return 'line';
  return 'polygon';
}

/**
 * 레이어 하나를 어떤 모양·색으로 그릴지 정한다.
 *
 * @param {object} layerInfo - LayerManager의 레이어 메타데이터
 * @param {number[]|null} [lineDash] - layerManager.getLineDash(strokeDash) 결과
 * @returns {{shape: string, fill: string, stroke: string, fillOpacity: number,
 *            strokeOpacity: number, strokeWidth: number, dash: string|null, radius: number}}
 */
export function swatchSpec(layerInfo, lineDash) {
  const color = layerInfo.color || '#808080';
  const spec = {
    shape: isThematic(layerInfo) ? 'square' : shapeOf(layerInfo.geometryType),
    fill: layerInfo.fillColor || color,
    stroke: layerInfo.strokeColor || color,
    fillOpacity: layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 1,
    strokeOpacity: layerInfo.strokeOpacity !== undefined ? layerInfo.strokeOpacity : 1,
    strokeWidth: strokeWidthOf(layerInfo, 2),
    dash: lineDash && lineDash.length ? lineDash.join(',') : null,
    radius: layerInfo.pointRadius || 6
  };
  return spec;
}

/** 14px 스와치 안에서 쓰는 좌표계 */
const BOX = 16;

/**
 * 스와치 SVG를 만든다.
 *
 * 안쪽 요소에 pointer-events="none"을 걸어 클릭이 늘 바깥 스와치로 잡히게 한다.
 * 그러지 않으면 사용자가 원 한가운데를 눌렀을 때 색 편집기가 열리지 않는다.
 *
 * @param {object} spec - swatchSpec 결과
 * @returns {string} SVG 마크업
 */
export function swatchHTML(spec) {
  const open = `<svg viewBox="0 0 ${BOX} ${BOX}" width="100%" height="100%" pointer-events="none">`;
  return open + shapeMarkup(spec) + '</svg>';
}

function shapeMarkup(spec) {
  const hasStroke = spec.strokeWidth > 0;
  const stroke = hasStroke
    ? ` stroke="${spec.stroke}" stroke-width="${spec.strokeWidth}" stroke-opacity="${spec.strokeOpacity}"` +
      (spec.dash ? ` stroke-dasharray="${spec.dash}"` : '')
    : '';

  if (spec.shape === 'line') {
    // 면을 칠하지 않는다 — 라인 레이어는 지도에서도 선만 그린다.
    // 굵기 0이면 아무것도 안 보이므로 그때만 최소 굵기로 존재를 알린다
    const width = hasStroke ? spec.strokeWidth : 1;
    const dash = spec.dash ? ` stroke-dasharray="${spec.dash}"` : '';
    return `<line x1="1" y1="${BOX - 2}" x2="${BOX - 1}" y2="2" fill="none"` +
      ` stroke="${spec.stroke}" stroke-width="${width}" stroke-opacity="${spec.strokeOpacity}"${dash}` +
      ' stroke-linecap="round" pointer-events="none"/>';
  }

  if (spec.shape === 'point') {
    // 반지름은 지도의 pointRadius를 그대로 쓰지 않는다 — 스와치가 14px뿐이라
    // 큰 점을 지정한 레이어는 칸을 넘긴다. 테두리가 들어갈 자리만 남긴다
    const r = (BOX - Math.max(spec.strokeWidth, 1) * 2) / 2 - 1;
    return `<circle cx="${BOX / 2}" cy="${BOX / 2}" r="${r}"` +
      ` fill="${spec.fill}" fill-opacity="${spec.fillOpacity}"${stroke} pointer-events="none"/>`;
  }

  // 폴리곤·주제도: 면
  const inset = hasStroke ? spec.strokeWidth / 2 : 0;
  return `<rect x="${inset}" y="${inset}" width="${BOX - inset * 2}" height="${BOX - inset * 2}" rx="2"` +
    ` fill="${spec.fill}" fill-opacity="${spec.fillOpacity}"${stroke} pointer-events="none"/>`;
}
