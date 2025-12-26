/**
 * SpatialOperationsTool - 공간 연산 도구
 * Turf.js를 사용하여 Intersect, Union, Difference 연산 수행
 */

import * as turf from '@turf/turf';
import { layerManager } from '../core/LayerManager.js';
import { eventBus } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';

class SpatialOperationsTool {
  constructor() {
    this.geoJSONFormat = new GeoJSON();
  }

  /**
   * 두 레이어 간 교차(Intersect) 연산
   * @param {string} layerId1 - 첫 번째 레이어 ID
   * @param {string} layerId2 - 두 번째 레이어 ID
   * @returns {Object} 결과 정보
   */
  intersect(layerId1, layerId2) {
    const layer1 = layerManager.getLayer(layerId1);
    const layer2 = layerManager.getLayer(layerId2);

    if (!layer1 || !layer2) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const features1 = this.getGeoJSONFeatures(layer1);
    const features2 = this.getGeoJSONFeatures(layer2);

    if (features1.length === 0 || features2.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    const results = [];

    for (const f1 of features1) {
      for (const f2 of features2) {
        try {
          const intersection = turf.intersect(
            turf.featureCollection([f1, f2])
          );
          if (intersection) {
            results.push(intersection);
          }
        } catch (e) {
          console.warn('교차 연산 실패:', e);
        }
      }
    }

    if (results.length === 0) {
      throw new Error('교차하는 영역이 없습니다.');
    }

    return this.createResultLayer(results, `${layer1.name}_∩_${layer2.name}`, '#22c55e');
  }

  /**
   * 두 레이어 간 합집합(Union) 연산
   * @param {string} layerId1 - 첫 번째 레이어 ID
   * @param {string} layerId2 - 두 번째 레이어 ID
   * @returns {Object} 결과 정보
   */
  union(layerId1, layerId2) {
    const layer1 = layerManager.getLayer(layerId1);
    const layer2 = layerManager.getLayer(layerId2);

    if (!layer1 || !layer2) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const features1 = this.getGeoJSONFeatures(layer1);
    const features2 = this.getGeoJSONFeatures(layer2);

    if (features1.length === 0 || features2.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    // 모든 피처 병합
    const allFeatures = [...features1, ...features2];

    let result = allFeatures[0];
    for (let i = 1; i < allFeatures.length; i++) {
      try {
        result = turf.union(turf.featureCollection([result, allFeatures[i]]));
      } catch (e) {
        console.warn('합집합 연산 실패:', e);
      }
    }

    if (!result) {
      throw new Error('합집합 연산에 실패했습니다.');
    }

    return this.createResultLayer([result], `${layer1.name}_∪_${layer2.name}`, '#3b82f6');
  }

  /**
   * 차집합(Difference) 연산 - 첫 번째 레이어에서 두 번째 레이어 영역 제거
   * @param {string} layerId1 - 첫 번째 레이어 ID (유지할 레이어)
   * @param {string} layerId2 - 두 번째 레이어 ID (제거할 레이어)
   * @returns {Object} 결과 정보
   */
  difference(layerId1, layerId2) {
    const layer1 = layerManager.getLayer(layerId1);
    const layer2 = layerManager.getLayer(layerId2);

    if (!layer1 || !layer2) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const features1 = this.getGeoJSONFeatures(layer1);
    const features2 = this.getGeoJSONFeatures(layer2);

    if (features1.length === 0 || features2.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    const results = [];

    for (const f1 of features1) {
      let current = f1;
      for (const f2 of features2) {
        try {
          const diff = turf.difference(turf.featureCollection([current, f2]));
          if (diff) {
            current = diff;
          }
        } catch (e) {
          console.warn('차집합 연산 실패:', e);
        }
      }
      if (current) {
        results.push(current);
      }
    }

    if (results.length === 0) {
      throw new Error('차집합 연산에 실패했습니다.');
    }

    return this.createResultLayer(results, `${layer1.name}_−_${layer2.name}`, '#ef4444');
  }

  /**
   * 클리핑(Clip) - 첫 번째 레이어를 두 번째 레이어 범위로 자르기
   * @param {string} inputLayerId - 자를 레이어 ID
   * @param {string} clipLayerId - 클리핑 영역 레이어 ID
   * @returns {Object} 결과 정보
   */
  clip(inputLayerId, clipLayerId) {
    // Intersect와 동일하게 작동
    return this.intersect(inputLayerId, clipLayerId);
  }

  /**
   * 레이어의 피처를 GeoJSON으로 변환
   */
  getGeoJSONFeatures(layerInfo) {
    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();

    return features.map(feature => {
      return this.geoJSONFormat.writeFeatureObject(feature, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });
    });
  }

  /**
   * 결과 레이어 생성
   */
  createResultLayer(geoJSONFeatures, layerName, color) {
    const featureCollection = turf.featureCollection(geoJSONFeatures);

    const olFeatures = this.geoJSONFormat.readFeatures(featureCollection, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    });

    const newLayerId = layerManager.addLayer({
      name: layerName,
      features: olFeatures,
      color: color
    });

    return {
      layerId: newLayerId,
      featureCount: olFeatures.length,
      layerName: layerName
    };
  }

  /**
   * 폴리곤 레이어 목록 가져오기
   */
  getPolygonLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.geometryType === 'Polygon' ||
             layer.geometryType === 'MultiPolygon';
    });
  }

  /**
   * 사용 가능한 연산 목록
   */
  getOperations() {
    return [
      { value: 'intersect', label: '교차 (Intersect)', description: '두 레이어가 겹치는 영역' },
      { value: 'union', label: '합집합 (Union)', description: '두 레이어를 하나로 합침' },
      { value: 'difference', label: '차집합 (Difference)', description: '첫 번째 레이어에서 두 번째 제거' },
      { value: 'clip', label: '클리핑 (Clip)', description: '클립 영역으로 자르기' }
    ];
  }
}

export const spatialOperationsTool = new SpatialOperationsTool();
