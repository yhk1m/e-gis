// © 2026 김용현
/**
 * FeatureEditTool - 피처 편집 도구 (합치기 / 자르기)
 *
 * QGIS 편집 세션의 "피처 합치기(Merge)"와 "피처 자르기(Split)"를 제공한다.
 * 한 레이어 안에서 선택한 피처들을 대상으로 동작하며, 기존 SelectTool/LayerManager 와 연동한다.
 * 지오메트리 연산은 OL/DOM 비의존 순수 모듈(FeatureEditGeometry)에 위임한다.
 */

import Draw from 'ol/interaction/Draw';
import Snap from 'ol/interaction/Snap';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { selectTool } from './SelectTool.js';
import { eventBus, Events } from '../utils/EventBus.js';
import {
  mergeGeoJSON,
  splitPolygonByLine,
  splitLineByLine,
  lineIntersectsFeature
} from './FeatureEditGeometry.js';

const PROJ_OPTS = {
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857'
};

class FeatureEditTool {
  constructor() {
    this.format = new GeoJSON();
    this.drawInteraction = null;
    this.snapInteractions = [];
    this.tempSource = null;
    this.tempLayer = null;
    this.isSplitActive = false;
  }

  // ==================== 합치기 ====================

  /**
   * 선택된 피처들을 하나로 합친다.
   */
  mergeSelected() {
    const selected = selectTool.getSelectedFeatures();
    if (selected.length < 2) {
      alert('합칠 피처를 2개 이상 선택하세요.\n(선택 도구로 Shift+클릭 또는 드래그)');
      return;
    }

    // 모두 같은 레이어인지 확인
    const layerInfo = this.getLayerOfFeature(selected[0]);
    if (!layerInfo) {
      alert('피처가 속한 레이어를 찾을 수 없습니다.');
      return;
    }
    for (const f of selected) {
      if (this.getLayerOfFeature(f) !== layerInfo) {
        alert('같은 레이어의 피처만 합칠 수 있습니다.');
        return;
      }
    }

    const gjs = selected.map((f) => this.featureToGeoJSON(f));

    // 타입 호환성 검사 (폴리곤끼리 또는 라인끼리)
    const family = this.geometryFamily(gjs[0]);
    if (family === 'point') {
      alert('포인트는 합칠 수 없습니다. 폴리곤 또는 라인을 선택하세요.');
      return;
    }
    if (!gjs.every((g) => this.geometryFamily(g) === family)) {
      alert('같은 종류의 피처(폴리곤끼리 또는 라인끼리)만 합칠 수 있습니다.');
      return;
    }

    try {
      const mergedGj = mergeGeoJSON(gjs);
      const newFeature = this.geoJSONToFeature(mergedGj);

      selected.forEach((f) => layerInfo.source.removeFeature(f));
      layerInfo.source.addFeature(newFeature);
      layerInfo.featureCount = layerInfo.source.getFeatures().length;

      // 결과를 다시 선택
      if (selectTool.selectedFeatures) {
        selectTool.selectedFeatures.clear();
        selectTool.selectedFeatures.push(newFeature);
      }

      eventBus.emit(Events.FEATURE_MODIFIED, { feature: newFeature });
      this.status(`피처 ${selected.length}개를 1개로 합쳤습니다.`);
    } catch (e) {
      alert('합치기 실패: ' + e.message);
    }
  }

  // ==================== 자르기 ====================

  /**
   * 자르기 모드 시작 (자를 선을 그리는 Draw 인터랙션 활성화)
   */
  startSplit() {
    if (this.isSplitActive) return;
    const map = mapManager.getMap();
    if (!map) return;

    this.tempSource = new VectorSource();
    this.tempLayer = new VectorLayer({
      source: this.tempSource,
      style: this.getCutStyle(),
      zIndex: 1000
    });
    map.addLayer(this.tempLayer);

    this.drawInteraction = new Draw({
      source: this.tempSource,
      type: 'LineString',
      style: this.getCutStyle()
    });
    this.drawInteraction.on('drawend', (e) => this.handleCutLine(e.feature));
    map.addInteraction(this.drawInteraction);

    // 스냅(자석): 기존 피처의 꼭짓점·경계에 자를 선이 달라붙도록 함.
    // OL 권장에 따라 Draw 이후 마지막에 추가한다. 레이어별 소스마다 Snap 1개.
    this.addSnap(map);

    this.isSplitActive = true;
    this.status('자를 선을 그리세요. 꼭짓점·경계에 자석처럼 달라붙습니다. (더블클릭으로 완료)');
    eventBus.emit(Events.TOOL_ACTIVATED, { tool: 'edit-split' });
  }

