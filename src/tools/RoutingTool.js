/**
 * RoutingTool - 최단경로 분석 도구
 * OpenRouteService API를 사용하여 경로 탐색
 */

import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { GeoJSON } from 'ol/format';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { transform } from 'ol/proj';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

// 이동 수단
const TRAVEL_PROFILES = {
  'driving-car': '자동차',
  'cycling-regular': '자전거',
  'foot-walking': '도보'
};

// 마커 색상
const MARKER_COLORS = {
  start: '#22c55e',  // 녹색
  end: '#ef4444',    // 빨강
  waypoint: '#3b82f6' // 파랑
};

class RoutingTool {
  constructor() {
    this.apiKey = localStorage.getItem('ors_api_key') || '';
    this.baseUrl = 'https://api.openrouteservice.org/v2/directions';
    this.routeLayer = null;
    this.routeLayerId = null; // LayerManager에 등록된 레이어 ID
    this.markersLayer = null;
    this.isSelecting = false;
    this.clickHandler = null;
    this.selectingType = null; // 'start', 'end', 'waypoint'

    this.startPoint = null;
    this.endPoint = null;
    this.waypoints = [];
    this.lastRouteInfo = null;

    // 레이어 삭제 이벤트 리스너
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      if (data.layerId === this.routeLayerId) {
        this.routeLayerId = null;
        this.routeLayer = null;
        this.lastRouteInfo = null;
        // 마커도 함께 제거
        this.removeMarkers();
        this.startPoint = null;
        this.endPoint = null;
        this.waypoints = [];
      }
    });
  }

  /**
   * API 키 설정
   */
  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('ors_api_key', key);
  }

  /**
   * API 키 가져오기
   */
  getApiKey() {
    return this.apiKey;
  }

  /**
   * 이동 수단 목록
   */
  getProfiles() {
    return TRAVEL_PROFILES;
  }

  /**
   * 지도 클릭으로 포인트 선택 시작
   */
  startSelectingPoint(type, callback) {
    const map = mapManager.getMap();
    if (!map) return;

    this.isSelecting = true;
    this.selectingType = type;
    map.getTargetElement().style.cursor = 'crosshair';

    // 기존 핸들러 제거
    if (this.clickHandler) {
      map.un('click', this.clickHandler);
    }

    this.clickHandler = (evt) => {
      const coordinate = evt.coordinate;
      // EPSG:3857 -> EPSG:4326 변환
      const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');

      // 포인트 저장
      if (type === 'start') {
        this.startPoint = { lonLat, coordinate };
      } else if (type === 'end') {
        this.endPoint = { lonLat, coordinate };
      } else if (type === 'waypoint') {
        this.waypoints.push({ lonLat, coordinate });
      }

      this.stopSelectingPoint();
      this.updateMarkers();

      if (callback) {
        callback(lonLat, coordinate, type);
      }
    };

    map.on('click', this.clickHandler);
  }

  /**
   * 포인트 선택 중지
   */
  stopSelectingPoint() {
    const map = mapManager.getMap();
    if (!map) return;

    this.isSelecting = false;
    this.selectingType = null;
    map.getTargetElement().style.cursor = '';

    if (this.clickHandler) {
      map.un('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  /**
   * 마커 업데이트
   */
  updateMarkers() {
    const map = mapManager.getMap();
    if (!map) return;

    // 기존 마커 레이어 제거
    this.removeMarkers();

    const features = [];

    // 출발지 마커
    if (this.startPoint) {
      const startFeature = new Feature({
        geometry: new Point(this.startPoint.coordinate),
        type: 'start'
      });
      startFeature.setStyle(this.createMarkerStyle('start', 'S'));
      features.push(startFeature);
    }

    // 경유지 마커
    this.waypoints.forEach((wp, index) => {
      const wpFeature = new Feature({
        geometry: new Point(wp.coordinate),
        type: 'waypoint',
        index: index
      });
      wpFeature.setStyle(this.createMarkerStyle('waypoint', String(index + 1)));
      features.push(wpFeature);
    });

    // 도착지 마커
    if (this.endPoint) {
      const endFeature = new Feature({
        geometry: new Point(this.endPoint.coordinate),
        type: 'end'
      });
      endFeature.setStyle(this.createMarkerStyle('end', 'E'));
      features.push(endFeature);
    }

    if (features.length > 0) {
      this.markersLayer = new VectorLayer({
        source: new VectorSource({ features }),
        zIndex: 1001
      });
      map.addLayer(this.markersLayer);
    }
  }

  /**
   * 마커 스타일 생성
   */
  createMarkerStyle(type, label) {
    const color = MARKER_COLORS[type];
    return new Style({
      image: new CircleStyle({
        radius: 12,
        fill: new Fill({ color: color }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      }),
      text: new Text({
        text: label,
        fill: new Fill({ color: '#fff' }),
        font: 'bold 11px sans-serif',
        offsetY: 1
      })
    });
  }

  /**
   * 마커 제거
   */
  removeMarkers() {
    if (this.markersLayer) {
      const map = mapManager.getMap();
      if (map) {
        map.removeLayer(this.markersLayer);
      }
      this.markersLayer = null;
    }
  }

  /**
   * 경유지 제거
   */
  removeWaypoint(index) {
    this.waypoints.splice(index, 1);
    this.updateMarkers();
  }

  /**
   * 모든 경유지 제거
   */
  clearWaypoints() {
    this.waypoints = [];
    this.updateMarkers();
  }

  /**
   * 경로 분석 실행
   */
  async analyze(options = {}) {
    const { profile = 'driving-car' } = options;

    if (!this.apiKey) {
      throw new Error('OpenRouteService API 키가 설정되지 않았습니다.');
    }

    if (!this.startPoint || !this.endPoint) {
      throw new Error('출발지와 도착지를 모두 선택해주세요.');
    }

    // 좌표 배열 생성 (출발지 -> 경유지들 -> 도착지)
    const coordinates = [
      this.startPoint.lonLat,
      ...this.waypoints.map(wp => wp.lonLat),
      this.endPoint.lonLat
    ];

    const requestBody = {
      coordinates: coordinates
    };

    try {
      const response = await fetch(`${this.baseUrl}/${profile}/geojson`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 오류: ${response.status}`);
      }

      const data = await response.json();
      return this.displayRoute(data, profile);

    } catch (error) {
      console.error('Routing API error:', error);
      throw error;
    }
  }

  /**
   * 경로 결과 표시
   */
  displayRoute(geojsonData, profile) {
    const map = mapManager.getMap();
    if (!map) return null;

    // 기존 경로 레이어 제거
    this.removeRoute();

    const format = new GeoJSON();
    const features = format.readFeatures(geojsonData, {
      featureProjection: 'EPSG:3857'
    });

    // 경로 정보 추출 먼저 (레이어 이름에 사용)
    const routeInfo = this.extractRouteInfo(geojsonData, profile);
    this.lastRouteInfo = routeInfo;

    const profileName = TRAVEL_PROFILES[profile] || profile;

    // 경로 스타일 적용
    features.forEach(feature => {
      feature.setStyle(new Style({
        stroke: new Stroke({
          color: '#3b82f6',
          width: 5
        })
      }));
    });

    // LayerManager에 레이어 등록
    const layerName = `최단경로 ${profileName} (${routeInfo.distanceText})`;
    const routeStyle = new Style({
      stroke: new Stroke({
        color: '#3b82f6',
        width: 5
      })
    });
    this.routeLayerId = layerManager.addLayer({
      name: layerName,
      type: 'vector',
      geometryType: 'LineString',
      features: features.map(f => f.clone()),
      style: routeStyle
    });

    // LayerManager가 생성한 레이어 참조 저장
    const layerInfo = layerManager.getLayer(this.routeLayerId);
    if (layerInfo) {
      this.routeLayer = layerInfo.layer;
    }

    // 경로 범위로 지도 이동
    const source = new VectorSource({ features });
    const extent = source.getExtent();
    map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16 });

    // 마커 다시 추가 (경로 위에 표시)
    this.updateMarkers();

    return routeInfo;
  }

  /**
   * 경로 정보 추출
   */
  extractRouteInfo(geojsonData, profile) {
    const feature = geojsonData.features[0];
    const properties = feature.properties;
    const summary = properties.summary;

    const distanceKm = (summary.distance / 1000).toFixed(2);
    const durationMin = Math.round(summary.duration / 60);
    const durationHour = Math.floor(durationMin / 60);
    const durationRemainMin = durationMin % 60;

    let durationText;
    if (durationHour > 0) {
      durationText = `${durationHour}시간 ${durationRemainMin}분`;
    } else {
      durationText = `${durationMin}분`;
    }

    // 경로 안내 (segments)
    const segments = properties.segments || [];
    const steps = [];

    segments.forEach(segment => {
      if (segment.steps) {
        segment.steps.forEach(step => {
          steps.push({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            name: step.name
          });
        });
      }
    });

    return {
      distance: summary.distance,
      distanceText: `${distanceKm} km`,
      duration: summary.duration,
      durationText: durationText,
      profile: TRAVEL_PROFILES[profile],
      steps: steps
    };
  }

  /**
   * 경로 레이어 제거
   */
  removeRoute() {
    if (this.routeLayerId) {
      layerManager.removeLayer(this.routeLayerId);
      this.routeLayerId = null;
    }
    this.routeLayer = null;
    this.lastRouteInfo = null;
  }

  /**
   * 레이어로 저장 (이미 자동으로 레이어 추가됨)
   */
  saveAsLayer(name = '최단경로 분석 결과') {
    if (!this.routeLayerId) {
      throw new Error('저장할 경로 결과가 없습니다.');
    }

    // 이미 LayerManager에 등록되어 있으므로 ID 반환
    return this.routeLayerId;
  }

  /**
   * 출발/도착 교환
   */
  swapStartEnd() {
    const temp = this.startPoint;
    this.startPoint = this.endPoint;
    this.endPoint = temp;
    this.updateMarkers();
  }

  /**
   * 모든 것 정리
   */
  clear() {
    this.stopSelectingPoint();
    this.removeMarkers();
    this.removeRoute();
    this.startPoint = null;
    this.endPoint = null;
    this.waypoints = [];
    this.lastRouteInfo = null;
  }

  /**
   * 현재 상태 가져오기
   */
  getState() {
    return {
      startPoint: this.startPoint,
      endPoint: this.endPoint,
      waypoints: this.waypoints,
      hasRoute: !!this.routeLayerId,
      routeInfo: this.lastRouteInfo
    };
  }
}

export const routingTool = new RoutingTool();
