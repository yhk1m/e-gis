// © 2026 김용현
/**
 * MapScaleBar - 지도 위 자체 축척바 (OL ScaleLine 대체)
 * - #map의 자식 DOM 요소로 추가되어 드래그 가능
 * - 지도 줌/이동 시 자동 갱신
 */

import { makeDraggable } from '../utils/DraggableElement.js';

const NICE_VALUES = [
  1, 2, 5, 10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000
];

export class MapScaleBar {
  constructor(map, options = {}) {
    this.map = map;
    this.targetWidth = options.targetWidth || 120;
    this.el = document.createElement('div');
    this.el.className = 'map-scale-bar';
    this.el.innerHTML = `
      <div class="map-scale-bar-track">
        <div class="map-scale-bar-fill"></div>
      </div>
      <div class="map-scale-bar-label">— km</div>
    `;
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.appendChild(this.el);
      makeDraggable(this.el, () => mapEl);
    }
    this.update = this.update.bind(this);
    map.getView().on('change:resolution', this.update);
    map.on('moveend', this.update);
    setTimeout(this.update, 50);
  }

  update() {
    const view = this.map.getView();
    const resolution = view.getResolution();
    if (!resolution) return;
    const projection = view.getProjection();
    const center = view.getCenter();
    const mpu = projection.getMetersPerUnit() || 1;
    let mppGround = resolution * mpu;
    if (projection.getCode() === 'EPSG:3857' && center) {
      const lat = Math.atan(Math.sinh(center[1] / 6378137)) * 180 / Math.PI;
      mppGround = resolution * Math.cos(lat * Math.PI / 180);
    }
    const targetMeters = this.targetWidth * mppGround;
    let nice = NICE_VALUES[0];
    for (const v of NICE_VALUES) {
      if (v <= targetMeters) nice = v;
      else break;
    }
    const pixelWidth = Math.round(nice / mppGround);
    const fill = this.el.querySelector('.map-scale-bar-fill');
    const label = this.el.querySelector('.map-scale-bar-label');
    if (fill) fill.style.width = pixelWidth + 'px';
    if (label) label.textContent = nice >= 1000 ? (nice / 1000) + ' km' : nice + ' m';
  }
}
