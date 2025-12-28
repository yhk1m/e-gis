/**
 * LayerManager - 레이어 관리 클래스
 */

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { eventBus, Events } from '../utils/EventBus.js';
import { mapManager } from './MapManager.js';

const COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

const STROKE_DASH_OPTIONS = {
  solid: null,
  dashed: [10, 10],
  dotted: [2, 6],
  "dash-dot": [10, 5, 2, 5]
};

class LayerManager {
  constructor() {
    this.layers = new Map();
    this.layerOrder = [];
    this.selectedLayerId = null;
    this.selectedLayerIds = new Set(); // 다중 선택 지원
    this.colorIndex = 0;
  }

  getNextColor() {
    const color = COLOR_PALETTE[this.colorIndex % COLOR_PALETTE.length];
    this.colorIndex++;
    return color;
  }

  getLineDash(strokeDash) {
    return STROKE_DASH_OPTIONS[strokeDash] || null;
  }

  hexToRgba(hex, alpha) {
    if (alpha === undefined) alpha = 1;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  createStyle(color, geometryType) {
    if (!geometryType) geometryType = "polygon";
    const rgbaColor = this.hexToRgba(color, 0.3);

    if (geometryType === "Point" || geometryType === "MultiPoint") {
      return new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: "#ffffff", width: 2 })
        })
      });
    } else if (geometryType === "LineString" || geometryType === "MultiLineString") {
      return new Style({
        stroke: new Stroke({ color: color, width: 3 })
      });
    } else {
      return new Style({
        fill: new Fill({ color: rgbaColor }),
        stroke: new Stroke({ color: color, width: 2 })
      });
    }
  }

  addLayer(options) {
    const name = options.name || "새 레이어";
    const type = options.type || "vector";
    const source = options.source || null;
    const features = options.features || [];
    const visible = options.visible !== undefined ? options.visible : true;
    const color = options.color || null;
    const style = options.style || null;
    const zIndex = options.zIndex !== undefined ? options.zIndex : null;
    const existingLayer = options.olLayer || null; // 기존 레이어 지원

    const layerId = "layer-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
    const layerColor = color || this.getNextColor();

    let vectorSource = null;
    let olLayer;
    let geometryType = options.geometryType || "Polygon";
    let featureCount = 0;

    // geometryType 결정 함수 (벡터 레이어용)
    const detectGeometryType = (src) => {
      if (options.geometryType) return options.geometryType;
      if (src && typeof src.getFeatures === 'function') {
        const firstFeature = src.getFeatures()[0];
        if (firstFeature && firstFeature.getGeometry()) {
          return firstFeature.getGeometry().getType();
        }
      }
      return "Polygon";
    };

    // 래스터 레이어 처리
    if (type === 'raster' && existingLayer) {
      olLayer = existingLayer;
      geometryType = options.geometryType || 'Raster';
      featureCount = 0;
    }
    // 기존 레이어가 전달된 경우 (히트맵 등)
    else if (existingLayer) {
      olLayer = existingLayer;
      vectorSource = olLayer.getSource && olLayer.getSource();
      if (vectorSource && typeof vectorSource.getFeatures === 'function') {
        geometryType = detectGeometryType(vectorSource);
        featureCount = vectorSource.getFeatures().length;
      }
    } else {
      if (source) {
        vectorSource = source;
      } else {
        vectorSource = new VectorSource();
        if (features.length > 0) {
          vectorSource.addFeatures(features);
        }
      }

      geometryType = detectGeometryType(vectorSource);
      const layerStyle = style || this.createStyle(layerColor, geometryType);

      olLayer = new VectorLayer({
        source: vectorSource,
        style: layerStyle,
        visible: visible
      });

      featureCount = vectorSource.getFeatures().length;
    }

    const newZIndex = zIndex !== null ? zIndex : this.layerOrder.length + 1;
    olLayer.setZIndex(newZIndex);

    const layerInfo = {
      id: layerId,
      name: name,
      type: type,
      olLayer: olLayer,
      source: vectorSource,
      visible: visible,
      color: layerColor,
      strokeColor: layerColor,
      fillColor: layerColor,
      geometryType: geometryType,
      featureCount: featureCount,
      strokeDash: "solid",
      fillOpacity: 0.3,
      strokeOpacity: 1.0,
      strokeWidth: 2,
      pointRadius: 6
    };

    this.layers.set(layerId, layerInfo);
    this.layerOrder.push(layerId);

    const map = mapManager.getMap();
    if (map) {
      map.addLayer(olLayer);
    }

    eventBus.emit(Events.LAYER_ADDED, { layer: layerInfo });
    return layerId;
  }

  removeLayer(layerId) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return false;

    const map = mapManager.getMap();
    if (map) {
      map.removeLayer(layerInfo.olLayer);
    }

    this.layers.delete(layerId);
    this.layerOrder = this.layerOrder.filter(function(id) { return id !== layerId; });

    if (this.selectedLayerId === layerId) {
      this.selectedLayerId = null;
    }

    eventBus.emit(Events.LAYER_REMOVED, { layerId: layerId });
    return true;
  }

  toggleVisibility(layerId) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    const newVisibility = !layerInfo.visible;
    layerInfo.visible = newVisibility;
    layerInfo.olLayer.setVisible(newVisibility);

    eventBus.emit(Events.LAYER_VISIBILITY_CHANGED, {
      layerId: layerId,
      visible: newVisibility
    });
  }

  selectLayer(layerId) {
    const prevSelectedId = this.selectedLayerId;
    this.selectedLayerId = layerId;

    // 단일 선택 시 다중 선택 초기화
    this.selectedLayerIds.clear();
    if (layerId) {
      this.selectedLayerIds.add(layerId);
    }

    eventBus.emit(Events.LAYER_SELECTED, {
      layerId: layerId,
      prevLayerId: prevSelectedId
    });
  }

  /**
   * Ctrl/Shift 키와 함께 레이어 선택
   * @param {string} layerId - 선택할 레이어 ID
   * @param {boolean} ctrlKey - Ctrl 키 눌림 여부
   * @param {boolean} shiftKey - Shift 키 눌림 여부
   */
  selectLayerWithModifier(layerId, ctrlKey, shiftKey) {
    if (!ctrlKey && !shiftKey) {
      // 일반 클릭: 단일 선택
      this.selectLayer(layerId);
      return;
    }

    if (ctrlKey) {
      // Ctrl+클릭: 토글 선택
      this.toggleLayerSelection(layerId);
    } else if (shiftKey && this.selectedLayerId) {
      // Shift+클릭: 범위 선택
      this.selectRange(this.selectedLayerId, layerId);
    } else {
      // Shift만 눌렸지만 기존 선택이 없으면 단일 선택
      this.selectLayer(layerId);
    }
  }

  /**
   * 레이어 선택 토글 (Ctrl+클릭)
   */
  toggleLayerSelection(layerId) {
    if (this.selectedLayerIds.has(layerId)) {
      this.selectedLayerIds.delete(layerId);
      // 마지막 선택된 레이어가 해제되면 selectedLayerId도 업데이트
      if (this.selectedLayerId === layerId) {
        const remaining = Array.from(this.selectedLayerIds);
        this.selectedLayerId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }
    } else {
      this.selectedLayerIds.add(layerId);
      this.selectedLayerId = layerId;
    }

    eventBus.emit(Events.LAYER_SELECTED, {
      layerId: this.selectedLayerId,
      selectedIds: Array.from(this.selectedLayerIds)
    });
  }

  /**
   * 범위 선택 (Shift+클릭)
   */
  selectRange(startId, endId) {
    const startIndex = this.layerOrder.indexOf(startId);
    const endIndex = this.layerOrder.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    // 범위 내 모든 레이어 선택
    this.selectedLayerIds.clear();
    for (let i = minIndex; i <= maxIndex; i++) {
      this.selectedLayerIds.add(this.layerOrder[i]);
    }

    // 기본 선택 레이어는 클릭한 레이어로 설정
    this.selectedLayerId = endId;

    eventBus.emit(Events.LAYER_SELECTED, {
      layerId: this.selectedLayerId,
      selectedIds: Array.from(this.selectedLayerIds)
    });
  }

  /**
   * 선택에 레이어 추가
   */
  addToSelection(layerId) {
    if (!this.layers.has(layerId)) return;
    this.selectedLayerIds.add(layerId);
    this.selectedLayerId = layerId;

    eventBus.emit(Events.LAYER_SELECTED, {
      layerId: this.selectedLayerId,
      selectedIds: Array.from(this.selectedLayerIds)
    });
  }

  /**
   * 선택에서 레이어 제거
   */
  removeFromSelection(layerId) {
    this.selectedLayerIds.delete(layerId);
    if (this.selectedLayerId === layerId) {
      const remaining = Array.from(this.selectedLayerIds);
      this.selectedLayerId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    eventBus.emit(Events.LAYER_SELECTED, {
      layerId: this.selectedLayerId,
      selectedIds: Array.from(this.selectedLayerIds)
    });
  }

  /**
   * 모든 선택 해제
   */
  clearSelection() {
    this.selectedLayerIds.clear();
    this.selectedLayerId = null;

    eventBus.emit(Events.LAYER_SELECTED, {
      layerId: null,
      selectedIds: []
    });
  }

  /**
   * 선택된 레이어 ID 목록 반환
   */
  getSelectedLayerIds() {
    return Array.from(this.selectedLayerIds);
  }

  /**
   * 선택된 레이어 정보 목록 반환
   */
  getSelectedLayers() {
    const self = this;
    return Array.from(this.selectedLayerIds).map(function(id) {
      return self.layers.get(id);
    }).filter(Boolean);
  }

  /**
   * 레이어가 선택되었는지 확인
   */
  isLayerSelected(layerId) {
    return this.selectedLayerIds.has(layerId);
  }

  getLayer(layerId) {
    return this.layers.get(layerId);
  }

  getAllLayers() {
    const self = this;
    return this.layerOrder.map(function(id) { return self.layers.get(id); }).filter(Boolean);
  }

  reorderLayers(newOrder) {
    const self = this;
    this.layerOrder = newOrder.slice();

    this.layerOrder.forEach(function(layerId, index) {
      const layerInfo = self.layers.get(layerId);
      if (layerInfo) {
        layerInfo.olLayer.setZIndex(index + 1);
      }
    });

    eventBus.emit(Events.LAYER_ORDER_CHANGED, { order: this.layerOrder });
  }

  renameLayer(layerId, newName) {
    const layerInfo = this.layers.get(layerId);
    if (layerInfo) {
      layerInfo.name = newName;
      eventBus.emit(Events.LAYER_ADDED, { layer: layerInfo });
    }
  }

  setLayerColor(layerId, newColor) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    layerInfo.color = newColor;
    layerInfo.strokeColor = newColor;
    layerInfo.fillColor = newColor;
    this.updateLayerStyle(layerId);
  }

  setLayerStrokeColor(layerId, strokeColor) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    layerInfo.strokeColor = strokeColor;
    this.updateLayerStyle(layerId);
  }

  setLayerFillColor(layerId, fillColor) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    layerInfo.fillColor = fillColor;
    this.updateLayerStyle(layerId);
  }

  getColorPalette() {
    return COLOR_PALETTE;
  }

  getStrokeDashOptions() {
    return Object.keys(STROKE_DASH_OPTIONS);
  }

  setLayerStrokeDash(layerId, strokeDash) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    layerInfo.strokeDash = strokeDash;
    this.updateLayerStyle(layerId);
  }

  setLayerFillOpacity(layerId, fillOpacity) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    layerInfo.fillOpacity = fillOpacity;
    this.updateLayerStyle(layerId);
  }

  setLayerStrokeOpacity(layerId, strokeOpacity) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    layerInfo.strokeOpacity = strokeOpacity;
    this.updateLayerStyle(layerId);
  }

  updateLayerStyle(layerId) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    const lineDash = this.getLineDash(layerInfo.strokeDash || "solid");
    const fillOpacity = layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.3;
    const strokeOpacity = layerInfo.strokeOpacity !== undefined ? layerInfo.strokeOpacity : 1.0;
    const strokeColor = layerInfo.strokeColor || layerInfo.color;
    const fillColor = layerInfo.fillColor || layerInfo.color;

    const rgbaFill = this.hexToRgba(fillColor, fillOpacity);
    const rgbaStroke = this.hexToRgba(strokeColor, strokeOpacity);

    let newStyle;
    const geoType = layerInfo.geometryType;

    if (geoType === "LineString" || geoType === "MultiLineString") {
      newStyle = new Style({
        stroke: new Stroke({
          color: rgbaStroke,
          width: layerInfo.strokeWidth || 2,
          lineDash: lineDash
        })
      });
    } else if (geoType === "Point" || geoType === "MultiPoint") {
      newStyle = new Style({
        image: new CircleStyle({
          radius: layerInfo.pointRadius || 6,
          fill: new Fill({ color: rgbaFill }),
          stroke: new Stroke({ color: rgbaStroke, width: 2 })
        })
      });
    } else {
      newStyle = new Style({
        fill: new Fill({ color: rgbaFill }),
        stroke: new Stroke({
          color: rgbaStroke,
          width: layerInfo.strokeWidth || 2,
          lineDash: lineDash
        })
      });
    }

    // 라벨이 적용된 레이어의 경우 _originalStyle을 업데이트하고 라벨 스타일 유지
    const layer = layerInfo.olLayer;
    if (layer._hasLabel && layer._originalStyle) {
      layer._originalStyle = newStyle;
      eventBus.emit('label:refresh', { layerId: layerId });
    } else {
      layer.setStyle(newStyle);
    }

    // 레이어 소스 변경 알림 (렌더링 강제)
    layerInfo.source.changed();

    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId: layerId });
    eventBus.emit(Events.LAYER_ADDED, { layer: layerInfo });
  }

  zoomToLayer(layerId) {
    const layerInfo = this.layers.get(layerId);
    if (!layerInfo) return;

    const extent = layerInfo.source.getExtent();
    if (extent && extent[0] !== Infinity) {
      mapManager.fitExtent(extent, { padding: [50, 50, 50, 50] });
    }
  }

  getSelectedLayerId() {
    return this.selectedLayerId;
  }

  getLayerCount() {
    return this.layers.size;
  }

  clear() {
    const self = this;
    const layerIds = Array.from(this.layers.keys());
    layerIds.forEach(function(id) { self.removeLayer(id); });
  }
}

export const layerManager = new LayerManager();
