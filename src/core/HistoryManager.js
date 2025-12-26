/**
 * HistoryManager - 실행 취소/다시 실행 관리
 */

import { eventBus, Events } from '../utils/EventBus.js';
import { layerManager } from './LayerManager.js';
import GeoJSON from 'ol/format/GeoJSON';

const MAX_HISTORY = 50; // 최대 히스토리 개수

class HistoryManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.geojsonFormat = new GeoJSON();
  }

  /**
   * 초기화 - 이벤트 리스너 등록
   */
  init() {
    // 피처 생성 이벤트
    eventBus.on(Events.FEATURE_CREATED, ({ feature, layerId }) => {
      const layer = layerManager.getLayer(layerId);
      this.pushAction({
        type: 'create',
        layerId,
        layerName: layer ? layer.name : '새 레이어',
        featureData: this.serializeFeature(feature),
        featureId: feature.ol_uid
      });
    });

    // 피처 삭제 이벤트
    eventBus.on(Events.FEATURE_DELETED, ({ feature, layerId }) => {
      this.pushAction({
        type: 'delete',
        layerId,
        featureData: this.serializeFeature(feature),
        featureId: feature.ol_uid
      });
    });

    // 피처 수정 이벤트 (수정 전 상태 저장 필요)
    eventBus.on(Events.FEATURE_MODIFY_START, ({ feature, layerId }) => {
      this.pendingModify = {
        layerId,
        featureId: feature.ol_uid,
        beforeData: this.serializeFeature(feature)
      };
    });

    eventBus.on(Events.FEATURE_MODIFIED, ({ feature }) => {
      if (this.pendingModify && this.pendingModify.featureId === feature.ol_uid) {
        this.pushAction({
          type: 'modify',
          layerId: this.pendingModify.layerId,
          featureId: feature.ol_uid,
          beforeData: this.pendingModify.beforeData,
          afterData: this.serializeFeature(feature)
        });
        this.pendingModify = null;
      }
    });

    console.log('HistoryManager 초기화 완료');
  }

  /**
   * 피처를 GeoJSON으로 직렬화
   */
  serializeFeature(feature) {
    return this.geojsonFormat.writeFeatureObject(feature, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326'
    });
  }

  /**
   * GeoJSON에서 피처 복원
   */
  deserializeFeature(data) {
    return this.geojsonFormat.readFeature(data, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326'
    });
  }

  /**
   * 액션 추가
   */
  pushAction(action) {
    this.undoStack.push(action);

    // 최대 개수 초과 시 오래된 것 제거
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }

    // 새 액션 추가 시 redo 스택 초기화
    this.redoStack = [];

    eventBus.emit(Events.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * 실행 취소 가능 여부
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * 다시 실행 가능 여부
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * 실행 취소
   */
  undo() {
    if (!this.canUndo()) {
      return false;
    }

    const action = this.undoStack.pop();
    const layer = layerManager.getLayer(action.layerId);

    if (!layer) {
      console.warn('레이어를 찾을 수 없습니다:', action.layerId);
      return false;
    }

    const source = layer.source;

    switch (action.type) {
      case 'create':
        // 생성 취소 = 삭제
        const featureToRemove = source.getFeatures().find(f => f.ol_uid === action.featureId);
        if (featureToRemove) {
          source.removeFeature(featureToRemove);
          layer.featureCount = source.getFeatures().length;
          // 레이어에 피처가 없으면 레이어도 삭제
          if (layer.featureCount === 0) {
            layerManager.removeLayer(action.layerId);
          }
        }
        break;

      case 'delete':
        // 삭제 취소 = 복원
        const restoredFeature = this.deserializeFeature(action.featureData);
        restoredFeature.ol_uid = action.featureId; // UID 복원
        source.addFeature(restoredFeature);
        layer.featureCount = source.getFeatures().length;
        break;

      case 'modify':
        // 수정 취소 = 이전 상태로 복원
        const featureToRevert = source.getFeatures().find(f => f.ol_uid === action.featureId);
        if (featureToRevert) {
          const beforeFeature = this.deserializeFeature(action.beforeData);
          featureToRevert.setGeometry(beforeFeature.getGeometry());
          featureToRevert.setProperties(beforeFeature.getProperties());
        }
        break;
    }

    // redo 스택에 추가
    this.redoStack.push(action);

    // 레이어 패널 갱신
    eventBus.emit(Events.LAYER_ADDED, {});
    eventBus.emit(Events.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });

    return true;
  }

  /**
   * 다시 실행
   */
  redo() {
    if (!this.canRedo()) {
      return false;
    }

    const action = this.redoStack.pop();
    let layer = layerManager.getLayer(action.layerId);

    // create 타입인데 레이어가 없으면 새로 생성
    if (!layer && action.type === 'create') {
      const recreatedFeature = this.deserializeFeature(action.featureData);
      recreatedFeature.ol_uid = action.featureId;

      // 레이어 이름 추출 (action에 저장된 이름 사용)
      const newLayerId = layerManager.addLayer({
        name: action.layerName || '복원된 레이어',
        features: [recreatedFeature]
      });

      // layerId 업데이트 (새 레이어 ID로)
      action.layerId = newLayerId;

      this.undoStack.push(action);
      eventBus.emit(Events.LAYER_ADDED, {});
      eventBus.emit(Events.HISTORY_CHANGED, {
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
      return true;
    }

    if (!layer) {
      console.warn('레이어를 찾을 수 없습니다:', action.layerId);
      return false;
    }

    const source = layer.source;

    switch (action.type) {
      case 'create':
        // 생성 다시 실행 = 복원
        const recreatedFeature = this.deserializeFeature(action.featureData);
        recreatedFeature.ol_uid = action.featureId;
        source.addFeature(recreatedFeature);
        layer.featureCount = source.getFeatures().length;
        break;

      case 'delete':
        // 삭제 다시 실행 = 삭제
        const featureToDelete = source.getFeatures().find(f => f.ol_uid === action.featureId);
        if (featureToDelete) {
          source.removeFeature(featureToDelete);
          layer.featureCount = source.getFeatures().length;
        }
        break;

      case 'modify':
        // 수정 다시 실행 = 이후 상태로 복원
        const featureToModify = source.getFeatures().find(f => f.ol_uid === action.featureId);
        if (featureToModify) {
          const afterFeature = this.deserializeFeature(action.afterData);
          featureToModify.setGeometry(afterFeature.getGeometry());
          featureToModify.setProperties(afterFeature.getProperties());
        }
        break;
    }

    // undo 스택에 추가
    this.undoStack.push(action);

    // 레이어 패널 갱신
    eventBus.emit(Events.LAYER_ADDED, {});
    eventBus.emit(Events.HISTORY_CHANGED, {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });

    return true;
  }

  /**
   * 히스토리 초기화
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    eventBus.emit(Events.HISTORY_CHANGED, {
      canUndo: false,
      canRedo: false
    });
  }
}

// 싱글톤 인스턴스
export const historyManager = new HistoryManager();
