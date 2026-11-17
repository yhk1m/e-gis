// © 2026 김용현
/**
 * pointSymbol - 포인트 레이어의 기호 모양 (원, 아이콘, 이미지).
 *
 * layerInfo.pointSymbol 하나에 모양을 담는다.
 *   { kind: 'circle' }                         기본 원 (없을 때와 같다)
 *   { kind: 'icon', icon: 'school' }           면 색 원판 위에 흰(또는 어두운) 선 아이콘
 *   { kind: 'image', dataUrl, width, height }  사용자가 올린 그림을 그대로
 *
 * 지도(LayerManager), 레이어 목록 스와치(layerSwatch), 범례 내보내기(ExportTool)가
 * 모두 여기서 같은 SVG를 받아 쓴다. 값이 한 곳에서 나와야 셋이 어긋나지 않는다.
 *
 * 크기는 pointRadius 하나로 정한다. 원은 지름 = 반지름 x 2,
 * 아이콘과 이미지는 그 안에 그림이 들어가야 해서 12px 더 크게 그린다(기본 24px).
 */

/** 아이콘 그림 (24 x 24 칸, 선으로만 그린다) */
export const POINT_ICONS = [
  { id: 'home', label: '집', d: 'M3 11l9-7 9 7 M6 9.5V20h12V9.5 M10 20v-6h4v6' },
  { id: 'school', label: '학교', d: 'M2 9l10-5 10 5-10 5z M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5' },
  { id: 'hospital', label: '병원', d: 'M12 5v14 M5 12h14' },
  { id: 'city', label: '건물', d: 'M4 21V8h6v13 M10 21V3h10v18 M2 21h20 M13 7h4 M13 11h4 M13 15h4' },
  { id: 'factory', label: '공장', d: 'M3 20V10l5 3v-3l5 3v-3l5 3V4h3v16z' },
  { id: 'mountain', label: '산', d: 'M2 20l7-12 4 6 2-3 7 9z' },
  { id: 'tree', label: '나무', d: 'M12 22v-6 M12 2l6 9h-3l4 5H5l4-5H6z' },
  { id: 'train', label: '기차역', d: 'M7 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M5 11h14 M8 21l2-4 M16 21l-2-4' },
  { id: 'plane', label: '공항', d: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z' },
  { id: 'anchor', label: '항구', d: 'M12 8v13 M5 12H2a10 10 0 0 0 20 0h-3 M12 2a3 3 0 1 1 0 6a3 3 0 1 1 0-6' },
  { id: 'flag', label: '깃발', d: 'M5 22V3 M5 4h12l-3 4 3 4H5' },
  { id: 'star', label: '별', d: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z' }
];

const ICON_BY_ID = new Map(POINT_ICONS.map((i) => [i.id, i]));

/** 올린 그림은 긴 변을 이 크기로 줄여 저장한다 (프로젝트 파일 크기) */
export const POINT_IMAGE_MAX_SIDE = 128;

/** 저장본이나 입력이 어떻든 세 모양 중 하나로 정돈한다. 모르는 값은 원으로 돌아간다. */
export function normalizePointSymbol(sym) {
  if (!sym || typeof sym !== 'object') return { kind: 'circle' };
  if (sym.kind === 'icon' && ICON_BY_ID.has(sym.icon)) return { kind: 'icon', icon: sym.icon };
  if (sym.kind === 'image' && typeof sym.dataUrl === 'string' && sym.dataUrl.startsWith('data:image/')) {
    const width = Number(sym.width) > 0 ? Number(sym.width) : 1;
    const height = Number(sym.height) > 0 ? Number(sym.height) : 1;
    return { kind: 'image', dataUrl: sym.dataUrl, width, height };
  }
  return { kind: 'circle' };
}

/** 원이 아닌 모양인가 */
export function isCustomPointSymbol(sym) {
  return normalizePointSymbol(sym).kind !== 'circle';
}

/** 아이콘과 이미지를 그릴 한 변 픽셀 크기 */
export function pointSymbolSize(pointRadius) {
  const r = Number(pointRadius) > 0 ? Number(pointRadius) : 6;
  return Math.round(r * 2 + 12);
}

/** 이미지의 가로, 세로 픽셀 (긴 변이 size) */
export function imageBox(sym, size) {
  const w = sym.width || 1;
  const h = sym.height || 1;
  if (w >= h) return { width: size, height: Math.max(1, Math.round(size * h / w)) };
  return { width: Math.max(1, Math.round(size * w / h)), height: size };
}

/** 면 색이 밝으면 아이콘 선을 어둡게 해서 읽히게 한다 */
export function glyphColorFor(fill) {
  const rgb = parseColor(fill);
  if (!rgb) return '#ffffff';
  const lum = (0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]));
  return lum > 0.45 ? '#1a1e25' : '#ffffff';
}

function lin(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function parseColor(c) {
  if (typeof c !== 'string') return null;
  const s = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
  m = /^#([0-9a-f]{6})/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function escAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * 원판 아이콘의 안쪽 SVG 요소 (24 x 24 칸 기준).
 * 스와치와 마커가 같은 그림을 쓰도록 바깥 svg 태그 없이 돌려준다.
 *
 * @param {string} iconId
 * @param {{fill: string, fillOpacity?: number, stroke: string, strokeOpacity?: number, strokeWidth?: number}} colors
 */
export function iconMarkerInner(iconId, colors) {
  const icon = ICON_BY_ID.get(iconId) || POINT_ICONS[0];
  const sw = Math.max(0, Math.min(Number(colors.strokeWidth) || 0, 4));
  const r = 12 - sw / 2;
  const fo = colors.fillOpacity !== undefined ? colors.fillOpacity : 1;
  const so = colors.strokeOpacity !== undefined ? colors.strokeOpacity : 1;
  const ring = sw > 0 ? ` stroke="${escAttr(colors.stroke)}" stroke-width="${sw}" stroke-opacity="${so}"` : '';
  const glyph = glyphColorFor(colors.fill);
  // 아이콘은 원판 안쪽 60% 칸에 들어간다. 선 굵기는 축소를 되돌려 약 1.6px로 보이게 한다
  const k = 0.6;
  return `<circle cx="12" cy="12" r="${r}" fill="${escAttr(colors.fill)}" fill-opacity="${fo}"${ring}/>` +
    `<path d="${icon.d}" transform="translate(12 12) scale(${k}) translate(-12 -12)" fill="none"` +
    ` stroke="${glyph}" stroke-width="${(1.7 / k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** 원판 아이콘 한 개를 완성된 SVG 문자열로 */
export function iconMarkerSvg(iconId, colors, size = 24) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
    iconMarkerInner(iconId, colors) + '</svg>';
}

/** 원판 아이콘 SVG를 data URL로 (OL Icon, 캔버스 drawImage용) */
export function iconMarkerDataUrl(iconId, colors, size = 24) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconMarkerSvg(iconId, colors, size));
}

/** 고르기 창의 아이콘 단추에 넣는 선 그림 (현재 글자색을 따른다) */
export function iconButtonSvg(iconId) {
  const icon = ICON_BY_ID.get(iconId);
  if (!icon) return '';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"` +
    ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon.d}"/></svg>`;
}
