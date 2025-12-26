/**
 * GeoJSONLoader - GeoJSON 파일 로더
 */

import GeoJSON from 'ol/format/GeoJSON';
import { layerManager } from '../core/LayerManager.js';

export class GeoJSONLoader {
  constructor() {
    this.format = new GeoJSON();
  }

  /**
   * File 객체로부터 GeoJSON 로드
   * @param {File} file - GeoJSON 파일
   * @returns {Promise<string>} 생성된 레이어 ID
   */
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const layerId = this.loadFromString(content, file.name);
          resolve(layerId);
        } catch (error) {
          reject(new Error('GeoJSON 파싱 실패: ' + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('파일 읽기 실패'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * GeoJSON 문자열로부터 로드
   * @param {string} geojsonStr - GeoJSON 문자열
   * @param {string} name - 레이어 이름
   * @returns {string} 생성된 레이어 ID
   */
  loadFromString(geojsonStr, name = '새 레이어') {
    // GeoJSON 파싱
    const geojsonObj = typeof geojsonStr === 'string'
      ? JSON.parse(geojsonStr)
      : geojsonStr;

    // OpenLayers Feature로 변환
    const features = this.format.readFeatures(geojsonObj, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    });

    if (features.length === 0) {
      throw new Error('GeoJSON에 피처가 없습니다.');
    }

    // 파일명에서 확장자 제거
    const layerName = name.replace(/\.(geojson|json)$/i, '');

    // 레이어 추가
    const layerId = layerManager.addLayer({
      name: layerName,
      type: 'vector',
      features: features
    });

    return layerId;
  }

  /**
   * URL로부터 GeoJSON 로드
   * @param {string} url - GeoJSON URL
   * @param {string} name - 레이어 이름
   * @returns {Promise<string>} 생성된 레이어 ID
   */
  async loadFromUrl(url, name = '새 레이어') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('GeoJSON 로드 실패: ' + response.statusText);
    }

    const geojsonStr = await response.text();
    return this.loadFromString(geojsonStr, name);
  }
}

// 싱글톤 인스턴스
export const geojsonLoader = new GeoJSONLoader();
