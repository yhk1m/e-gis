/**
 * ProjectManager - 프로젝트 저장/불러오기 관리
 */

import { layerManager } from './LayerManager.js';
import { mapManager } from './MapManager.js';
import { coordinateSystem } from './CoordinateSystem.js';
import { eventBus, Events } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';

const PROJECT_VERSION = '1.0';
const PROJECT_EXTENSION = '.egis';

export class ProjectManager {
  constructor() {
    this.currentProjectName = '새 프로젝트';
    this.isDirty = false; // 변경사항 있음 표시
  }

  /**
   * 현재 프로젝트 상태를 JSON으로 직렬화
   */
  serialize() {
    const geojsonFormat = new GeoJSON();
    const layers = layerManager.getAllLayers();
    const view = mapManager.getView();

    const projectData = {
      version: PROJECT_VERSION,
      name: this.currentProjectName,
      created: new Date().toISOString(),

      // 지도 뷰 상태
      view: {
        center: mapManager.getCenter(),
        zoom: view.getZoom()
      },

      // 좌표계 설정
      displayCRS: coordinateSystem.getDisplayCRS(),

      // 레이어 데이터
      layers: layers.map(layer => {
        const features = layer.source.getFeatures();
        const geojsonData = geojsonFormat.writeFeaturesObject(features, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        });

        return {
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          color: layer.color,
          opacity: layer.opacity || 1,
          features: geojsonData
        };
      })
    };

    return projectData;
  }

  /**
   * JSON 데이터에서 프로젝트 복원
   */
  async deserialize(projectData) {
    // 버전 체크
    if (!projectData.version) {
      throw new Error('유효하지 않은 프로젝트 파일입니다.');
    }

    // 기존 레이어 모두 제거
    const existingLayers = layerManager.getAllLayers();
    existingLayers.forEach(layer => {
      layerManager.removeLayer(layer.id);
    });

    // 프로젝트 이름 설정
    this.currentProjectName = projectData.name || '불러온 프로젝트';

    // 좌표계 설정 복원
    if (projectData.displayCRS) {
      coordinateSystem.setDisplayCRS(projectData.displayCRS);
    }

    // 레이어 복원
    const geojsonFormat = new GeoJSON();

    for (const layerData of projectData.layers) {
      try {
        const features = geojsonFormat.readFeatures(layerData.features, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        });

        // 레이어 추가 (features를 직접 전달)
        const layerId = layerManager.addLayer({
          name: layerData.name,
          color: layerData.color,
          features: features,
          visible: layerData.visible !== false
        });

        console.log(`레이어 "${layerData.name}" 복원됨, 피처 수: ${features.length}`);
      } catch (error) {
        console.error(`레이어 "${layerData.name}" 복원 실패:`, error);
      }
    }

    // 지도 뷰 복원
    if (projectData.view) {
      mapManager.setCenter(projectData.view.center, false);
      mapManager.setZoom(projectData.view.zoom, false);
    }

    this.isDirty = false;
    eventBus.emit(Events.PROJECT_LOADED, { name: this.currentProjectName });

    return true;
  }

  /**
   * 프로젝트를 파일로 저장
   */
  saveToFile(filename = null) {
    const projectData = this.serialize();
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const name = filename || this.currentProjectName || '프로젝트';
    const safeName = name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');

    // 다운로드 링크 생성
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName + PROJECT_EXTENSION;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    this.isDirty = false;
    eventBus.emit(Events.PROJECT_SAVED, { name: this.currentProjectName });

    console.log('프로젝트 저장됨:', safeName + PROJECT_EXTENSION);
    return true;
  }

  /**
   * 파일에서 프로젝트 불러오기
   */
  loadFromFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = PROJECT_EXTENSION + ',.json';

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
          reject(new Error('파일이 선택되지 않았습니다.'));
          return;
        }

        try {
          const text = await file.text();
          const projectData = JSON.parse(text);

          await this.deserialize(projectData);

          // 파일명에서 프로젝트 이름 추출
          const nameWithoutExt = file.name.replace(/\.(egis|json)$/i, '');
          this.currentProjectName = nameWithoutExt;

          console.log('프로젝트 불러옴:', file.name);
          resolve(projectData);
        } catch (error) {
          console.error('프로젝트 불러오기 실패:', error);
          reject(error);
        }
      };

      input.click();
    });
  }

  /**
   * 새 프로젝트 시작
   */
  newProject() {
    // 기존 레이어 모두 제거
    const existingLayers = layerManager.getAllLayers();
    existingLayers.forEach(layer => {
      layerManager.removeLayer(layer.id);
    });

    this.currentProjectName = '새 프로젝트';
    this.isDirty = false;

    // 기본 뷰로 리셋
    mapManager.setCenter([127.5, 36.5], true);
    mapManager.setZoom(7, true);

    eventBus.emit(Events.PROJECT_NEW, {});
    console.log('새 프로젝트 생성됨');
  }

  /**
   * 현재 프로젝트 이름 반환
   */
  getProjectName() {
    return this.currentProjectName;
  }

  /**
   * 프로젝트 이름 설정
   */
  setProjectName(name) {
    this.currentProjectName = name;
    this.isDirty = true;
  }

  /**
   * 변경사항 있음 표시
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * 변경사항 있는지 확인
   */
  hasDirty() {
    return this.isDirty;
  }
}

// 싱글톤 인스턴스
export const projectManager = new ProjectManager();
