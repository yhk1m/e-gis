/**
 * HeatmapTool - 히트맵 시각화 도구
 * OpenLayers Heatmap 레이어를 사용하여 포인트 밀도 시각화
 */

import Heatmap from 'ol/layer/Heatmap';
import VectorSource from 'ol/source/Vector';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

class HeatmapTool {
  constructor() {
    this.heatmapLayers = new Map(); // layerId -> heatmapLayer
    this.legends = new Map(); // layerId -> legend element
    this.initEventListeners();
  }

  /**
   * 이벤트 리스너 초기화
   */
  initEventListeners() {
    // 레이어 삭제 시 범례도 함께 제거
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      const { layerId } = data;
      if (this.heatmapLayers.has(layerId)) {
        this.heatmapLayers.delete(layerId);
        this.removeLegend(layerId);
      }
    });
  }

  /**
   * 히트맵 생성
   * @param {string} layerId - 소스 포인트 레이어 ID
   * @param {Object} options - 히트맵 옵션
   * @returns {string} 히트맵 레이어 ID
   */
  createHeatmap(layerId, options = {}) {
    const {
      blur = 15,
      radius = 10,
      weight = null, // 가중치 필드명
      gradient = null // 커스텀 그라디언트
    } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    // 포인트 레이어만 지원
    if (layerInfo.geometryType !== 'Point' && layerInfo.geometryType !== 'MultiPoint') {
      throw new Error('히트맵은 포인트 레이어에서만 생성할 수 있습니다.');
    }

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();

    if (features.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    // 새로운 VectorSource 생성 (원본 복사)
    const heatmapSource = new VectorSource({
      features: features.map(f => f.clone())
    });

    // 히트맵 레이어 옵션
    const heatmapOptions = {
      source: heatmapSource,
      blur: blur,
      radius: radius,
      zIndex: 500
    };

    // 가중치 함수 설정
    if (weight) {
      heatmapOptions.weight = (feature) => {
        const value = feature.get(weight);
        if (typeof value === 'number') {
          // 0-1 사이로 정규화
          return Math.min(Math.max(value / 100, 0), 1);
        }
        return 1;
      };
    }

    // 커스텀 그라디언트
    if (gradient) {
      heatmapOptions.gradient = gradient;
    }

    // 히트맵 레이어 생성
    const heatmapLayer = new Heatmap(heatmapOptions);

    // LayerManager에 히트맵 레이어 등록
    const heatmapLayerId = layerManager.addLayer({
      name: `${layerInfo.name}_히트맵`,
      type: 'heatmap',
      olLayer: heatmapLayer, // 기존 레이어 전달
      geometryType: 'Point',
      visible: true
    });

    // 히트맵 레이어 정보 저장
    this.heatmapLayers.set(heatmapLayerId, {
      layer: heatmapLayer,
      sourceLayerId: layerId,
      options: options
    });

    // 원래 레이어 숨기기 옵션
    if (options.hideSource) {
      layerInfo.olLayer.setVisible(false);
    }

    // 범례 생성
    this.createLegend(heatmapLayerId, layerInfo.name, gradient || this.getGradients()[0].value);

    return heatmapLayerId;
  }

  /**
   * 범례 생성
   */
  createLegend(layerId, layerName, gradient) {
    this.removeLegend(layerId);

    const legendEl = document.createElement('div');
    legendEl.className = 'heatmap-legend';
    legendEl.id = `heatmap-legend-${layerId}`;

    const gradientCSS = `linear-gradient(to right, ${gradient.join(', ')})`;

    legendEl.innerHTML = `
      <div class="heatmap-legend-title">${layerName} 히트맵</div>
      <div class="heatmap-legend-bar" style="background: ${gradientCSS}"></div>
      <div class="heatmap-legend-labels">
        <span>낮음</span>
        <span>높음</span>
      </div>
    `;

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.appendChild(legendEl);
      this.legends.set(layerId, legendEl);
    }
  }

  /**
   * 범례 제거
   */
  removeLegend(layerId) {
    const legendEl = this.legends.get(layerId);
    if (legendEl) {
      legendEl.remove();
      this.legends.delete(layerId);
    }
  }

  /**
   * 히트맵 설정 업데이트
   * @param {string} heatmapId - 히트맵 레이어 ID
   * @param {Object} options - 새 옵션
   */
  updateHeatmap(heatmapId, options) {
    const heatmapInfo = this.heatmapLayers.get(heatmapId);
    if (!heatmapInfo) return;

    const { layer } = heatmapInfo;

    if (options.blur !== undefined) {
      layer.setBlur(options.blur);
    }

    if (options.radius !== undefined) {
      layer.setRadius(options.radius);
    }

    if (options.gradient !== undefined) {
      layer.setGradient(options.gradient);
    }
  }

  /**
   * 히트맵 제거
   * @param {string} heatmapId - 히트맵 레이어 ID
   */
  removeHeatmap(heatmapId) {
    const heatmapInfo = this.heatmapLayers.get(heatmapId);
    if (!heatmapInfo) return;

    // LayerManager를 통해 제거
    layerManager.removeLayer(heatmapId);
    this.heatmapLayers.delete(heatmapId);

    // 범례 제거
    this.removeLegend(heatmapId);
  }

  /**
   * 포인트 레이어 목록 가져오기
   */
  getPointLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.geometryType === 'Point' || layer.geometryType === 'MultiPoint';
    });
  }

  /**
   * 미리 정의된 그라디언트 목록
   */
  getGradients() {
    return [
      {
        name: '기본 (파랑-빨강)',
        value: ['#00f', '#0ff', '#0f0', '#ff0', '#f00']
      },
      {
        name: '열화상',
        value: ['#000', '#800080', '#ff0000', '#ffff00', '#ffffff']
      },
      {
        name: '초록색 계열',
        value: ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837']
      },
      {
        name: '파랑색 계열',
        value: ['#f7fbff', '#deebf7', '#c6dbef', '#6baed6', '#2171b5']
      },
      {
        name: '단색 (빨강)',
        value: ['rgba(255,0,0,0)', 'rgba(255,0,0,0.5)', 'rgba(255,0,0,1)']
      }
    ];
  }

  /**
   * 사용 가능한 숫자 필드 목록 가져오기
   */
  getNumericFields(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();
    if (features.length === 0) return [];

    const props = features[0].getProperties();
    const numericFields = [];

    for (const key in props) {
      if (key === 'geometry') continue;
      if (typeof props[key] === 'number') {
        numericFields.push(key);
      }
    }

    return numericFields;
  }
}

export const heatmapTool = new HeatmapTool();