  /**
   * 모든 벡터 레이어 소스에 Snap 인터랙션을 추가한다.
   */
  addSnap(map) {
    this.snapInteractions = [];
    layerManager.getAllLayers().forEach((layerInfo) => {
      if (!layerInfo.source) return;
      const snap = new Snap({ source: layerInfo.source, pixelTolerance: 12 });
      map.addInteraction(snap);
      this.snapInteractions.push(snap);
    });
  }

  /**
   * 자르기 모드 종료
   */
  stopSplit() {
    const map = mapManager.getMap();
    if (map) {
      this.snapInteractions.forEach((snap) => map.removeInteraction(snap));
      if (this.drawInteraction) map.removeInteraction(this.drawInteraction);
      if (this.tempLayer) map.removeLayer(this.tempLayer);
    }
    this.snapInteractions = [];
    this.drawInteraction = null;
    this.tempSource = null;
    this.tempLayer = null;
    this.isSplitActive = false;
    eventBus.emit(Events.TOOL_DEACTIVATED, { tool: 'edit-split' });
  }

  /** ToolManager 호환 alias */
  deactivate() {
    this.stopSplit();
  }

  getIsActive() {
    return this.isSplitActive;
  }

  getIsSplitActive() {
    return this.isSplitActive;
  }

  /**
   * 자를 선이 완성되면 교차하는 피처들을 분할한다.
   */
  handleCutLine(cutFeature) {
    const cutGj = this.featureToGeoJSON(cutFeature);
    if (this.tempSource) this.tempSource.clear();

    // 대상: 선택된 피처가 있으면 그 안에서, 없으면 전체 피처에서
    const selected = selectTool.getSelectedFeatures();
    const candidates = selected.length ? selected.slice() : this.getAllFeatures();

    let splitCount = 0;

    candidates.forEach((feature) => {
      const layerInfo = this.getLayerOfFeature(feature);
      if (!layerInfo) return;

      const gj = this.featureToGeoJSON(feature);
      if (!lineIntersectsFeature(gj, cutGj)) return;

      const type = gj.geometry.type;
      let parts = null;
      try {
        if (type === 'Polygon' || type === 'MultiPolygon') {
          parts = splitPolygonByLine(gj, cutGj);
        } else if (type === 'LineString' || type === 'MultiLineString') {
          parts = splitLineByLine(gj, cutGj);
        }
      } catch (e) {
        parts = null;
      }

      if (!parts || parts.length < 2) return;

      layerInfo.source.removeFeature(feature);
      parts.forEach((p) => layerInfo.source.addFeature(this.geoJSONToFeature(p)));
      layerInfo.featureCount = layerInfo.source.getFeatures().length;
      splitCount++;
    });

    if (splitCount === 0) {
      this.status('자를 선이 어떤 피처와도 교차하지 않았습니다.');
    } else {
      if (selectTool.clearSelection) selectTool.clearSelection();
      eventBus.emit(Events.FEATURE_MODIFIED, {});
      this.status(`${splitCount}개 피처를 분할했습니다.`);
    }
  }

  // ==================== 헬퍼 ====================

  getCutStyle() {
    return new Style({
      stroke: new Stroke({
        color: '#ef4444',
        width: 2,
        lineDash: [6, 4]
      }),
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#ef4444' }),
        stroke: new Stroke({ color: '#fff', width: 1.5 })
      })
    });
  }

  getLayerOfFeature(feature) {
    const layers = layerManager.getAllLayers();
    for (const layerInfo of layers) {
      if (layerInfo.source && layerInfo.source.hasFeature(feature)) {
        return layerInfo;
      }
    }
    return null;
  }

  getAllFeatures() {
    const features = [];
    layerManager.getAllLayers().forEach((layerInfo) => {
      if (layerInfo.source) features.push(...layerInfo.source.getFeatures());
    });
    return features;
  }

  featureToGeoJSON(feature) {
    return this.format.writeFeatureObject(feature, PROJ_OPTS);
  }

  geoJSONToFeature(geojson) {
    return this.format.readFeature(geojson, PROJ_OPTS);
  }

  geometryFamily(geojson) {
    const t = geojson.geometry ? geojson.geometry.type : null;
    if (t === 'Polygon' || t === 'MultiPolygon') return 'polygon';
    if (t === 'LineString' || t === 'MultiLineString') return 'line';
    if (t === 'Point' || t === 'MultiPoint') return 'point';
    return 'unknown';
  }

  status(message) {
    const el = document.getElementById('status-message');
    if (!el) return;
    el.textContent = message;
    setTimeout(() => {
      if (el.textContent === message) el.textContent = '피처를 클릭하여 선택하세요';
    }, 3000);
  }
}

// 싱글톤 인스턴스
export const featureEditTool = new FeatureEditTool();
