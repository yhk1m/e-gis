/**
 * IsochroneTool - 등시선(Isochrone) 분석 도구
 * OpenRouteService API를 사용하여 도달 가능 영역 시각화
 */

import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { GeoJSON } from 'ol/format';
import { Style, Fill, Stroke } from 'ol/style';
import { Circle as CircleStyle } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { transform } from 'ol/proj';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

// 등시선 색상 (시간대별)
const ISOCHRONE_COLORS = [
  'rgba(0, 128, 0, 0.3)',    // 가장 가까운 영역 (녹색)
  'rgba(144, 238, 144, 0.3)', // 연녹색
  'rgba(255, 255, 0, 0.3)',   // 노랑
  'rgba(255, 165, 0, 0.3)',   // 주황
  'rgba(255, 69, 0, 0.3)',    // 빨강-주황
  'rgba(255, 0, 0, 0.3)'      // 가장 먼 영역 (빨강)
];

const STROKE_COLORS = [
  'rgba(0, 128, 0, 0.8)',
  'rgba(144, 238, 144, 0.8)',
  'rgba(255, 255, 0, 0.8)',
  'rgba(255, 165, 0, 0.8)',
  'rgba(255, 69, 0, 0.8)',
  'rgba(255, 0, 0, 0.8)'
];

// 이동 수단
const TRAVEL_PROFILES = {
  'driving-car': '자동차',
  'cycling-regular': '자전거',
  'foot-walking': '도보'
};

