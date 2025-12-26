/**
 * StateManager - 애플리케이션 상태 관리 (IndexedDB + LocalStorage)
 * 새로고침 시에도 데이터가 유지되도록 로컬 저장소 관리
 */

import { eventBus, Events } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';

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
   * 레이어를 GeoJSON 형태로 저장
   */
  async saveLayer(layerInfo) {
    await this.waitForReady();

    return new Promise((resolve, reject) => {
      try {
        const features = layerInfo.source.getFeatures();
        const geoJSONFormat = new GeoJSON();

        const layerData = {
          id: layerInfo.id,
          name: layerInfo.name,
          type: layerInfo.type,
          geometryType: layerInfo.geometryType,
          color: layerInfo.color,
          strokeColor: layerInfo.strokeColor,
          fillColor: layerInfo.fillColor,
          strokeDash: layerInfo.strokeDash,
          fillOpacity: layerInfo.fillOpacity,
          strokeOpacity: layerInfo.strokeOpacity,
          strokeWidth: layerInfo.strokeWidth,
          pointRadius: layerInfo.pointRadius,
          visible: layerInfo.visible,
          features: geoJSONFormat.writeFeaturesObject(features),
          timestamp: Date.now()
        };

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
