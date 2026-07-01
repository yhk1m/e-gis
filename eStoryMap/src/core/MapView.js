// © 2026 김용현
// eStoryMap/src/core/MapView.js
// OpenLayers 지도 얇은 래퍼. e-GIS src/core/MapManager.js의 init/좌표변환만 발췌.
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { createEmpty, extend, isEmpty } from 'ol/extent';

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

  /** center: [경도, 위도] (EPSG:4326, .egis view.center 포맷). */
  setView(center, zoom) {
    const view = this.map.getView();
    if (Array.isArray(center)) view.setCenter(fromLonLat(center));
    if (typeof zoom === 'number' && !Number.isNaN(zoom)) view.setZoom(zoom);
  }

  /** 주어진 OL 벡터 레이어들의 합집합 범위로 맞춤. */
  fitToLayers(olLayers) {
    const ext = createEmpty();
    for (const l of olLayers) {
      const src = l.getSource && l.getSource();
      if (src && src.getExtent) extend(ext, src.getExtent());
    }
    if (!isEmpty(ext) && Number.isFinite(ext[0])) {
      this.map.getView().fit(ext, { padding: [40, 40, 40, 40], duration: 300 });
    }
  }

  updateSize() {
    this.map.updateSize();
  }
}
