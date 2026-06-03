/**
 * ProjectManager - 프로젝트 저장/불러오기 관리
 */

import { layerManager } from './LayerManager.js';
import { mapManager } from './MapManager.js';
import { coordinateSystem } from './CoordinateSystem.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { demLoader } from '../loaders/DEMLoader.js';
import { rasterAnalysisTool } from '../tools/RasterAnalysisTool.js';
import GeoJSON from 'ol/format/GeoJSON';

const PROJECT_VERSION = '1.0';
const PROJECT_EXTENSION = '.egis';

// 래스터 밴드 데이터(TypedArray) 직렬화 지원
const TYPED_ARRAY_CTORS = {
  Int8Array, Uint8Array, Uint8ClampedArray,
  Int16Array, Uint16Array, Int32Array, Uint32Array,
  Float32Array, Float64Array
};

/**
 * 래스터 메타데이터 객체(demData/analysisData)를 JSON 안전한 형태로 변환한다.
 * 큰 밴드 데이터(TypedArray)는 base64로 인코딩하여 파일 크기를 줄인다.
 */
function encodeRasterMeta(rasterObj) {
  const arr = rasterObj.data;
  let encodedData;

  if (ArrayBuffer.isView(arr)) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    encodedData = { __encoding: 'base64', dtype: arr.constructor.name, base64: btoa(binary) };
  } else if (Array.isArray(arr)) {
    encodedData = { __encoding: 'array', dtype: 'Array', values: arr };
  } else {
    encodedData = { __encoding: 'array', dtype: 'Array', values: arr ? Array.from(arr) : [] };
  }

  return { ...rasterObj, data: encodedData };
}

/**
 * encodeRasterMeta로 직렬화된 객체를 원래의 demData/analysisData 형태로 복원한다.
 */
function decodeRasterMeta(encoded) {
  const result = { ...encoded };
  const d = encoded.data;

  if (d && d.__encoding === 'base64') {
    const binary = atob(d.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const Ctor = TYPED_ARRAY_CTORS[d.dtype] || Float32Array;
    result.data = new Ctor(bytes.buffer);
  } else if (d && d.__encoding === 'array') {
    result.data = d.values;
  }

  return result;
}

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
        const base = {
          id: layer.id,
          name: layer.name,
          type: layer.type || 'vector',
          geometryType: layer.geometryType,
          visible: layer.visible,
          color: layer.color,
          opacity: layer.opacity || 1
        };

        // 래스터 레이어: 벡터 source가 없으므로 demData/analysisData를 직렬화
        if (layer.type === 'raster') {
          if (layer.demData) {
            return { ...base, rasterKind: 'dem', raster: encodeRasterMeta(layer.demData) };
          }
          if (layer.analysisData) {
            return { ...base, rasterKind: 'analysis', raster: encodeRasterMeta(layer.analysisData) };
          }
          // 복원 가능한 데이터가 없는 래스터 — 메타데이터만 보존(복원 시 건너뜀)
          return { ...base, rasterKind: 'unknown' };
        }

        // 벡터 레이어: GeoJSON으로 직렬화 (source가 없으면 빈 피처)
        const features = layer.source ? layer.source.getFeatures() : [];
        const geojsonData = geojsonFormat.writeFeaturesObject(features, {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        });

        return { ...base, features: geojsonData };
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

    // 레이어가 아닌 도구 오버레이(측정·라벨·경로·등시선 등) 정리
    eventBus.emit(Events.PROJECT_NEW, {});

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
        // 래스터 레이어 복원
        if (layerData.type === 'raster') {
          let layerId = null;
          if (layerData.rasterKind === 'dem' && layerData.raster) {
            layerId = demLoader.buildDEMLayer(decodeRasterMeta(layerData.raster), layerData.name, { doFit: false });
          } else if (layerData.rasterKind === 'analysis' && layerData.raster) {
            layerId = rasterAnalysisTool.buildAnalysisLayer(decodeRasterMeta(layerData.raster), layerData.name);
          } else {
            console.warn(`래스터 레이어 "${layerData.name}"에 복원 가능한 데이터가 없어 건너뜁니다.`);
            continue;
          }

          // 가시성 복원
          if (layerData.visible === false && layerId) {
            const layerInfo = layerManager.getLayer(layerId);
            if (layerInfo) {
              layerInfo.visible = false;
              layerInfo.olLayer.setVisible(false);
            }
          }

          console.log(`래스터 레이어 "${layerData.name}" 복원됨`);
          continue;
        }

        // 벡터 레이어 복원
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
