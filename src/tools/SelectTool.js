/**
 * SelectTool - 피처 선택 및 수정 도구
 */

import Select from 'ol/interaction/Select';
import Modify from 'ol/interaction/Modify';
import { click, platformModifierKeyOnly } from 'ol/events/condition';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

// 선택 스타일
const SELECT_STYLE = new Style({
  fill: new Fill({
    color: 'rgba(255, 193, 7, 0.3)'
  }),
  stroke: new Stroke({
    color: '#ffc107',
    width: 3
  }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#ffc107' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 })
  })
});

class SelectTool {
  constructor() {
    this.map = null;
    this.select = null;
    this.modify = null;
    this.isActive = false;
    this.selectedFeatures = null;
  }

  /**
   * 초기화
   */
  init() {
    this.map = mapManager.getMap();
  }

  /**
   * 선택 도구 활성화
   * @param {Object} options - 옵션
   */
  activate(options = {}) {
    if (!this.map) this.init();

    const { enableModify = true } = options;

    // 기존 인터랙션 제거
    this.deactivate();

    // Select 인터랙션 생성
    this.select = new Select({
      condition: click,
      style: SELECT_STYLE,
      // 배경지도 레이어 제외
      filter: (feature, layer) => {
        if (!layer) return false;
        const props = layer.getProperties();
        return props.type !== 'base';
      }
    });

    this.selectedFeatures = this.select.getFeatures();

    // 선택 변경 이벤트
    this.select.on('select', (event) => {
      this.handleSelect(event);
    });

    this.map.addInteraction(this.select);

    // Modify 인터랙션 추가 (수정 모드)
    if (enableModify) {
      this.modify = new Modify({
        features: this.selectedFeatures,
        // Shift 키를 누르고 꼭짓점 클릭 시 삭제
        deleteCondition: (event) => {
          return platformModifierKeyOnly(event) && click(event);
        }
      });

      this.modify.on('modifystart', (event) => {
        this.handleModifyStart(event);
      });

      this.modify.on('modifyend', (event) => {
        this.handleModifyEnd(event);
      });

      this.map.addInteraction(this.modify);
    }

    this.isActive = true;

    // 상태 메시지
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = '피처를 클릭하여 선택하세요';
    }

