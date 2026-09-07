// © 2026 김용현
/**
 * 지형 원본 고르기 — 어떤 DEM에서 고도를 가져올 것인가.
 *
 * QGIS의 3D 맵 뷰가 그렇듯, **고도 원본과 표면에 그릴 레이어는 별개**다.
 * 표면은 2D 화면에 보이는 그대로를 굽고, 고도만 여기서 정한 DEM에서 가져온다.
 * 그래서 DEM 레이어를 레이어 패널에서 꺼도 지형은 그대로 서 있고,
 * 표면만 그 아래(웹지도 등)로 바뀐다.
 */

/** '평면'을 뜻하는 지형 원본 값 — 고도를 쓰지 않는다 */
export const FLAT = 'flat';

/**
 * 지형으로 쓸 수 있는 DEM 레이어 목록.
 * 가시성은 보지 않는다 — 꺼 둔 DEM도 고도 원본으로 쓸 수 있어야 한다.
 *
 * @param {Map} layers layerManager.layers
 * @returns {Array<{id: string, name: string}>} 위에 있는 것이 뒤로 온다
 */
export function listDemLayers(layers) {
  const list = [];
  for (const [id, info] of layers) {
    if (info && info.demData) list.push({ id, name: info.name || 'DEM' });
  }
  return list;
}

/**
 * 쓸 DEM을 고른다.
 *
 * @param {Map} layers layerManager.layers
 * @param {string|null} preferredId 사용자가 고른 레이어 id, FLAT, 또는 null(자동)
 * @returns {{id: string, demData: Object}|null} 평면이거나 DEM이 없으면 null
 */
export function pickDemLayer(layers, preferredId = null) {
  if (preferredId === FLAT) return null;

  if (preferredId) {
    const info = layers.get(preferredId);
    if (info && info.demData) return { id: preferredId, demData: info.demData };
    // 고른 레이어가 사라졌으면 자동 선택으로 돌아간다
  }

  let last = null;
  for (const [id, info] of layers) {
    if (info && info.demData) last = { id, demData: info.demData };
  }
  return last;
}
