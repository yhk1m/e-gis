// © 2026 김용현
// eStoryMap/src/core/egisParse.js
// .egis(JSON) 검증·정규화 — 순수 함수. OL·DOM 의존 없음.
// 이식 원본: e-GIS src/core/ProjectManager.js deserialize()의 형식 규약.

const SUPPORTED_LAYER_TYPES = new Set(['vector', 'raster']);

/**
 * .egis 원본 JSON을 검증하고 정규화한다.
 * @param {object} raw - JSON.parse된 .egis 객체
 * @returns {{version:string, name:string, view:{center:number[], zoom:number},
 *            displayCRS:string, layers:object[]}}
 * @throws {Error} 객체가 아니거나 version이 없으면
 */
export function parseEgisDoc(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('유효하지 않은 .egis 파일입니다: 객체가 아님');
  }
  if (!raw.version) {
    throw new Error('유효하지 않은 .egis 파일입니다: version 누락');
  }

  // ★ view.center는 EPSG:4326(경도, 위도). 기본값도 경위도.
  const view = raw.view && Array.isArray(raw.view.center)
    ? { center: raw.view.center, zoom: Number(raw.view.zoom) || 7 }
    : { center: [127.5, 36.5], zoom: 7 };

  const layers = Array.isArray(raw.layers) ? raw.layers.map(normalizeLayer) : [];

  return {
    version: String(raw.version),
    name: raw.name || '불러온 프로젝트',
    view,
    displayCRS: raw.displayCRS || 'EPSG:3857',
    layers,
  };
}

function normalizeLayer(layer, i) {
  const type = SUPPORTED_LAYER_TYPES.has(layer.type) ? layer.type : 'vector';
  return {
    id: layer.id || `L_${i}`,
    name: layer.name || `레이어 ${i + 1}`,
    type,
    geometryType: layer.geometryType || null,
    visible: layer.visible !== false,
    color: layer.color || '#3b82f6',
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
    features: layer.features || null,      // 벡터: GeoJSON FC (EPSG:4326)
    rasterKind: layer.rasterKind || null,  // 래스터: 'dem'|'analysis'|'unknown' (M2)
    raster: layer.raster || null,
  };
}
