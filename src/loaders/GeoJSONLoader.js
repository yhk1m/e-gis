/**
 * GeoJSONLoader - GeoJSON 파일 로더
 */

import GeoJSON from 'ol/format/GeoJSON';
import { layerManager } from '../core/LayerManager.js';
import { resolveSourceCrs } from '../core/crsResolver.js';
import { sampleCoordsFromGeoJSON } from '../core/CrsDetector.js';

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

      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const layerId = await this.loadFromString(content, file.name);
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
   *
   * 좌표계를 판정해 3857로 변환한다. 애매하면 확인 창이 뜨므로 비동기다.
   * 호출자는 loadFromFile·loadFromUrl 둘뿐이고 이미 비동기다.
   *
   * @param {string|Object} geojsonStr - GeoJSON 문자열 또는 객체
   * @param {string} name - 레이어 이름
   * @returns {Promise<string|null>} 레이어 ID, 사용자가 좌표계 선택을 취소하면 null
   */
  async loadFromString(geojsonStr, name = '새 레이어') {
    const geojsonObj = typeof geojsonStr === 'string'
      ? JSON.parse(geojsonStr)
      : geojsonStr;

    const { crs, cancelled } = await resolveSourceCrs(
      {
        // crs 멤버는 2016년 규격에서 빠졌지만 국내 공공데이터에는 아직 흔하다
        geojsonCrs: geojsonObj.crs,
        sampleCoords: sampleCoordsFromGeoJSON(geojsonObj)
      },
      { name, previewGeoJSON: geojsonObj }
    );
    if (cancelled) return null;

    const features = this.format.readFeatures(geojsonObj, {
      dataProjection: crs,
      featureProjection: 'EPSG:3857'
    });

    if (features.length === 0) {
      throw new Error('GeoJSON에 피처가 없습니다.');
    }

    const layerName = name.replace(/\.(geojson|json)$/i, '');

    return layerManager.addLayer({
      name: layerName,
      type: 'vector',
      features: features,
      sourceCrs: crs
    });
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
    return await this.loadFromString(geojsonStr, name);
  }
}

// 싱글톤 인스턴스
export const geojsonLoader = new GeoJSONLoader();
