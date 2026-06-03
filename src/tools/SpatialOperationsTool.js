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
   * 폴리곤 내 포인트 추출(공간 결합) - 폴리곤 안에 들어가는 포인트만 남기고,
   * 각 포인트에 포함하는 폴리곤의 속성을 poly_ 접두사로 태그한다.
   * @param {string} polygonLayerId - 폴리곤 레이어 ID
   * @param {string} pointLayerId - 포인트 레이어 ID
   * @returns {Object} 결과 정보
   */
  pointsInPolygons(polygonLayerId, pointLayerId) {
    const polygonLayer = layerManager.getLayer(polygonLayerId);
    const pointLayer = layerManager.getLayer(pointLayerId);

    if (!polygonLayer || !pointLayer) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const polygons = this.getGeoJSONFeatures(polygonLayer);
    const pointFeatures = this.getGeoJSONFeatures(pointLayer);

    if (polygons.length === 0) {
      throw new Error('폴리곤 레이어에 피처가 없습니다.');
    }
    if (pointFeatures.length === 0) {
      throw new Error('포인트 레이어에 피처가 없습니다.');
    }

    const results = [];

    for (const point of pointFeatures) {
      const geom = point.geometry;
      if (!geom) continue;

      // 포함하는 첫 번째 폴리곤 찾기 (겹치면 먼저 만나는 폴리곤에 귀속)
      const matchIndex = polygons.findIndex(polygon =>
        this.pointGeomInPolygon(geom, polygon)
      );

      if (matchIndex === -1) continue; // 어떤 폴리곤에도 속하지 않으면 제외

      // 원본 포인트를 깊은 복제하고 폴리곤 정보 태그
      const clone = JSON.parse(JSON.stringify(point));
      if (!clone.properties) clone.properties = {};

      clone.properties.poly_index = matchIndex;
      const polyProps = polygons[matchIndex].properties || {};
      for (const [key, value] of Object.entries(polyProps)) {
        clone.properties['poly_' + key] = value;
      }

      results.push(clone);
    }

    if (results.length === 0) {
      throw new Error('어떤 폴리곤에도 포함된 포인트가 없습니다.');
    }

    const result = this.createResultLayer(
      results,
      `${pointLayer.name}_폴리곤내`,
      '#a855f7'
    );

    return {
      ...result,
      totalPoints: pointFeatures.length,
      insidePoints: results.length
    };
  }

  /**
   * 포인트 지오메트리(Point/MultiPoint)가 폴리곤 안에 있는지 검사.
   * MultiPoint는 한 점이라도 들어가면 포함으로 간주.
   */
  pointGeomInPolygon(geom, polygon) {
    try {
      if (geom.type === 'Point') {
        return turf.booleanPointInPolygon(geom.coordinates, polygon);
      }
      if (geom.type === 'MultiPoint') {
        return geom.coordinates.some(c => turf.booleanPointInPolygon(c, polygon));
      }
    } catch (e) {
      // 잘못된 지오메트리는 미포함 처리
    }
    return false;
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
   * 포인트 레이어 목록 가져오기
   */
  getPointLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.geometryType === 'Point' ||
             layer.geometryType === 'MultiPoint';
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
      { value: 'clip', label: '클리핑 (Clip)', description: '클립 영역으로 자르기' },
      { value: 'pointsInPolygon', label: '포인트 추출 (Points in Polygon)', description: '폴리곤 안의 포인트만 남기고 폴리곤 정보를 태그' }
    ];
  }
}

export const spatialOperationsTool = new SpatialOperationsTool();
