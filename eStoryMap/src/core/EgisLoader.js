// © 2026 김용현
// eStoryMap/src/core/EgisLoader.js
// .egis 원본 JSON → 지도에 벡터·래스터 레이어 반영.
import { parseEgisDoc } from './egisParse.js';
import { buildVectorLayer } from './egisLayers.js';
import { buildRasterLayer, canBuildRasterLayer } from './DemRenderer.js';

/**
 * @param {object} rawJson - JSON.parse된 .egis
 * @param {import('./MapView.js').MapView} mapView
 * @returns {{name:string, vectorCount:number, rasterCount:number, skipped:number, layers:object[]}}
 */
export function loadEgisIntoMap(rawJson, mapView) {
  const doc = parseEgisDoc(rawJson);
  mapView.clearEgisLayers(); // 재로드 시 이전 레이어 누적 방지

  const olLayers = [];
  let vectorCount = 0;
  let rasterCount = 0;
  let skipped = 0;

  for (const layerData of doc.layers) {
    let olLayer;
    try {
      if (layerData.type === 'vector') {
        olLayer = buildVectorLayer(layerData);
        vectorCount++;
      } else if (canBuildRasterLayer(layerData)) {
        olLayer = buildRasterLayer(layerData);
        rasterCount++;
      } else {
        skipped++; // rasterKind 'unknown' 또는 복원 데이터 결손 (e-GIS와 동일 스킵 정책)
        continue;
      }
    } catch (e) {
      // 레이어 하나가 손상돼도 나머지는 계속 — e-GIS deserialize의 레이어별 try/catch 이식
      console.warn(`레이어 "${layerData.name}" 복원 실패:`, e);
      skipped++;
      continue;
    }
    mapView.addLayer(olLayer);
    olLayers.push(olLayer);
  }

  // 저장된 카메라(작성자 시점)가 최우선. 없을 때만 레이어 범위로 폴백,
  // 그마저 없으면 MapView 초기 카메라(한국 중심) 유지.
  if (doc.view) {
    mapView.setView(doc.view.center, doc.view.zoom);
  } else if (olLayers.length) {
    mapView.fitToLayers(olLayers);
  }

  return { name: doc.name, vectorCount, rasterCount, skipped, layers: olLayers };
}
