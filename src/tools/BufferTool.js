/**
 * BufferTool - 버퍼 분석 도구
 * Turf.js를 사용하여 피처 주변에 버퍼 영역 생성
 */

import * as turf from '@turf/turf';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke } from 'ol/style';

class BufferTool {
  constructor() {
    this.geoJSONFormat = new GeoJSON();
  }

  /**
   * 버퍼 생성
   * @param {string} layerId - 소스 레이어 ID
   * @param {number} distance - 버퍼 거리
   * @param {string} unit - 단위 (meters, kilometers)
   * @param {Object} options - 추가 옵션
   * @returns {Object} 결과 정보
   */
  createBuffer(layerId, distance, unit = 'meters', options = {}) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();

    if (features.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    // OpenLayers 피처를 GeoJSON으로 변환
    const geoJSONFeatures = features.map(feature => {
      return this.geoJSONFormat.writeFeatureObject(feature, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
    });

    // 버퍼 생성
    const bufferedFeatures = geoJSONFeatures.map(geoFeature => {
      try {
        const buffered = turf.buffer(geoFeature, distance, { units: unit });
        return buffered;
      } catch (error) {
        console.warn('버퍼 생성 실패:', error);
        return null;
      }
    }).filter(f => f !== null);

    if (bufferedFeatures.length === 0) {
      throw new Error('버퍼 생성에 실패했습니다.');
    }

    // FeatureCollection 생성
    const featureCollection = turf.featureCollection(bufferedFeatures);

    // 옵션에 따라 병합 또는 개별 유지
    let resultGeoJSON;
    if (options.dissolve && bufferedFeatures.length > 1) {
      try {
        // 모든 버퍼를 하나로 병합
        let dissolved = bufferedFeatures[0];
        for (let i = 1; i < bufferedFeatures.length; i++) {
          dissolved = turf.union(turf.featureCollection([dissolved, bufferedFeatures[i]]));
        }
        resultGeoJSON = turf.featureCollection([dissolved]);
      } catch (error) {
        console.warn('버퍼 병합 실패, 개별 버퍼 사용:', error);
        resultGeoJSON = featureCollection;
      }
    } else {
      resultGeoJSON = featureCollection;
    }

    // GeoJSON을 OpenLayers 피처로 변환
    const olFeatures = this.geoJSONFormat.readFeatures(resultGeoJSON, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    });

    // 새 레이어 생성 (피처를 직접 전달, 일반 폴리곤 레이어로)
    const bufferLayerName = `${layerInfo.name}_buffer_${distance}${unit === 'kilometers' ? 'km' : 'm'}`;
    const newLayerId = layerManager.addLayer({
      name: bufferLayerName,
      features: olFeatures,
      color: options.color || '#3388ff'
    });

    return {
      layerId: newLayerId,
      featureCount: olFeatures.length,
      layerName: bufferLayerName
    };
  }

  /**
   * 버퍼 스타일 생성
   */
  getBufferStyle(color, opacity) {
    return new Style({
      fill: new Fill({
        color: this.hexToRgba(color, opacity)
      }),
      stroke: new Stroke({
        color: color,
        width: 2
      })
    });
  }

  /**
   * HEX 색상을 RGBA로 변환
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 사용 가능한 단위 목록
   */
  getUnits() {
    return [
      { value: 'meters', label: '미터 (m)' },
      { value: 'kilometers', label: '킬로미터 (km)' }
    ];
  }
}

export const bufferTool = new BufferTool();
