/**
 * DrawingTool - 그리기 도구
 * 포인트, 라인, 폴리곤 및 멀티 지오메트리 그리기 지원
 */

import Draw from 'ol/interaction/Draw';
import Modify from 'ol/interaction/Modify';
import Snap from 'ol/interaction/Snap';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { MultiPoint, MultiLineString, MultiPolygon } from 'ol/geom';
import Feature from 'ol/Feature';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus } from '../utils/EventBus.js';

class DrawingTool {
  constructor() {
    this.drawInteraction = null;
    this.modifyInteraction = null;
    this.snapInteraction = null;
    this.tempSource = null;
    this.tempLayer = null;
    this.currentType = null;
    this.isMultiMode = false;
    this.multiFeatures = []; // 멀티 지오메트리용 피처 저장
    this.targetLayerId = null;
  }

  /**
   * 그리기 스타일
   */
  getDrawStyle() {
    return new Style({
      fill: new Fill({
        color: 'rgba(59, 130, 246, 0.3)'
      }),
      stroke: new Stroke({
        color: '#3b82f6',
        width: 2,
        lineDash: [5, 5]
      }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#3b82f6' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    });
  }

  /**
   * 그리기 시작
   * @param {string} geometryType - 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'
   * @param {string} targetLayerId - 대상 레이어 ID (null이면 새 레이어 생성)
   */
  startDrawing(geometryType, targetLayerId = null) {
    this.stopDrawing();

    const map = mapManager.getMap();
    if (!map) return;

    this.targetLayerId = targetLayerId;

    // 멀티 지오메트리 여부 확인
    this.isMultiMode = geometryType.startsWith('Multi');
    const baseType = this.isMultiMode ? geometryType.replace('Multi', '') : geometryType;
    this.currentType = geometryType;
    this.multiFeatures = [];

    // 임시 소스 및 레이어 생성
    this.tempSource = new VectorSource();
    this.tempLayer = new VectorLayer({
      source: this.tempSource,
      style: this.getDrawStyle(),
      zIndex: 1000
    });
    map.addLayer(this.tempLayer);

    // Draw 인터랙션 생성
    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: baseType,
      style: this.getDrawStyle()
    });

    // 그리기 완료 이벤트
    this.drawInteraction.on('drawend', (e) => {
      if (this.isMultiMode) {
        this.multiFeatures.push(e.feature);
        eventBus.emit('draw:feature-added', {
          count: this.multiFeatures.length,
          type: this.currentType
        });
      } else {
        // 단일 지오메트리는 바로 완료
        this.finishDrawing();
      }
    });

    map.addInteraction(this.drawInteraction);

    // Snap 인터랙션 (기존 레이어에 스냅)
    if (targetLayerId) {
      const targetLayer = layerManager.getLayer(targetLayerId);
      if (targetLayer) {
        this.snapInteraction = new Snap({
          source: targetLayer.source
        });
        map.addInteraction(this.snapInteraction);
      }
    }

    eventBus.emit('draw:started', { type: geometryType });
  }

  /**
   * 그리기 완료 및 레이어에 추가
   */
  finishDrawing() {
    if (!this.tempSource) return null;

    const features = this.tempSource.getFeatures();
    if (features.length === 0) {
      this.stopDrawing();
      return null;
    }

    let resultFeature;

    if (this.isMultiMode && this.multiFeatures.length > 0) {
      // 멀티 지오메트리 생성
      resultFeature = this.createMultiFeature(this.multiFeatures, this.currentType);
    } else if (features.length === 1) {
      resultFeature = features[0].clone();
    } else {
      this.stopDrawing();
      return null;
    }

    // 대상 레이어에 추가 또는 새 레이어 생성
    let layerId;
    if (this.targetLayerId) {
      const targetLayer = layerManager.getLayer(this.targetLayerId);
      if (targetLayer) {
        targetLayer.source.addFeature(resultFeature);
        targetLayer.featureCount = targetLayer.source.getFeatures().length;
        layerId = this.targetLayerId;
      }
    } else {
      // 새 레이어 생성
      layerId = layerManager.addLayer({
        name: this.getLayerName(this.currentType),
        features: [resultFeature],
        geometryType: this.currentType
      });
    }

    this.stopDrawing();

    eventBus.emit('draw:finished', {
      layerId,
      featureCount: 1,
      type: this.currentType
    });

    return layerId;
  }

  /**
   * 멀티 피처 생성
   */
  createMultiFeature(features, type) {
    const geometries = features.map(f => f.getGeometry());
    let multiGeometry;

    switch (type) {
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
        return features[0].clone();
    }

    return new Feature({ geometry: multiGeometry });
  }

  /**
   * 레이어 이름 생성
   */
  getLayerName(type) {
    const names = {
      'Point': '포인트',
      'LineString': '라인',
      'Polygon': '폴리곤',
      'MultiPoint': '멀티포인트',
      'MultiLineString': '멀티라인',
      'MultiPolygon': '멀티폴리곤'
    };
    return (names[type] || '그리기') + '_' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * 마지막 피처 취소 (멀티 모드)
   */
  undoLast() {
    if (!this.isMultiMode || this.multiFeatures.length === 0) return;

    const lastFeature = this.multiFeatures.pop();
    this.tempSource.removeFeature(lastFeature);

    eventBus.emit('draw:feature-removed', {
      count: this.multiFeatures.length,
      type: this.currentType
    });
  }

  /**
   * 그리기 중단
   */
  stopDrawing() {
    const map = mapManager.getMap();
    if (!map) return;

    if (this.drawInteraction) {
      map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }

    if (this.modifyInteraction) {
      map.removeInteraction(this.modifyInteraction);
      this.modifyInteraction = null;
    }

    if (this.snapInteraction) {
      map.removeInteraction(this.snapInteraction);
      this.snapInteraction = null;
    }

    if (this.tempLayer) {
      map.removeLayer(this.tempLayer);
      this.tempLayer = null;
    }

    this.tempSource = null;
    this.currentType = null;
    this.isMultiMode = false;
    this.multiFeatures = [];
    this.targetLayerId = null;

    eventBus.emit('draw:stopped');
  }

  /**
   * 현재 그리기 상태
   */
  isDrawing() {
    return this.drawInteraction !== null;
  }

  /**
   * 현재 그리기 타입
   */
  getCurrentType() {
    return this.currentType;
  }

  /**
   * 멀티 모드 피처 개수
   */
  getMultiFeatureCount() {
    return this.multiFeatures.length;
  }
}

export const drawingTool = new DrawingTool();
