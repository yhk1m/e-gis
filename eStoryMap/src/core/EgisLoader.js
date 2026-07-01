// © 2026 김용현
// eStoryMap/src/core/EgisLoader.js
// .egis 원본 JSON → 지도에 벡터 레이어 반영. (M1: 벡터만. 래스터는 M2에서 확장.)
import { parseEgisDoc } from './egisParse.js';
import { buildVectorLayer } from './egisLayers.js';

/**
 * @param {object} rawJson - JSON.parse된 .egis
 * @param {import('./MapView.js').MapView} mapView
 * @returns {{name:string, vectorCount:number, skipped:number, layers:object[]}}
 */
export function loadEgisIntoMap(rawJson, mapView) {
  const doc = parseEgisDoc(rawJson);
  const olLayers = [];
  let skipped = 0;

  for (const layerData of doc.layers) {
    if (layerData.type !== 'vector') { skipped++; continue; } // 래스터는 M2
    const olLayer = buildVectorLayer(layerData);
    mapView.addLayer(olLayer);
    olLayers.push(olLayer);
  }

  mapView.setView(doc.view.center, doc.view.zoom);
  if (olLayers.length) mapView.fitToLayers(olLayers);

  return { name: doc.name, vectorCount: olLayers.length, skipped, layers: olLayers };
}
