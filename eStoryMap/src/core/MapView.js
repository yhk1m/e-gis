// © 2026 김용현
// eStoryMap/src/core/MapView.js
// OpenLayers 지도 얇은 래퍼. e-GIS src/core/MapManager.js의 init/좌표변환만 발췌.
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { createEmpty, extend, isEmpty } from 'ol/extent';

/** 레이어들의 범위 합집합. ImageLayer는 명시 extent, 벡터는 소스 extent 사용. */
export function unionExtent(olLayers) {
  const ext = createEmpty();
  for (const l of olLayers) {
    const layerExt = typeof l.getExtent === 'function' ? l.getExtent() : null;
    if (layerExt) {
      extend(ext, layerExt);
      continue;
    }
    const src = l.getSource && l.getSource();
    if (src && src.getExtent) extend(ext, src.getExtent());
  }
  return ext;
}

export class MapView {
  /** @param {string} target - 지도 컨테이너 DOM id */
  constructor(target) {
    this.baseLayer = new TileLayer({ source: new OSM(), properties: { type: 'base' } });
    this.map = new Map({
      target,
      layers: [this.baseLayer],
      view: new View({
        center: fromLonLat([127.5, 36.5]), // 한국 중심(경위도 → 3857)
        zoom: 7,
        minZoom: 2,
        maxZoom: 19,
      }),
    });
  }

  addLayer(olLayer) {
    this.map.addLayer(olLayer);
  }

  /** .egis에서 로드된 레이어(egisLayerId 보유) 전부 제거. 베이스맵 등은 유지. */
  clearEgisLayers() {
    const egisLayers = this.map.getLayers().getArray()
      .filter((l) => l.get('egisLayerId'));
    for (const l of egisLayers) this.map.removeLayer(l);
  }

  /** center: [경도, 위도] (EPSG:4326, .egis view.center 포맷). */
  setView(center, zoom) {
    const view = this.map.getView();
    if (Array.isArray(center)) view.setCenter(fromLonLat(center));
    if (typeof zoom === 'number' && !Number.isNaN(zoom)) view.setZoom(zoom);
  }

  /** 주어진 OL 레이어들(벡터·래스터)의 합집합 범위로 맞춤. */
  fitToLayers(olLayers) {
    const ext = unionExtent(olLayers);
    if (!isEmpty(ext) && Number.isFinite(ext[0])) {
      // maxZoom 가드: 포인트 하나뿐인 extent(면적 0)에서 maxZoom(19)까지 박히는 것 방지.
      this.map.getView().fit(ext, { padding: [40, 40, 40, 40], duration: 300, maxZoom: 16 });
    }
  }

  updateSize() {
    this.map.updateSize();
  }
}