class IsochroneTool {
  constructor() {
    this.apiKey = localStorage.getItem('ors_api_key') || '';
    this.baseUrl = 'https://api.openrouteservice.org/v2/isochrones';
    this.isochroneLayers = []; // 개별 등시선 레이어들
    this.isochroneLayerIds = []; // LayerManager에 등록된 레이어 ID들
    this.markerLayer = null;
    this.legend = null;
    this.isSelecting = false;
    this.clickHandler = null;

    // 레이어 삭제 이벤트 리스너
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      this.onLayerRemoved(data.layerId);
    });
  }

  /**
   * 레이어 삭제 시 범례 업데이트
   */
  onLayerRemoved(layerId) {
    const index = this.isochroneLayerIds.indexOf(layerId);
    if (index !== -1) {
      this.isochroneLayerIds.splice(index, 1);
      this.isochroneLayers.splice(index, 1);

      // 모든 등시선 레이어가 삭제되면 범례도 제거
      if (this.isochroneLayerIds.length === 0) {
        this.removeLegend();
      }
    }
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
   * 지도 클릭으로 시작점 선택 시작
   */
  startSelectingPoint(callback) {
    const map = mapManager.getMap();
    if (!map) return;

    this.isSelecting = true;
    map.getTargetElement().style.cursor = 'crosshair';

    // 기존 핸들러 제거
    if (this.clickHandler) {
      map.un('click', this.clickHandler);
    }

    this.clickHandler = (evt) => {
      const coordinate = evt.coordinate;
      // EPSG:3857 -> EPSG:4326 변환
      const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');

      this.stopSelectingPoint();

      if (callback) {
        callback(lonLat, coordinate);
      }
    };

    map.on('click', this.clickHandler);
  }

  /**
   * 시작점 선택 중지
   */
  stopSelectingPoint() {
    const map = mapManager.getMap();
    if (!map) return;

    this.isSelecting = false;
    map.getTargetElement().style.cursor = '';

    if (this.clickHandler) {
      map.un('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  /**
   * 마커 표시
   */
  showMarker(coordinate) {
    const map = mapManager.getMap();
    if (!map) return;

    // 기존 마커 제거
    this.removeMarker();

    const markerFeature = new Feature({
      geometry: new Point(coordinate)
    });

    markerFeature.setStyle(new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: '#e74c3c' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    }));

    this.markerLayer = new VectorLayer({
      source: new VectorSource({
        features: [markerFeature]
      }),
      zIndex: 1000
    });

    map.addLayer(this.markerLayer);
  }

  /**
   * 마커 제거
   */
  removeMarker() {
    if (this.markerLayer) {
      const map = mapManager.getMap();
      if (map) {
        map.removeLayer(this.markerLayer);
      }
      this.markerLayer = null;
    }
  }

  /**
   * 등시선 분석 실행
   * @param {number[]} lonLat - [경도, 위도]
   * @param {Object} options - 분석 옵션
   */
  async analyze(lonLat, options = {}) {
    const {
      profile = 'driving-car',
      intervals = [5, 10, 15], // 분 단위
      rangeType = 'time' // 'time' or 'distance'
    } = options;

    if (!this.apiKey) {
      throw new Error('OpenRouteService API 키가 설정되지 않았습니다.');
    }

    // 시간을 초로 변환 (API는 초 단위)
    const rangeValues = rangeType === 'time'
      ? intervals.map(m => m * 60)
      : intervals.map(m => m * 1000); // 거리는 미터 단위

    const requestBody = {
      locations: [[lonLat[0], lonLat[1]]],
      range: rangeValues,
      range_type: rangeType
    };

    try {
      const response = await fetch(`${this.baseUrl}/${profile}`, {
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
      return this.displayIsochrones(data, intervals, rangeType, profile);

    } catch (error) {
      console.error('Isochrone API error:', error);
      throw error;
    }
  }

  /**
   * 등시선 결과 표시
   */
  displayIsochrones(geojsonData, intervals, rangeType, profile) {
    const map = mapManager.getMap();
    if (!map) return null;

    // 기존 등시선 레이어 제거
    this.removeIsochrones();

    const format = new GeoJSON();
    const features = format.readFeatures(geojsonData, {
      featureProjection: 'EPSG:3857'
    });

    // 역순으로 정렬 (큰 영역부터 그려야 작은 영역이 위에 표시됨)
    features.reverse();

    const profileName = TRAVEL_PROFILES[profile] || profile;
    const unit = rangeType === 'time' ? '분' : 'km';
    let fullExtent = null;

    // 각 피처를 개별 레이어로 생성
    features.forEach((feature, index) => {
      const colorIndex = Math.min(index, ISOCHRONE_COLORS.length - 1);
      const intervalIndex = features.length - 1 - index;
      const interval = intervals[intervalIndex];

      // 속성에 시간/거리 정보 추가
      feature.set('interval', interval);
      feature.set('rangeType', rangeType);

      // 피처 스타일 제거 (LayerManager가 스타일 관리하도록)
      const clonedFeature = feature.clone();
      clonedFeature.setStyle(null);

      // 개별 레이어 생성
      const source = new VectorSource({ features: [feature] });
      const layer = new VectorLayer({
        source: source,
        zIndex: 100 + index
      });

      this.isochroneLayers.push(layer);

      // LayerManager에 등록 (스타일은 LayerManager가 관리)
      // 색상 정보를 hex로 변환하여 전달
      const fillColorHex = ['#008000', '#90EE90', '#FFFF00', '#FFA500', '#FF4500', '#FF0000'][colorIndex];
      const layerName = `등시선 ${profileName} ${interval}${unit}`;
      const layerId = layerManager.addLayer({
        name: layerName,
        type: 'vector',
        geometryType: 'Polygon',
        features: [clonedFeature],
        color: fillColorHex
      });

      this.isochroneLayerIds.push(layerId);

      // extent 병합
      const layerExtent = source.getExtent();
      if (!fullExtent) {
        fullExtent = layerExtent.slice();
      } else {
        fullExtent[0] = Math.min(fullExtent[0], layerExtent[0]);
        fullExtent[1] = Math.min(fullExtent[1], layerExtent[1]);
        fullExtent[2] = Math.max(fullExtent[2], layerExtent[2]);
        fullExtent[3] = Math.max(fullExtent[3], layerExtent[3]);
      }
    });

    // 범례 생성
    this.createLegend(intervals, rangeType, profile);

    // 등시선 영역으로 지도 이동
    if (fullExtent) {
      map.getView().fit(fullExtent, { padding: [50, 50, 50, 50], maxZoom: 15 });
    }

    return {
      featureCount: features.length,
      intervals: intervals,
      layerIds: this.isochroneLayerIds
    };
  }

  /**
   * 범례 생성
   */
  createLegend(intervals, rangeType, profile) {
    this.removeLegend();

    const legendEl = document.createElement('div');
    legendEl.className = 'isochrone-legend';
    legendEl.id = 'isochrone-legend';

    const profileName = TRAVEL_PROFILES[profile] || profile;
    const unit = rangeType === 'time' ? '분' : 'km';

    let legendHTML = `<div class="isochrone-legend-title">${profileName} 등시선</div>`;
    legendHTML += '<div class="isochrone-legend-items">';

    intervals.forEach((interval, i) => {
      const colorIndex = Math.min(intervals.length - 1 - i, ISOCHRONE_COLORS.length - 1);
      const fillColor = ISOCHRONE_COLORS[colorIndex].replace('0.3', '0.6');
      const label = rangeType === 'time' ? `${interval}분` : `${interval}km`;

      legendHTML += `
        <div class="isochrone-legend-item">
          <span class="isochrone-legend-color" style="background:${fillColor}"></span>
          <span class="isochrone-legend-label">${label} 이내</span>
        </div>`;
    });

    legendHTML += '</div>';
    legendEl.innerHTML = legendHTML;

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.appendChild(legendEl);
      this.legend = legendEl;
    }
  }

  /**
   * 범례 제거
   */
  removeLegend() {
    if (this.legend) {
      this.legend.remove();
      this.legend = null;
    }
  }

  /**
   * 등시선 레이어 제거
   */
  removeIsochrones() {
    // LayerManager에서 등록된 레이어들 제거
    this.isochroneLayerIds.forEach(layerId => {
      layerManager.removeLayer(layerId);
    });

    this.isochroneLayers = [];
    this.isochroneLayerIds = [];
    this.removeLegend();
  }

  /**
   * 레이어로 저장 (이미 자동으로 레이어 추가됨)
   */
  saveAsLayer(name = '등시선 분석 결과') {
    if (this.isochroneLayerIds.length === 0) {
      throw new Error('저장할 등시선 결과가 없습니다.');
    }

    // 이미 LayerManager에 등록되어 있으므로 ID들 반환
    return this.isochroneLayerIds;
  }

  /**
   * 모든 것 정리
   */
  clear() {
    this.stopSelectingPoint();
    this.removeMarker();
    this.removeIsochrones();
  }
}

export const isochroneTool = new IsochroneTool();
