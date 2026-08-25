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

    // 피처 합치기 (여러 개 → 하나)
    // 사용자에게는 한 동작이므로 액션도 하나로 쌓는다. 생성 1개 + 삭제 N개로 쪼개면
    // 되돌리는 도중에 합친 도형과 되살아난 원본이 같은 자리에 겹쳐 보인다.
    eventBus.on(Events.FEATURES_MERGED, ({ layerId, removed, created, createdLayer, fromHistory }) => {
      // 되돌리기·다시 실행이 화면 갱신용으로 다시 쏜 것은 기록하지 않는다 (스택이 무한히 불어난다)
      if (fromHistory) return;

      this.pushAction({
        type: 'merge',
        layerId,
        createdData: this.serializeFeature(created),
        createdId: created.ol_uid,
        // 같은 레이어에서 합쳤을 때만 원본이 사라진다. 다른 레이어끼리면 빈 배열이다
        removedFeatures: (removed || []).map((feature) => ({
          featureData: this.serializeFeature(feature),
          featureId: feature.ol_uid
        })),
        // 있으면 '결과를 새 레이어로 만든 합치기'라는 뜻이다 (이름·색은 다시 만들 때 쓴다)
        createdLayer: createdLayer || null
      });
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
   * 같은 레이어 합치기 되돌리기: 합친 피처를 빼고 원본을 전부 되살린다.
   *
   * 여기서 레이어를 지우면 안 된다. 합친 피처를 빼는 순간 피처가 0개가 되지만
   * 곧바로 원본이 채워지기 때문이다 ('create' 되돌리기는 0개가 되면 레이어를 지운다).
   */
  unmergeInLayer(layer, action) {
    const source = layer.source;

    const merged = source.getFeatures().find(f => f.ol_uid === action.createdId);
    if (merged) {
      source.removeFeature(merged);
    }

    action.removedFeatures.forEach(({ featureData, featureId }) => {
      const restored = this.deserializeFeature(featureData);
      restored.ol_uid = featureId; // UID 복원 ('delete' 되돌리기와 같은 방식)
      source.addFeature(restored);
    });

    layer.featureCount = source.getFeatures().length;
  }

  /**
   * 같은 레이어 합치기 다시 실행: 되살렸던 원본을 다시 빼고 합친 피처를 넣는다.
   */
  remergeInLayer(layer, action) {
    const source = layer.source;

    action.removedFeatures.forEach(({ featureId }) => {
      const original = source.getFeatures().find(f => f.ol_uid === featureId);
      if (original) {
        source.removeFeature(original);
      }
    });

    const merged = this.deserializeFeature(action.createdData);
    merged.ol_uid = action.createdId;
    source.addFeature(merged);

    layer.featureCount = source.getFeatures().length;
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

      case 'merge':
        if (action.createdLayer) {
          // 다른 레이어끼리 합친 경우 — 원본은 애초에 손대지 않았으니 새 레이어만 지우면 된다
          layerManager.removeLayer(action.layerId);
        } else {
          this.unmergeInLayer(layer, action);
        }
        // 열려 있는 속성 테이블도 되돌린 상태로 다시 그려야 한다 (아래 LAYER_ADDED 는 레이어 목록만 갱신한다)
        eventBus.emit(Events.FEATURES_MERGED, { layerId: action.layerId, fromHistory: true });
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

    // 다른 레이어끼리 합친 결과 레이어는 되돌리기가 통째로 지웠으므로 다시 만들어야 한다.
    // 색을 넘기지 않으면 자동 색이 잡히는데, 그 첫 색이 흰색이라 지도에서 결과가 사라진다.
    if (!layer && action.type === 'merge' && action.createdLayer) {
      const mergedFeature = this.deserializeFeature(action.createdData);
      mergedFeature.ol_uid = action.createdId;

      // 레이어 ID 는 새로 생기므로 액션에 갱신해 둔다 (다음 되돌리기가 이 레이어를 찾아야 한다)
      action.layerId = layerManager.addLayer({
        name: action.createdLayer.name,
        color: action.createdLayer.color,
        type: 'vector',
        features: [mergedFeature]
      });

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

      case 'merge':
        // 새 레이어를 만든 합치기는 위에서 레이어째 되살렸다.
        // 여기까지 왔다는 건 레이어가 안 지워졌다는 뜻이므로 결과가 이미 그대로 있다.
        if (!action.createdLayer) {
          this.remergeInLayer(layer, action);
        }
        eventBus.emit(Events.FEATURES_MERGED, { layerId: action.layerId, fromHistory: true });
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
