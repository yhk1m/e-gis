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
import { buildRouteGeoJSON, toLocalProfile } from '../core/localRouting.js';
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

    // 레이어 가시성 변경 이벤트 리스너
    eventBus.on(Events.LAYER_VISIBILITY_CHANGED, (data) => {
      if (data.layerId === this.routeLayerId && this.markersLayer) {
        this.markersLayer.setVisible(data.visible);
      }
    });

    // 저장본을 복원할 때(새로고침·프로젝트 열기) 마커 표시를 되살린다.
    // 피처 스타일은 저장되지 않으므로 속성(routeMarker)을 보고 다시 입힌다.
    eventBus.on(Events.LAYER_ADDED, (data) => {
      if (data && data.layer) this.applyMarkerStyles(data.layer);
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
  /**
   * 출발·경유·도착 마커 피처를 만든다 (호출할 때마다 새 인스턴스).
   *
   * 종류와 라벨을 속성으로 남기는 이유: 이 피처들은 경로 레이어에 실려
   * 저장·복원되는데, 피처 스타일은 저장되지 않는다. 복원 뒤 applyMarkerStyles가
   * 속성만 보고 표시를 되살린다.
   */
  buildMarkerFeatures() {
    const features = [];

    const make = (point, kind, label) => {
      const feature = new Feature({
        geometry: new Point(point.coordinate),
        routeMarker: kind,
        markerLabel: label
      });
      feature.setStyle(this.createMarkerStyle(kind, label));
      return feature;
    };

    if (this.startPoint) features.push(make(this.startPoint, 'start', 'S'));
    this.waypoints.forEach((wp, index) => {
      features.push(make(wp, 'waypoint', String(index + 1)));
    });
    if (this.endPoint) features.push(make(this.endPoint, 'end', 'E'));

    return features;
  }

  /**
   * 복원된 경로 레이어의 마커 표시를 되살린다.
   * 피처 스타일은 프로젝트에 저장되지 않으므로 새로고침하면 마커가 사라졌다.
   * @param {Object} layerInfo - LayerManager의 레이어 정보
   */
  applyMarkerStyles(layerInfo) {
    if (!layerInfo || !layerInfo.source || typeof layerInfo.source.getFeatures !== 'function') return;

    layerInfo.source.getFeatures().forEach(feature => {
      const kind = feature.get('routeMarker');
      if (!kind || feature.getStyle()) return;   // 마커가 아니거나 이미 표시가 있으면 그대로
      feature.setStyle(this.createMarkerStyle(kind, feature.get('markerLabel') || ''));
    });
  }

  updateMarkers() {
    const map = mapManager.getMap();
    if (!map) return;

    // 기존 마커 레이어 제거
    this.removeMarkers();

    // 지점을 고르는 동안만 쓰는 임시 표시 — 경로가 만들어지면 경로 레이어로 옮겨간다
    const features = this.buildMarkerFeatures();

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
    const { profile = 'driving-car', engine = 'ors' } = options;

    if (!this.startPoint || !this.endPoint) {
      throw new Error('출발지와 도착지를 모두 선택해주세요.');
    }

    // 좌표 배열 생성 (출발지 -> 경유지들 -> 도착지)
    const coordinates = [
      this.startPoint.lonLat,
      ...this.waypoints.map(wp => wp.lonLat),
      this.endPoint.lonLat
    ];

    // ── 내장 도로망 ──────────────────────────────────────────
    if (engine === 'local') {
      const data = await buildRouteGeoJSON(coordinates, {
        profile: toLocalProfile(profile),
        speedKmh: options.speedKmh,
        excludeHighway: options.excludeHighway,
        chunk: options.chunk,
        onProgress: options.onProgress,
        onGeometryProgress: options.onGeometryProgress
      });
      // 이동 수단과 시속을 레이어 이름에 그대로 보여 준다 (예: "도보 4km/h")
      return this.displayRoute(data,
        options.localLabel || (options.speedKmh > 0 ? `${options.speedKmh}km/h` : profile));
    }

    if (!this.apiKey) {
      throw new Error('OpenRouteService API 키가 설정되지 않았습니다.');
    }

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

    // LayerManager에 레이어 등록 (스타일은 LayerManager가 관리)
    // 출발·도착 표시도 이 레이어에 함께 싣는다 — 지도에 직접 얹으면 레이어 순서를
    // 무시하고 늘 맨 위에 뜨고, 저장 대상이 아니라 새로고침하면 사라진다.
    const layerName = `최단경로 ${profileName} (${routeInfo.distanceText})`;
    this.routeLayerId = layerManager.addLayer({
      name: layerName,
      type: 'vector',
      geometryType: 'LineString',
      features: [...features.map(f => f.clone()), ...this.buildMarkerFeatures()]
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

    // 지점 선택용 임시 마커는 걷어낸다 (표시는 이제 경로 레이어가 갖고 있다)
    this.removeMarkers();

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
