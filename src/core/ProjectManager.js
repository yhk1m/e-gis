/**
 * ProjectManager - 프로젝트 저장/불러오기 관리
 */

import { layerManager } from './LayerManager.js';
import { mapManager } from './MapManager.js';
import { coordinateSystem } from './CoordinateSystem.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { demLoader } from '../loaders/DEMLoader.js';
import { rasterAnalysisTool } from '../tools/RasterAnalysisTool.js';
import { georeferenceTool } from '../tools/GeoreferenceTool.js';
import { choroplethTool } from '../tools/ChoroplethTool.js';
import { chartMapTool } from '../tools/ChartMapTool.js';
import { cartogramTool } from '../tools/CartogramTool.js';
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
          opacity: layer.opacity || 1,
          // 세부 스타일 — 화면 렌더링(updateLayerStyle)이 쓰는 필드들.
          // 저장하지 않으면 채우기/테두리 색 등 사용자가 지정한 스타일이 .egis에서 사라진다
          // (e-GIStory 불러오기·프로젝트 재열기 모두). undefined면 JSON에서 자동 생략.
          strokeColor: layer.strokeColor,
          fillColor: layer.fillColor,
          fillOpacity: layer.fillOpacity,
          strokeOpacity: layer.strokeOpacity,
          strokeWidth: layer.strokeWidth,
          strokeDash: layer.strokeDash,
          pointRadius: layer.pointRadius
        };

        // 래스터 레이어: 벡터 source가 없으므로 demData/analysisData를 직렬화
        if (layer.type === 'raster') {
          if (layer.demData) {
            return { ...base, rasterKind: 'dem', raster: encodeRasterMeta(layer.demData) };
          }
          if (layer.analysisData) {
            return { ...base, rasterKind: 'analysis', raster: encodeRasterMeta(layer.analysisData) };
          }
          if (layer.georefData) {
            return { ...base, rasterKind: 'georef', georef: layer.georefData };
          }
          // 복원 가능한 데이터가 없는 래스터 — 메타데이터만 보존(복원 시 건너뜀)
          return { ...base, rasterKind: 'unknown' };
        }

        // 주제도 설정 — 자동저장(StateManager.saveLayer)과 동일 규약으로 .egis에도 왕복.
        // 저장하지 않으면 단계구분도 색·도형표현도(오버레이라 피처가 비어 있음)가 복원 불가.
        if (layer._choroplethConfig) {
          const cfg = layer._choroplethConfig;
          base.choroplethConfig = {
            attribute: cfg.attribute, breaks: cfg.breaks, colors: cfg.colors,
            title: cfg.title, unit: cfg.unit, format: cfg.format,
            rounding: cfg.rounding, controlsHidden: cfg.controlsHidden
          };
        }
        if (layer._chartMapConfig) {
          const c = layer._chartMapConfig;
          base.chartMapConfig = {
            sourceLayerId: c.sourceLayerId, chartType: c.chartType, fields: c.fields,
            sizeField: c.sizeField, minSize: c.minSize, maxSize: c.maxSize, showLabels: c.showLabels
          };
        }
        if (layer._cartogramConfig) {
          const c = layer._cartogramConfig;
          base.cartogramConfig = {
            attribute: c.attribute, colorScheme: c.colorScheme, method: c.method,
            colors: c.colors, breaks: c.breaks, showLabels: c.showLabels, cartogramType: c.cartogramType
          };
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

    // 레이어 복원 — 도형표현도(chartmap)는 원본 레이어가 먼저 있어야 하므로 마지막에
    // (AutoSaveManager.restoreState와 동일 규약)
    const geojsonFormat = new GeoJSON();
    const orderedLayers = [...projectData.layers].sort((a, b) => {
      const ax = a.type === 'chartmap' ? 1 : 0;
      const bx = b.type === 'chartmap' ? 1 : 0;
      return ax - bx;
    });

    for (const layerData of orderedLayers) {
      try {
        // 래스터 레이어 복원
        if (layerData.type === 'raster') {
          let layerId = null;
          if (layerData.rasterKind === 'dem' && layerData.raster) {
            layerId = demLoader.buildDEMLayer(decodeRasterMeta(layerData.raster), layerData.name, { doFit: false });
          } else if (layerData.rasterKind === 'analysis' && layerData.raster) {
            layerId = rasterAnalysisTool.buildAnalysisLayer(decodeRasterMeta(layerData.raster), layerData.name);
          } else if (layerData.rasterKind === 'georef' && layerData.georef) {
            layerId = await georeferenceTool.restoreGeoref(layerData.georef, layerData.name);
            if (!layerId) {
              console.warn(`지리참조 레이어 "${layerData.name}" 복원 실패, 건너뜁니다.`);
              continue;
            }
          } else {
            console.warn(`래스터 레이어 "${layerData.name}"에 복원 가능한 데이터가 없어 건너뜁니다.`);
            continue;
          }

          // 가시성·불투명도 복원
          if (layerId) {
            const layerInfo = layerManager.getLayer(layerId);
            if (layerInfo) {
              if (layerData.visible === false) {
                layerInfo.visible = false;
                layerInfo.olLayer.setVisible(false);
              }
              if (typeof layerData.opacity === 'number' &&
                  typeof layerInfo.olLayer.setOpacity === 'function') {
                layerInfo.opacity = layerData.opacity;
                layerInfo.olLayer.setOpacity(layerData.opacity);
              }
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

        // 레이어 추가 — id를 보존해야 chartMapConfig.sourceLayerId 참조가 살아난다
        // (기존 레이어는 위에서 전부 제거했으므로 충돌 없음)
        const layerId = layerManager.addLayer({
          id: layerData.id,
          name: layerData.name,
          type: layerData.type || 'vector',
          geometryType: layerData.geometryType,
          color: layerData.color,
          features: features,
          visible: layerData.visible !== false
        });

        // 세부 스타일 복원 — 저장된 필드를 layerInfo에 반영하고, addLayer 기본값과
        // 다른 것이 있을 때만 스타일 재계산(손대지 않은 레이어는 초기 스타일 유지 —
        // 점의 흰 테두리 등 createStyle 모양이 재열기로 바뀌지 않게).
        const styleFields = ['strokeColor', 'fillColor', 'fillOpacity', 'strokeOpacity', 'strokeWidth', 'strokeDash', 'pointRadius'];
        const layerInfo = layerManager.getLayer(layerId);
        if (layerInfo) {
          const customized = styleFields.some(k => layerData[k] !== undefined && layerData[k] !== layerInfo[k]);
          styleFields.forEach(k => { if (layerData[k] !== undefined) layerInfo[k] = layerData[k]; });

          // 단계구분도 복원 — 분류 설정 + 스타일 함수 + 범례 (AutoSaveManager.restoreLayer 규약)
          if (layerData.type === 'choropleth' && layerData.choroplethConfig) {
            layerInfo._choroplethConfig = { ...layerData.choroplethConfig, tool: choroplethTool };
            choroplethTool.sourceByDerived.set(layerId, null);
            choroplethTool.createLegend(
              layerId,
              layerData.name.replace(/_단계구분_.*$/, ''),
              layerData.choroplethConfig.attribute,
              layerData.choroplethConfig.breaks,
              layerData.choroplethConfig.colors
            );
            layerManager.updateLayerStyle(layerId); // 분류색 스타일 함수 적용
          } else if (layerData.type === 'chartmap' && layerData.chartMapConfig) {
            // 도형표현도 복원 — 원본 레이어(id 보존됨) 기준으로 차트 오버레이·범례 재생성
            const cfg = layerData.chartMapConfig;
            chartMapTool.restoreChartMap(layerId, cfg.sourceLayerId, cfg);
          } else if (layerData.cartogramConfig) {
            // 카토그램 색상 스타일 복원
            layerInfo._cartogramConfig = { ...layerData.cartogramConfig };
            cartogramTool.applyCartogramStyle(layerId);
          } else if (customized) {
            layerManager.updateLayerStyle(layerId);
          }
        }

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
