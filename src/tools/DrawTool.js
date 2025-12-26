/**
 * DrawTool - 벡터 그리기 도구
 * 단일 도형 및 멀티 도형 지원
 */

import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { MultiPoint, MultiLineString, MultiPolygon } from 'ol/geom';
import Feature from 'ol/Feature';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

// 그리기 스타일
const DRAW_STYLE = new Style({
  fill: new Fill({
    color: 'rgba(59, 130, 246, 0.2)'
  }),
  stroke: new Stroke({
    color: '#3b82f6',
    width: 2,
    lineDash: [5, 5]
  }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: '#3b82f6' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 })
  })
});

class DrawTool {
  constructor() {
    this.map = null;
    this.draw = null;
    this.currentType = null;
    this.tempSource = null;
    this.tempLayer = null;
    this.isActive = false;
    this.contextMenuHandler = null;
    this.isMultiMode = false;
    this.multiFeatures = [];
  }

  init() {
    this.map = mapManager.getMap();
    this.tempSource = new VectorSource();
    this.tempLayer = new VectorLayer({
      source: this.tempSource,
      style: DRAW_STYLE,
      zIndex: 1000
    });
  }

  activate(type) {
    if (!this.map) this.init();
    this.deactivate();
    this.currentType = type;

    // 멀티 도형 여부 확인
    this.isMultiMode = type.startsWith('Multi');
    const baseType = this.isMultiMode ? type.replace('Multi', '') : type;
    this.multiFeatures = [];

    this.draw = new Draw({
      source: this.tempSource,
      type: baseType,
      style: DRAW_STYLE
    });

    this.draw.on('drawend', (event) => {
      this.handleDrawEnd(event);
    });

    this.map.addLayer(this.tempLayer);
    this.map.addInteraction(this.draw);

    // 우클릭으로 그리기 완료
    this.contextMenuHandler = (e) => {
      e.preventDefault();
      if (this.draw && (baseType === 'LineString' || baseType === 'Polygon')) {
        this.draw.finishDrawing();
      }
    };
    this.map.getViewport().addEventListener('contextmenu', this.contextMenuHandler);

    this.isActive = true;
    this.updateStatusMessage(type);
    eventBus.emit(Events.TOOL_ACTIVATED, { tool: 'draw', type });
  }

  handleDrawEnd(event) {
    const feature = event.feature;

    // 멀티 모드인 경우 피처를 수집
    if (this.isMultiMode) {
      this.multiFeatures.push(feature.clone());
      const statusEl = document.getElementById('status-message');
      if (statusEl) {
        statusEl.textContent = `${this.getTypeName(this.currentType)} 그리기 중 (${this.multiFeatures.length}개) - 버튼을 다시 클릭하면 저장`;
      }
      return;
    }

    // 단일 도형은 바로 레이어로 저장
    const geometry = feature.getGeometry();
    const type = geometry.getType();
    const timestamp = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const layerName = this.getTypeName(type) + ' ' + timestamp;

    setTimeout(() => {
      this.tempSource.clear();

      const layerId = layerManager.addLayer({
        name: layerName,
        type: 'vector',
        features: [feature],
        geometryType: type
      });

      eventBus.emit(Events.FEATURE_CREATED, {
        layerId,
        feature,
        geometryType: type
      });

      const statusEl = document.getElementById('status-message');
      if (statusEl) {
        statusEl.textContent = layerName + ' 생성됨';
        setTimeout(() => {
          this.updateStatusMessage(this.currentType);
        }, 2000);
      }
    }, 100);
  }

  /**
   * 멀티 도형 저장
   */
  saveMultiFeature() {
    if (!this.isMultiMode || this.multiFeatures.length === 0) {
      return null;
    }

    const geometries = this.multiFeatures.map(f => f.getGeometry());
    let multiGeometry;

    switch (this.currentType) {
      case 'MultiPoint':
        const points = geometries.map(g => g.getCoordinates());
        multiGeometry = new MultiPoint(points);
        break;
      case 'MultiLineString':
        const lines = geometries.map(g => g.getCoordinates());
        multiGeometry = new MultiLineString(lines);
        break;
      case 'MultiPolygon':
        const polygons = geometries.map(g => g.getCoordinates());
        multiGeometry = new MultiPolygon(polygons);
        break;
      default:
        return null;
    }

    const multiFeature = new Feature({ geometry: multiGeometry });
    const timestamp = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const layerName = this.getTypeName(this.currentType) + ' ' + timestamp;

    const layerId = layerManager.addLayer({
      name: layerName,
      type: 'vector',
      features: [multiFeature],
      geometryType: this.currentType
    });

    const count = this.multiFeatures.length;
    this.tempSource.clear();
    this.multiFeatures = [];

    eventBus.emit(Events.FEATURE_CREATED, {
      layerId,
      feature: multiFeature,
      geometryType: this.currentType
    });

    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = `${layerName} 생성됨 (${count}개 도형)`;
    }

    return layerId;
  }

  /**
   * 도형 타입 이름
   */
  getTypeName(type) {
    const typeNames = {
      'Point': '포인트',
      'LineString': '라인',
      'Polygon': '폴리곤',
      'MultiPoint': '멀티포인트',
      'MultiLineString': '멀티라인',
      'MultiPolygon': '멀티폴리곤'
    };
    return typeNames[type] || type;
  }

  updateStatusMessage(type) {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;

    const messages = {
      'Point': '지도를 클릭하여 점을 찍으세요',
      'LineString': '클릭으로 선을 그리세요. 더블클릭 또는 우클릭으로 완료',
      'Polygon': '클릭으로 면을 그리세요. 더블클릭 또는 우클릭으로 완료',
      'MultiPoint': '여러 점을 클릭하세요. 버튼을 다시 클릭하면 저장',
      'MultiLineString': '여러 선을 그리세요. 버튼을 다시 클릭하면 저장',
      'MultiPolygon': '여러 면을 그리세요. 버튼을 다시 클릭하면 저장'
    };

    statusEl.textContent = messages[type] || '그리기 모드';
  }

  /**
   * 멀티 모드 여부
   */
  getIsMultiMode() {
    return this.isMultiMode;
  }

  /**
   * 수집된 멀티 피처 개수
   */
  getMultiFeatureCount() {
    return this.multiFeatures.length;
  }

  deactivate() {
    if (this.draw) {
      this.map.removeInteraction(this.draw);
      if (this.contextMenuHandler) {
        this.map.getViewport().removeEventListener('contextmenu', this.contextMenuHandler);
        this.contextMenuHandler = null;
      }
      this.draw = null;
    }

    if (this.tempLayer && this.map) {
      this.map.removeLayer(this.tempLayer);
    }

    if (this.tempSource) {
      this.tempSource.clear();
    }

    this.isActive = false;
    this.contextMenuHandler = null;
    this.currentType = null;
    this.isMultiMode = false;
    this.multiFeatures = [];

    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = '준비';
    }

    eventBus.emit(Events.TOOL_DEACTIVATED, { tool: 'draw' });
  }

  getIsActive() {
    return this.isActive;
  }

  getCurrentType() {
    return this.currentType;
  }
}

export const drawTool = new DrawTool();
