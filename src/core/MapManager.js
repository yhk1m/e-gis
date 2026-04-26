/**
 * MapManager - OpenLayers 지도 인스턴스 관리
 */

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import { fromLonLat, toLonLat } from 'ol/proj';
import Control from 'ol/control/Control';
import { defaults as defaultControls, ScaleLine, Attribution } from 'ol/control';
import { eventBus, Events } from '../utils/EventBus.js';

/**
 * 나침반 컨트롤 - 지도 회전 표시 및 정북 복귀
 */
class CompassControl extends Control {
  constructor() {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = '정북 방향으로';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <polygon points="12,4 9,13 12,11 15,13" fill="#e60012" stroke="#e60012"/>
        <polygon points="12,20 9,11 12,13 15,11" fill="currentColor"/>
      </svg>
    `;
    const element = document.createElement('div');
    element.className = 'ol-control egis-compass';
    element.appendChild(button);

    super({ element });

    this.button = button;
    this.iconEl = button.querySelector('svg');

    button.addEventListener('click', () => this.handleClick());
  }

  setMap(map) {
    super.setMap(map);
    if (map) {
      this.rotationListener = map.getView().on('change:rotation', () => this.updateRotation());
      this.updateRotation();
    }
  }

  updateRotation() {
    const rotation = this.getMap()?.getView().getRotation() || 0;
    if (this.iconEl) {
      this.iconEl.style.transform = `rotate(${-rotation}rad)`;
    }
  }

  handleClick() {
    const view = this.getMap().getView();
    view.animate({ rotation: 0, duration: 300 });
  }
}

/**
 * GPS 위치 이동 컨트롤
 */
class GeolocateControl extends Control {
  constructor() {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = '내 위치로 이동';
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="2" x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="5" y2="12"/>
        <line x1="19" y1="12" x2="22" y2="12"/>
      </svg>
    `;
    const element = document.createElement('div');
    element.className = 'ol-control egis-geolocate';
    element.appendChild(button);

    super({ element });

    this.button = button;
    this.locationLayer = null;
    this.locationFeature = null;

    button.addEventListener('click', () => this.handleClick());
  }

  ensureLayer() {
    if (this.locationLayer) return;
    this.locationFeature = new Feature();
    const source = new VectorSource({ features: [this.locationFeature] });
    this.locationLayer = new VectorLayer({
      source,
      style: new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: 'rgba(0, 102, 204, 0.9)' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 })
        })
      }),
      properties: { name: 'my-location', type: 'system' },
      zIndex: 9999
    });
    this.getMap().addLayer(this.locationLayer);
  }

  handleClick() {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    this.button.classList.add('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.button.classList.remove('loading');
        const { longitude, latitude } = pos.coords;
        this.ensureLayer();
        const coord = fromLonLat([longitude, latitude]);
        this.locationFeature.setGeometry(new Point(coord));
        this.getMap().getView().animate({
          center: coord,
          zoom: Math.max(this.getMap().getView().getZoom(), 14),
          duration: 500
        });
      },
      (err) => {
        this.button.classList.remove('loading');
        const messages = {
          1: '위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.',
          2: '위치를 확인할 수 없습니다.',
          3: '위치 요청이 시간 초과되었습니다.'
        };
        alert(messages[err.code] || '위치를 가져올 수 없습니다.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }
}

// 기본 배경지도 옵션
const BASEMAPS = {
  OSM: {
    name: 'OpenStreetMap',
    source: () => new OSM()
  },
  CARTO_LIGHT: {
    name: 'Carto Light',
    source: () => new XYZ({
      url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      attributions: '&copy; <a href="https://carto.com/">CARTO</a>'
    })
  },
  CARTO_DARK: {
    name: 'Carto Dark',
    source: () => new XYZ({
      url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attributions: '&copy; <a href="https://carto.com/">CARTO</a>'
    })
  },
  SATELLITE: {
    name: '위성 영상',
    source: () => new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
      attributions: '&copy; Esri'
    })
  },
  NONE: {
    name: '없음',
    source: () => new XYZ({ url: '' })
  }
};

export class MapManager {
  constructor() {
    this.map = null;
    this.baseLayer = null;
    this.currentBasemap = 'OSM';
  }

  /**
   * 지도 초기화
   * @param {string} targetId - 지도를 표시할 DOM 요소 ID
   * @param {Object} options - 초기화 옵션
   */
  init(targetId, options = {}) {
    const {
      center = [127.5, 36.5], // 한국 중심 좌표 (경도, 위도)
      zoom = 7,
      basemap = 'OSM'
    } = options;

    // 기본 배경 레이어 생성
    this.baseLayer = new TileLayer({
      source: BASEMAPS[basemap].source(),
      properties: {
        name: 'basemap',
        type: 'base'
      }
    });

    // 지도 생성
    this.map = new Map({
      target: targetId,
      layers: [this.baseLayer],
      view: new View({
        center: fromLonLat(center),
        zoom: zoom,
        minZoom: 2,
        maxZoom: 19
      }),
      controls: defaultControls({
        zoom: true,
        rotate: false,
        attribution: false
      }).extend([
        new ScaleLine({
          units: 'metric'
        }),
        new Attribution({
          collapsible: true,
          collapsed: true
        }),
        new CompassControl(),
        new GeolocateControl()
      ])
    });

    this.currentBasemap = basemap;

    // 이벤트 바인딩
    this.bindEvents();

    return this;
  }