    // 키보드 이벤트 등록 (Delete 키로 삭제)
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);

    eventBus.emit(Events.TOOL_ACTIVATED, { tool: 'select' });
  }

  /**
   * 선택 이벤트 처리
   */
  handleSelect(event) {
    const selected = event.selected;
    const deselected = event.deselected;

    if (selected.length > 0) {
      const feature = selected[0];
      const geometry = feature.getGeometry();

      eventBus.emit(Events.FEATURE_SELECTED, {
        feature,
        geometryType: geometry.getType()
      });

      // 상태 메시지 업데이트
      const statusEl = document.getElementById('status-message');
      if (statusEl) {
        statusEl.textContent = `선택됨 (Delete로 삭제, 꼭짓점 드래그로 수정)`;
      }
    }

    if (deselected.length > 0) {
      eventBus.emit(Events.FEATURE_DESELECTED, {
        features: deselected
      });

      if (selected.length === 0) {
        const statusEl = document.getElementById('status-message');
        if (statusEl) {
          statusEl.textContent = '피처를 클릭하여 선택하세요';
        }
      }
    }
  }

  /**
   * 수정 완료 이벤트 처리
   */
  /**
   * 수정 시작 이벤트 처리
   */
  handleModifyStart(event) {
    const features = event.features.getArray();
    features.forEach(feature => {
      // 수정할 피처가 속한 레이어 찾기
      const layers = layerManager.getAllLayers();
      for (const layerInfo of layers) {
        if (layerInfo.source.hasFeature(feature)) {
          eventBus.emit(Events.FEATURE_MODIFY_START, {
            feature,
            layerId: layerInfo.id
          });
          break;
        }
      }
    });
  }

  /**
   * 수정 완료 이벤트 처리
   */
  handleModifyEnd(event) {
    const features = event.features.getArray();

    features.forEach(feature => {
      eventBus.emit(Events.FEATURE_MODIFIED, { feature });
    });

    // 상태 메시지
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = '도형이 수정되었습니다';
      setTimeout(() => {
        statusEl.textContent = '피처를 클릭하여 선택하세요';
      }, 2000);
    }
  }

  /**
   * 키보드 이벤트 처리
   */
  handleKeyDown(event) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.deleteSelectedFeatures();
    } else if (event.key === 'Escape') {
      this.clearSelection();
    }
  }

  /**
   * 선택된 피처 삭제
   */
  deleteSelectedFeatures() {
    if (!this.selectedFeatures || this.selectedFeatures.getLength() === 0) {
      return;
    }

    const features = this.selectedFeatures.getArray().slice();

    features.forEach(feature => {
      // 해당 피처가 속한 레이어 찾기
      const layers = layerManager.getAllLayers();

      for (const layerInfo of layers) {
        const source = layerInfo.source;
        if (source.hasFeature(feature)) {
          source.removeFeature(feature);

          // 레이어의 피처 개수 업데이트
          layerInfo.featureCount = source.getFeatures().length;

          // 피처가 0개면 레이어 삭제 확인
          if (layerInfo.featureCount === 0) {
            if (confirm(`"${layerInfo.name}" 레이어에 피처가 없습니다. 레이어를 삭제할까요?`)) {
              layerManager.removeLayer(layerInfo.id);
            }
          }

          eventBus.emit(Events.FEATURE_DELETED, {
            feature,
            layerId: layerInfo.id
          });
          break;
        }
      }
    });

    // 선택 해제
    this.selectedFeatures.clear();

    // 상태 메시지
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = '삭제되었습니다';
      setTimeout(() => {
        statusEl.textContent = '피처를 클릭하여 선택하세요';
      }, 2000);
    }

    // 레이어 패널 갱신
    eventBus.emit(Events.LAYER_ADDED, {});
  }

  /**
   * 선택 해제
   */
  clearSelection() {
    if (this.selectedFeatures) {
      this.selectedFeatures.clear();
    }

    eventBus.emit(Events.FEATURE_DESELECTED, { features: [] });
  }

  /**
   * 선택 도구 비활성화
   */
  deactivate() {
    if (this.select) {
      this.map.removeInteraction(this.select);
      this.select = null;
    }

    if (this.modify) {
      this.map.removeInteraction(this.modify);
      this.modify = null;
    }

    this.selectedFeatures = null;
    this.isActive = false;

    // 키보드 이벤트 해제
    document.removeEventListener('keydown', this.handleKeyDown);

    // 상태 메시지 초기화
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = '준비';
    }

    eventBus.emit(Events.TOOL_DEACTIVATED, { tool: 'select' });
  }

  /**
   * 현재 활성화 상태 확인
   */
  getIsActive() {
    return this.isActive;
  }

  /**
   * 선택된 피처 반환
   */
  getSelectedFeatures() {
    return this.selectedFeatures ? this.selectedFeatures.getArray() : [];
  }


  /**
   * 선택된 피처 삭제 (alias)
   */
  deleteSelected() {
    this.deleteSelectedFeatures();
  }

  /**
   * 현재 레이어의 모든 피처 선택
   */
  selectAll() {
    const selectedLayerId = layerManager.getSelectedLayerId();
    if (!selectedLayerId) {
      console.warn('레이어를 먼저 선택하세요');
      return;
    }

    const layerInfo = layerManager.getLayer(selectedLayerId);
    if (!layerInfo) return;

    // 선택 도구 활성화
    if (!this.isActive) {
      this.activate();
    }

    // 모든 피처 선택
    const features = layerInfo.source.getFeatures();
    if (this.selectedFeatures) {
      this.selectedFeatures.clear();
      features.forEach(feature => {
        this.selectedFeatures.push(feature);
      });
    }

    eventBus.emit(Events.FEATURE_SELECTED, {
      features: features,
      count: features.length
    });
  }
}

// 싱글톤 인스턴스
export const selectTool = new SelectTool();
