/**
 * AutoSaveManager - 자동 저장 및 복원 관리
 */

import { stateManager } from './StateManager.js';
import { layerManager } from './LayerManager.js';
import { mapManager } from './MapManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';
import VectorSource from 'ol/source/Vector';

class AutoSaveManager {
  constructor() {
    this.saveTimeout = null;
    this.mapSaveTimeout = null;
    this.isRestoring = false;
    this.geoJSON = new GeoJSON();
    this.initialized = false;
  }

  /**
   * 초기화 - 이벤트 리스너 등록 및 저장된 상태 복원
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // 이벤트 리스너 등록
    this.bindEvents();

    // 저장된 데이터가 있는지 확인
    const hasSaved = await stateManager.hasSavedData();
    if (hasSaved) {
      // 복원 여부 확인
      const shouldRestore = await this.promptRestore();
      if (shouldRestore) {
        await this.restoreState();
      } else {
        // 복원하지 않으면 저장 데이터 삭제
        await stateManager.clearAllLayers();
      }
    }

    // 페이지 종료 시 경고 (저장되지 않은 변경사항이 있을 때)
    window.addEventListener('beforeunload', (e) => {
      if (layerManager.getLayerCount() > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    console.log('AutoSaveManager 초기화 완료');
  }

  /**
   * 복원 여부 확인 다이얼로그
   */
  async promptRestore() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay restore-modal active';
      modal.innerHTML = `
        <div class="modal-content restore-content">
          <div class="modal-header">
            <h3>이전 작업 복원</h3>
          </div>
          <div class="modal-body">
            <p>이전에 작업하던 프로젝트가 있습니다.<br>복원하시겠습니까?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="restore-no">새로 시작</button>
            <button class="btn btn-primary" id="restore-yes">복원하기</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('restore-yes').onclick = () => {
        modal.remove();
        resolve(true);
      };

      document.getElementById('restore-no').onclick = () => {
        modal.remove();
        resolve(false);
      };
    });
  }

  /**
   * 이벤트 리스너 바인딩
   */
  bindEvents() {
    // 레이어 추가 시 저장
    eventBus.on(Events.LAYER_ADDED, (data) => {
      if (!this.isRestoring && data.layer) {
        this.scheduleSave(data.layer.id);
      }
    });

    // 레이어 삭제 시 저장소에서도 삭제
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      if (!this.isRestoring) {
        stateManager.deleteLayer(data.layerId);
      }
    });

    // 레이어 스타일 변경 시 저장
    eventBus.on(Events.LAYER_STYLE_CHANGED, (data) => {
      if (!this.isRestoring) {
        this.scheduleSave(data.layerId);
      }
    });

    // 레이어 가시성 변경 시 저장
    eventBus.on(Events.LAYER_VISIBILITY_CHANGED, (data) => {
      if (!this.isRestoring) {
        this.scheduleSave(data.layerId);
      }
    });

    // 지도 이동/확대 시 저장 (디바운스)
    eventBus.on(Events.MAP_MOVEEND, () => {
      if (!this.isRestoring) {
        this.scheduleMapStateSave();
      }
    });
  }

  /**
   * 레이어 저장 스케줄 (디바운스)
   */
  scheduleSave(layerId) {
    if (!stateManager.isAutoSaveEnabled()) return;

    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        const layerInfo = layerManager.getLayer(layerId);
        if (layerInfo) {
          await stateManager.saveLayer(layerInfo);
          console.log(`레이어 저장됨: ${layerInfo.name}`);
        }
      } catch (e) {
        console.error('레이어 저장 실패:', e);
      }
    }, 1000); // 1초 디바운스
  }

  /**
   * 지도 상태 저장 스케줄 (디바운스)
   */
  scheduleMapStateSave() {
    if (!stateManager.isAutoSaveEnabled()) return;

    clearTimeout(this.mapSaveTimeout);
    this.mapSaveTimeout = setTimeout(() => {
      const map = mapManager.getMap();
      if (map) {
        const view = map.getView();
        stateManager.saveMapState({
          center: view.getCenter(),
          zoom: view.getZoom(),
          rotation: view.getRotation()
        });
      }
    }, 2000); // 2초 디바운스
  }

  /**
   * 저장된 상태 복원
   */
  async restoreState() {
    this.isRestoring = true;

    try {
      // 지도 상태 복원
      const mapState = stateManager.getMapState();
      if (mapState) {
        const map = mapManager.getMap();
        if (map) {
          const view = map.getView();
          view.setCenter(mapState.center);
          view.setZoom(mapState.zoom);
          if (mapState.rotation) {
            view.setRotation(mapState.rotation);
          }
        }
      }

      // 레이어 복원
      const savedLayers = await stateManager.getAllLayers();
      console.log(`${savedLayers.length}개 레이어 복원 중...`);

      for (const layerData of savedLayers) {
        try {
          await this.restoreLayer(layerData);
        } catch (e) {
          console.error(`레이어 복원 실패 (${layerData.name}):`, e);
        }
      }

      console.log('상태 복원 완료');
    } catch (e) {
      console.error('상태 복원 실패:', e);
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * 단일 레이어 복원
   */
  async restoreLayer(layerData) {
    // GeoJSON에서 피처 파싱
    const features = this.geoJSON.readFeatures(layerData.features);

    // VectorSource 생성
    const source = new VectorSource({ features });

    // 레이어 추가
    const layerId = layerManager.addLayer({
      name: layerData.name,
      type: layerData.type || 'vector',
      source: source,
      visible: layerData.visible,
      color: layerData.color,
      geometryType: layerData.geometryType
    });

    // 스타일 복원
    const restoredLayer = layerManager.getLayer(layerId);
    if (restoredLayer) {
      restoredLayer.strokeColor = layerData.strokeColor;
      restoredLayer.fillColor = layerData.fillColor;
      restoredLayer.strokeDash = layerData.strokeDash;
      restoredLayer.fillOpacity = layerData.fillOpacity;
      restoredLayer.strokeOpacity = layerData.strokeOpacity;
      restoredLayer.strokeWidth = layerData.strokeWidth;
      restoredLayer.pointRadius = layerData.pointRadius;

      // 스타일 적용
      layerManager.updateLayerStyle(layerId);
    }

    return layerId;
  }

  /**
   * 현재 모든 레이어 강제 저장
   */
  async saveAllLayers() {
    const layers = layerManager.getAllLayers();
    for (const layer of layers) {
      try {
        await stateManager.saveLayer(layer);
      } catch (e) {
        console.error(`레이어 저장 실패 (${layer.name}):`, e);
      }
    }
    console.log(`${layers.length}개 레이어 저장 완료`);
  }

  /**
   * 프로젝트 파일로 내보내기
   */
  async exportToFile() {
    await this.saveAllLayers();
    const projectData = await stateManager.exportProject();

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `e-GIS_project_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 프로젝트 파일에서 가져오기
   */
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const projectData = JSON.parse(e.target.result);
          await stateManager.importProject(projectData);

          // 페이지 새로고침하여 복원
          window.location.reload();
          resolve();
        } catch (err) {
          reject(new Error('프로젝트 파일을 읽을 수 없습니다.'));
        }
      };

      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file);
    });
  }
}

export const autoSaveManager = new AutoSaveManager();
