// © 2026 김용현
// eStoryMap/src/core/egisParse.js
// .egis(JSON) 검증·정규화 — 순수 함수. OL·DOM 의존 없음.
// 이식 원본: e-GIS src/core/ProjectManager.js deserialize()의 형식 규약.

const SUPPORTED_LAYER_TYPES = new Set(['vector', 'raster']);

/**
 * .egis 원본 JSON을 검증하고 정규화한다.
 * @param {object} raw - JSON.parse된 .egis 객체
 * @returns {{version:string, name:string, view:({center:number[], zoom:number}|null),
 *            displayCRS:string, layers:object[]}}
 *          view는 저장된 카메라가 없거나 손상됐으면 null — 기본 카메라는 MapView가 소유.
 * @throws {Error} 객체가 아니거나 version이 없으면
 */
export function parseEgisDoc(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('유효하지 않은 .egis 파일입니다: 객체가 아님');
  }
  if (!raw.version) {
    throw new Error('유효하지 않은 .egis 파일입니다: version 누락');
  }

  const view = normalizeView(raw.view);

  const layers = Array.isArray(raw.layers) ? raw.layers.map(normalizeLayer) : [];

  return {
    version: String(raw.version),
    name: raw.name || '불러온 프로젝트',
    view,
    displayCRS: raw.displayCRS || 'EPSG:3857',
    layers,
  };
}

// ★ view.center는 EPSG:4326(경도, 위도). 유한수 [lon, lat]가 아니면 손상으로 보고 null.
function normalizeView(rawView) {
  const center = rawView && rawView.center;
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite)) {
    return null;
  }
  // rawView.zoom == null 가드 필수: Number(null)은 0이라 isFinite를 통과해버림.
  const zoom = rawView.zoom == null ? NaN : Number(rawView.zoom);
  return { center: [...center], zoom: Number.isFinite(zoom) ? zoom : 7 };
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
    // 세부 스타일(e-GIS 웹 LayerManager 스타일 필드) — 구버전 .egis에는 없음 = null.
    // null이면 egisLayers가 기존 단일색 스타일로 폴백한다(하위 호환).
    strokeColor: layer.strokeColor || null,
    fillColor: layer.fillColor || null,
    fillOpacity: typeof layer.fillOpacity === 'number' ? layer.fillOpacity : null,
    strokeOpacity: typeof layer.strokeOpacity === 'number' ? layer.strokeOpacity : null,
    strokeWidth: typeof layer.strokeWidth === 'number' ? layer.strokeWidth : null,
    strokeDash: layer.strokeDash || null,
    pointRadius: typeof layer.pointRadius === 'number' ? layer.pointRadius : null,
    features: layer.features || null,      // 벡터: GeoJSON FC (EPSG:4326)
    rasterKind: layer.rasterKind || null,  // 래스터: 'dem'|'analysis'|'unknown' (M2)
    raster: layer.raster || null,
  };
}
