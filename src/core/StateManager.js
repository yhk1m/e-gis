/**
 * StateManager - 애플리케이션 상태 관리 (IndexedDB + LocalStorage)
 * 새로고침 시에도 데이터가 유지되도록 로컬 저장소 관리
 */

import { eventBus, Events } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';
import { pickStyleFields } from './LayerManager.js';

const DB_NAME = 'eGIS_DB';
const DB_VERSION = 1;
const STORE_LAYERS = 'layers';
const STORE_PROJECTS = 'projects';

class StateManager {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.readyPromise = this.initDB();
  }

  /**
   * IndexedDB 초기화
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 초기화 실패:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('IndexedDB 초기화 완료');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 레이어 저장소
        if (!db.objectStoreNames.contains(STORE_LAYERS)) {
          const layerStore = db.createObjectStore(STORE_LAYERS, { keyPath: 'id' });
          layerStore.createIndex('name', 'name', { unique: false });
          layerStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 프로젝트 저장소
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('name', 'name', { unique: false });
          projectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * DB 준비 대기
   */
  async waitForReady() {
    if (this.isReady) return;
    await this.readyPromise;
  }

  // ==================== LocalStorage (설정/상태) ====================

  /**
   * 지도 상태 저장 (위치, 확대율)
   */
  saveMapState(state) {
    try {
      localStorage.setItem('eGIS_mapState', JSON.stringify({
        center: state.center,
        zoom: state.zoom,
        rotation: state.rotation || 0,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('지도 상태 저장 실패:', e);
    }
  }

  /**
   * 지도 상태 불러오기
   */
  getMapState() {
    try {
      const data = localStorage.getItem('eGIS_mapState');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('지도 상태 불러오기 실패:', e);
      return null;
    }
  }

  /**
   * 앱 설정 저장 (테마 등)
   */
  saveSettings(settings) {
    try {
      localStorage.setItem('eGIS_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('설정 저장 실패:', e);
    }
  }

  /**
   * 앱 설정 불러오기
   */
  getSettings() {
    try {
      const data = localStorage.getItem('eGIS_settings');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * 자동 저장 활성화 여부
   */
  setAutoSaveEnabled(enabled) {
    localStorage.setItem('eGIS_autoSave', enabled ? 'true' : 'false');
  }

  isAutoSaveEnabled() {
    const value = localStorage.getItem('eGIS_autoSave');
    return value !== 'false'; // 기본값 true
  }

  // ==================== IndexedDB (레이어 데이터) ====================

  /**
   * 레이어를 GeoJSON 형태로 저장 (흐름 레이어는 피처 대신 flowConfig 로)
   */
  async saveLayer(layerInfo) {
    await this.waitForReady();

    // 흐름 레이어: 피처가 없다. 좌표까지 확정된 데이터셋과 스타일을 그대로 저장한다 (ProjectManager 와 같은 규약)
    if (layerInfo.type === 'flow' && layerInfo._flowConfig) {
      const c = layerInfo._flowConfig;
      const layerData = {
        id: layerInfo.id,
        name: layerInfo.name,
        type: 'flow',
        geometryType: 'Flow',
        visible: layerInfo.visible,
        zIndex: (layerInfo.olLayer && typeof layerInfo.olLayer.getZIndex === 'function')
          ? layerInfo.olLayer.getZIndex()
          : undefined,
        flowConfig: { dataset: c.dataset, style: c.style, selectedIds: c.selectedIds || [] },
        timestamp: Date.now()
      };
      return this._putLayerRecord(layerData);
    }

    // 래스터 레이어는 저장하지 않음 (GeoJSON 변환 불가)
    if (layerInfo.type === 'raster' || !layerInfo.source) {
      return Promise.resolve(layerInfo.id);
    }

    // 레코드 조립 — 여기서 던지는 예외는 async 함수의 거부(reject)로 그대로 전달된다
    const features = layerInfo.source.getFeatures();
    const geoJSONFormat = new GeoJSON();

    // 단계구분도 설정 직렬화 (tool 참조 제외)
    let choroplethConfig = null;
    if (layerInfo._choroplethConfig) {
      const cfg = layerInfo._choroplethConfig;
      choroplethConfig = {
        attribute: cfg.attribute,
        breaks: cfg.breaks,
        colors: cfg.colors,
        title: cfg.title,
        unit: cfg.unit,
        format: cfg.format,
        rounding: cfg.rounding,
        controlsHidden: cfg.controlsHidden
      };
    }

    // 카토그램 설정 직렬화 (색상 분류 — 복원 시 색 유지)
    let cartogramConfig = null;
    if (layerInfo._cartogramConfig) {
      const c = layerInfo._cartogramConfig;
      cartogramConfig = {
        attribute: c.attribute,
        colorScheme: c.colorScheme,
        method: c.method,
        colors: c.colors,
        breaks: c.breaks,
        cartogramType: c.cartogramType
      };
    }

    // 도형표현도 설정 직렬화
    let chartMapConfig = null;
    if (layerInfo._chartMapConfig) {
      const c = layerInfo._chartMapConfig;
      chartMapConfig = {
        sourceLayerId: c.sourceLayerId,
        chartType: c.chartType,
        fields: c.fields,
        sizeField: c.sizeField,
        minSize: c.minSize,
        maxSize: c.maxSize,
        showLabels: c.showLabels,
        colors: c.colors,        // 필드별 지정 색
        showValues: c.showValues // 수치 라벨 표시
      };
    }

    // 히트맵 설정 직렬화 — 저장하지 않으면 복원 시 OL Heatmap이 아니라
    // 포인트로만 표시된다 (ProjectManager.js:165-170과 같은 규약)
    let heatmapConfig = null;
    if (layerInfo._heatmapConfig) {
      const h = layerInfo._heatmapConfig;
      heatmapConfig = {
        sourceLayerId: h.sourceLayerId,
        blur: h.blur,
        radius: h.radius,
        weight: h.weight,
        gradient: h.gradient,
        hideSource: h.hideSource
      };
    }

    const layerData = {
      id: layerInfo.id,
      name: layerInfo.name,
      type: layerInfo.type,
      geometryType: layerInfo.geometryType,
      color: layerInfo.color,
      ...pickStyleFields(layerInfo),
      visible: layerInfo.visible,
      // 화면 순서 — 복원 시 이 값으로 아래에서 위 순서를 되살린다
      zIndex: (layerInfo.olLayer && typeof layerInfo.olLayer.getZIndex === 'function')
        ? layerInfo.olLayer.getZIndex()
        : undefined,
      choroplethConfig,
      chartMapConfig,
      cartogramConfig,
      heatmapConfig,
      features: geoJSONFormat.writeFeaturesObject(features),
      timestamp: Date.now()
    };

    return this._putLayerRecord(layerData);
  }

  /**
   * 레이어 레코드 하나를 IndexedDB 에 넣는다 (벡터·흐름 공용).
   * 호출자가 waitForReady 를 마친 뒤 부른다. 트랜잭션을 열다 던지는 예외도 거부(reject)로 돌린다.
   * @returns {Promise<string>} 저장된 레코드 id
   */
  _putLayerRecord(layerData) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_LAYERS], 'readwrite');
        const store = transaction.objectStore(STORE_LAYERS);
        const request = store.put(layerData);

        request.onsuccess = () => resolve(layerData.id);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 레이어 삭제
   */
  async deleteLayer(layerId) {
    await this.waitForReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LAYERS], 'readwrite');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.delete(layerId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 모든 저장된 레이어 불러오기
   */
  async getAllLayers() {
    await this.waitForReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LAYERS], 'readonly');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 모든 레이어 삭제 (초기화)
   */
  async clearAllLayers() {
    await this.waitForReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_LAYERS], 'readwrite');
      const store = transaction.objectStore(STORE_LAYERS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== 프로젝트 (전체 상태) ====================

  /**
   * 현재 프로젝트 상태를 로컬에 저장
   */
  async saveCurrentProject(name = '자동 저장') {
    await this.waitForReady();

    const layers = await this.getAllLayers();
    const mapState = this.getMapState();

    const projectData = {
      id: 'current',
      name: name,
      mapState: mapState,
      layerOrder: layers.map(l => l.id),
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.put(projectData);

      request.onsuccess = () => resolve(projectData);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 로컬 프로젝트 불러오기
   */
  async loadCurrentProject() {
    await this.waitForReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PROJECTS], 'readonly');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 로컬 저장소 전체 초기화
   */
  async clearAll() {
    await this.clearAllLayers();
    localStorage.removeItem('eGIS_mapState');
    localStorage.removeItem('eGIS_settings');

    // 프로젝트 저장소 초기화
    await this.waitForReady();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORE_PROJECTS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 저장된 데이터 존재 여부 확인
   */
  async hasSavedData() {
    const layers = await this.getAllLayers();
    return layers.length > 0;
  }

  /**
   * 프로젝트를 JSON으로 내보내기 (파일 다운로드용)
   */
  async exportProject() {
    const layers = await this.getAllLayers();
    const mapState = this.getMapState();

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      mapState: mapState,
      layers: layers
    };
  }

  /**
   * JSON에서 프로젝트 가져오기
   */
  async importProject(projectData) {
    if (!projectData || !projectData.layers) {
      throw new Error('유효하지 않은 프로젝트 파일입니다.');
    }

    // 기존 데이터 삭제
    await this.clearAllLayers();

    // 레이어 저장
    for (const layer of projectData.layers) {
      await this.waitForReady();
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORE_LAYERS], 'readwrite');
        const store = transaction.objectStore(STORE_LAYERS);
        const request = store.put(layer);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // 지도 상태 저장
    if (projectData.mapState) {
      this.saveMapState(projectData.mapState);
    }

    return true;
  }
}

export const stateManager = new StateManager();