  /**
   * 지도 이벤트 바인딩
   */
  bindEvents() {
    // 지도 이동 완료 이벤트
    this.map.on('moveend', () => {
      const view = this.map.getView();
      const center = toLonLat(view.getCenter());
      const zoom = view.getZoom();

      eventBus.emit(Events.MAP_MOVEEND, {
        center,
        zoom,
        resolution: view.getResolution()
      });
    });

    // 마우스 이동 이벤트 (좌표 표시용)
    this.map.on('pointermove', (evt) => {
      if (evt.dragging) return;

      const coords = toLonLat(evt.coordinate);
      eventBus.emit(Events.MAP_POINTER_MOVE, {
        pixel: evt.pixel,
        coordinate: evt.coordinate,
        lonLat: coords
      });
    });

    // 클릭 이벤트
    this.map.on('click', (evt) => {
      const coords = toLonLat(evt.coordinate);
      eventBus.emit(Events.MAP_CLICK, {
        pixel: evt.pixel,
        coordinate: evt.coordinate,
        lonLat: coords
      });
    });
  }

  /**
   * 지도 인스턴스 반환
   */
  getMap() {
    return this.map;
  }

  /**
   * 뷰 반환
   */
  getView() {
    return this.map?.getView();
  }

  /**
   * 현재 중심 좌표 반환 (경도, 위도)
   */
  getCenter() {
    const center = this.map.getView().getCenter();
    return toLonLat(center);
  }

  /**
   * 현재 줌 레벨 반환
   */
  getZoom() {
    return this.map.getView().getZoom();
  }

  /**
   * 중심 좌표 설정
   * @param {number[]} lonLat - [경도, 위도]
   * @param {boolean} animate - 애니메이션 여부
   */
  setCenter(lonLat, animate = true) {
    const view = this.map.getView();
    if (animate) {
      view.animate({
        center: fromLonLat(lonLat),
        duration: 300
      });
    } else {
      view.setCenter(fromLonLat(lonLat));
    }
  }

  /**
   * 줌 레벨 설정
   * @param {number} zoom - 줌 레벨
   * @param {boolean} animate - 애니메이션 여부
   */
  setZoom(zoom, animate = true) {
    const view = this.map.getView();
    if (animate) {
      view.animate({
        zoom: zoom,
        duration: 300
      });
    } else {
      view.setZoom(zoom);
    }
  }

  /**
   * 특정 범위로 이동
   * @param {number[]} extent - [minX, minY, maxX, maxY]
   * @param {Object} options - 옵션
   */
  fitExtent(extent, options = {}) {
    const { padding = [50, 50, 50, 50], duration = 500 } = options;
    this.map.getView().fit(extent, {
      padding,
      duration
    });
  }

  /**
   * 배경지도 변경
   * @param {string} basemapKey - 배경지도 키
   */
  setBasemap(basemapKey) {
    if (!BASEMAPS[basemapKey]) {
      console.warn(`Unknown basemap: ${basemapKey}`);
      return;
    }

    if (basemapKey === 'NONE') {
      this.baseLayer.setVisible(false);
    } else {
      this.baseLayer.setVisible(true);
      this.baseLayer.setSource(BASEMAPS[basemapKey].source());
    }
    this.currentBasemap = basemapKey;
  }

  /**
   * 현재 배경지도 키 반환
   */
  getBasemap() {
    return this.currentBasemap;
  }

  /**
   * 사용 가능한 배경지도 목록 반환
   */
  getAvailableBasemaps() {
    return Object.entries(BASEMAPS).map(([key, value]) => ({
      key,
      name: value.name
    }));
  }

  /**
   * 지도 크기 갱신 (컨테이너 크기 변경 시)
   */
  updateSize() {
    this.map?.updateSize();
  }

  /**
   * 현재 축척 계산
   * @returns {number} 축척 (예: 100000 = 1:100,000)
   */
  getScale() {
    const view = this.map.getView();
    const resolution = view.getResolution();
    const mpu = view.getProjection().getMetersPerUnit();
    const dpi = 96; // 기본 DPI
    const inchesPerMeter = 39.3701;

    return resolution * mpu * inchesPerMeter * dpi;
  }

  /**
   * 축척 값을 줌 레벨로 변환
   * @param {number} scale - 목표 축척 (예: 100000 = 1:100,000)
   * @returns {number|null} 줌 레벨 또는 유효하지 않은 경우 null
   */
  scaleToZoom(scale) {
    if (!this.map || scale <= 0) return null;

    const view = this.map.getView();
    const mpu = view.getProjection().getMetersPerUnit();
    const dpi = 96;
    const inchesPerMeter = 39.3701;

    // scale = resolution * mpu * inchesPerMeter * dpi
    // resolution = scale / (mpu * inchesPerMeter * dpi)
    const targetResolution = scale / (mpu * inchesPerMeter * dpi);

    // Get zoom level for this resolution
    const zoom = view.getZoomForResolution(targetResolution);

    // Clamp to min/max zoom
    const minZoom = view.getMinZoom();
    const maxZoom = view.getMaxZoom();

    return Math.max(minZoom, Math.min(maxZoom, zoom));
  }
}

// 싱글톤 인스턴스
export const mapManager = new MapManager();
