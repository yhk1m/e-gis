// © 2026 김용현
// eStoryMap/src/core/SourceRegistry.js
// 여러 소스의 OL 레이어 실체 관리: {sourceId, layerId} → olLayer.
// 상위 스펙 §3 렌더링 파이프라인: 소스 추가 시 1회 빌드, 전부 지도에 추가하되
// visible=false — 이후 페이지 전환은 setVisible 토글만(재파싱 없음).
import { buildVectorLayer } from './egisLayers.js';
import { buildRasterLayer, canBuildRasterLayer } from './DemRenderer.js';

export class SourceRegistry {
  /** @param {{addLayer(l):void}} mapView - MapView(또는 동등 인터페이스) */
  constructor(mapView) {
    this.mapView = mapView;
    this.layers = new Map(); // 'sourceId/layerId' → olLayer (삽입 순서 유지)
  }

  key(sourceId, layerId) {
    return `${sourceId}/${layerId}`;
  }

  /**
   * parseEgisDoc 산출 문서의 레이어들을 빌드해 등록한다.
   * unknown/데이터 결손은 스킵, 손상 레이어는 격리(e-GIS deserialize 정책).
   * @returns {{builtLayerIds:string[], skipped:number, olLayers:object[]}}
   * 주의: sourceId는 호출마다 고유해야 한다(보통 nextSourceId(doc)로 발급).
   * 재사용 시 이전 OL 레이어가 지도에 고아로 남는다(레지스트리에서 추적 불가).
   */
  addSource(sourceId, parsedDoc) {
    const builtLayerIds = [];
    const olLayers = [];
    let skipped = 0;

    for (const layerData of parsedDoc.layers) {
      let olLayer;
      try {
        if (layerData.type === 'vector') {
          olLayer = buildVectorLayer(layerData);
        } else if (canBuildRasterLayer(layerData)) {
          olLayer = buildRasterLayer(layerData);
        } else {
          skipped++;
          continue;
        }
      } catch (e) {
        console.warn(`레이어 "${layerData.name}" 빌드 실패:`, e);
        skipped++;
        continue;
      }
      olLayer.setVisible(false); // 가시성은 페이지가 결정 (applyPageVisibility)
      olLayer.set('egisLayerId', this.key(sourceId, layerData.id)); // 소스 네임스페이스
      this.layers.set(this.key(sourceId, layerData.id), olLayer);
      this.mapView.addLayer(olLayer);
      builtLayerIds.push(layerData.id);
      olLayers.push(olLayer);
    }

    return { builtLayerIds, skipped, olLayers };
  }

  getLayer(sourceId, layerId) {
    return this.layers.get(this.key(sourceId, layerId)) || null;
  }

  /** 등록 순서대로 [{sourceId, layerId, layer}]. sourceId에는 '/'가 없다(src_N). */
  entriesList() {
    return [...this.layers.entries()].map(([k, layer]) => {
      const i = k.indexOf('/');
      return { sourceId: k.slice(0, i), layerId: k.slice(i + 1), layer };
    });
  }
}
