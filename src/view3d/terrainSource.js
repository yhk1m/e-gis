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

/** '전체'를 뜻하는 지형 원본 값 — 불러온 DEM을 모두 이어 붙인다 */
export const ALL = 'all';

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
 * 쓸 DEM들을 고른다. **위에 있는 것이 앞**에 온다 — 겹치는 곳은 위가 이긴다.
 *
 * 시군구 단위로 나뉜 DEM을 여러 장 불러와 하나의 지형으로 잇는 것이 기본 동작이다.
 *
 * @param {Map} layers layerManager.layers
 * @param {string|null} preferred 레이어 id, FLAT, ALL, 또는 null(=ALL)
 * @returns {Array<{id: string, demData: Object}>} 평면이거나 DEM이 없으면 빈 배열
 */
export function pickDemLayers(layers, preferred = ALL) {
  if (preferred === FLAT) return [];

  const all = [];
  for (const [id, info] of layers) {
    if (info && info.demData) all.push({ id, demData: info.demData });
  }
  all.reverse();   // 나중에 담긴 것이 위 레이어다

  if (preferred && preferred !== ALL) {
    const one = all.find((entry) => entry.id === preferred);
    if (one) return [one];
    // 고른 레이어가 사라졌으면 전체로 돌아간다
  }
  return all;
}
