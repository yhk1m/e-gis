/**
 * SpatialOperationsTool - 공간 연산 도구
 * Turf.js를 사용하여 Intersect, Union, Difference 연산 수행
 */

import * as turf from '@turf/turf';
import { layerManager } from '../core/LayerManager.js';
import { eventBus } from '../utils/EventBus.js';
import GeoJSON from 'ol/format/GeoJSON';
import { mergeProperties, withTag } from './spatialAttributes.js';

class SpatialOperationsTool {
  constructor() {
    this.geoJSONFormat = new GeoJSON();
  }

  /**
   * 두 레이어 간 교차(Intersect) 연산
   * @param {string} layerId1 - 첫 번째 레이어 ID
   * @param {string} layerId2 - 두 번째 레이어 ID
   * @param {Object} [options]
   * @param {boolean} [options.keepFeatures=false] true면 자르지 않고 겹치는 피처를 통째로 남긴다
   * @returns {Object} 결과 정보
   */
  intersect(layerId1, layerId2, options = {}) {
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

    const results = options.keepFeatures
      ? this.keepOverlapping(features1, features2)
      : this.clipOverlapping(features1, features2);

    if (results.length === 0) {
      throw new Error('겹치는 영역이 없습니다.');
    }

    const separator = options.keepFeatures ? '_겹침_' : '_∩_';
    return this.createResultLayer(
      results,
      `${layer1.name}${separator}${layer2.name}`,
      '#22c55e'
    );
  }

  /**
   * 겹치는 부분만 잘라낸다. 결과 피처는 양쪽 레이어 속성을 모두 승계한다.
   */
  clipOverlapping(features1, features2) {
    const boxes2 = features2.map(f => this.safeBbox(f));
    const results = [];

    for (const f1 of features1) {
      const box1 = this.safeBbox(f1);
      for (let i = 0; i < features2.length; i++) {
        // 경계 상자가 안 겹치면 교차도 없다 (무거운 turf.intersect 호출을 아낀다)
        if (!this.bboxOverlaps(box1, boxes2[i])) continue;

        try {
          const intersection = turf.intersect(turf.featureCollection([f1, features2[i]]), {
            properties: mergeProperties(f1.properties, features2[i].properties)
          });
          if (intersection) results.push(intersection);
        } catch (e) {
          console.warn('교차 연산 실패:', e);
        }
      }
    }

    return results;
  }

  /**
   * 자르지 않고, 레이어2와 겹치는 레이어1 피처를 원본 지오메트리 그대로 남긴다.
   * 겹친 상대가 여럿이면 가장 넓게 겹친 피처의 속성을 승계한다.
   */
  keepOverlapping(features1, features2) {
    const boxes2 = features2.map(f => this.safeBbox(f));
    const results = [];

    for (const f1 of features1) {
      const box1 = this.safeBbox(f1);
      const partners = [];

      for (let i = 0; i < features2.length; i++) {
        if (!this.bboxOverlaps(box1, boxes2[i])) continue;
        if (this.geomIntersects(f1, features2[i])) partners.push(features2[i]);
      }

      if (partners.length === 0) continue;

      const partner = partners.length === 1 ? partners[0] : this.largestOverlap(f1, partners);
      const clone = JSON.parse(JSON.stringify(f1));
      clone.properties = mergeProperties(f1.properties, partner.properties);
      results.push(clone);
    }

    return results;
  }

  /**
   * 겹치는 상대 후보 중 겹침 넓이가 가장 큰 피처를 고른다.
   */
  largestOverlap(feature, candidates) {
    let best = candidates[0];
    let bestArea = -1;

    for (const candidate of candidates) {
      let area = 0;
      try {
        const overlap = turf.intersect(turf.featureCollection([feature, candidate]));
        if (overlap) area = turf.area(overlap);
      } catch (e) {
        area = 0;
      }
      if (area > bestArea) {
        bestArea = area;
        best = candidate;
      }
    }

    return best;
  }

  /**
   * 두 지오메트리가 겹치는지 검사한다. 잘못된 지오메트리는 미겹침 처리.
   */
  geomIntersects(f1, f2) {
    try {
      return turf.booleanIntersects(f1, f2);
    } catch (e) {
      return false;
    }
  }

  /** 경계 상자 계산 (실패 시 무한 상자로 두어 걸러내지 않는다) */
  safeBbox(feature) {
    try {
      return turf.bbox(feature);
    } catch (e) {
      return [-Infinity, -Infinity, Infinity, Infinity];
    }
  }

  /** 두 경계 상자가 겹치는지 */
  bboxOverlaps(a, b) {
    return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
  }

  /**
   * 두 레이어 간 합집합(Union) 연산
   * @param {string} layerId1 - 첫 번째 레이어 ID
   * @param {string} layerId2 - 두 번째 레이어 ID
   * @param {Object} [options]
   * @param {boolean} [options.dissolve=true] true면 모든 피처를 하나의 도형으로 병합한다.
   *   false면 두 레이어 피처를 그대로 합쳐 각자의 속성을 유지한다.
   * @returns {Object} 결과 정보
   */
  union(layerId1, layerId2, options = {}) {
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

    // 피처 유지 모드: 자르지도 뭉치지도 않고 그대로 합친다 (속성이 온전히 남는다)
    if (options.dissolve === false) {
      const results = [
        ...this.taggedCopies(features1, layer1.name),
        ...this.taggedCopies(features2, layer2.name)
      ];
      return this.createResultLayer(results, `${layer1.name}_∪_${layer2.name}`, '#3b82f6');
    }

    // 병합 모드: 모든 피처를 하나의 도형으로 (경계선이 사라지므로 속성은 남길 수 없다)
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
   * 피처를 깊은 복제하고 어느 레이어에서 왔는지 표시한다.
   */
  taggedCopies(features, layerName) {
    return features.map(feature => {
      const clone = JSON.parse(JSON.stringify(feature));
      clone.properties = withTag(feature.properties, '출처레이어', layerName);
      return clone;
    });
  }

  /**
   * 차집합(Difference) 연산 - 첫 번째 레이어에서 두 번째 레이어 영역 제거
   * @param {string} layerId1 - 첫 번째 레이어 ID (유지할 레이어)
   * @param {string} layerId2 - 두 번째 레이어 ID (제거할 레이어)
   * @param {Object} [options]
   * @param {boolean} [options.keepFeatures=false] true면 부분적으로 자르는 대신
   *   레이어2와 겹치는 피처를 통째로 제외한다 (남는 피처는 원본 그대로).
   * @returns {Object} 결과 정보
   */
  difference(layerId1, layerId2, options = {}) {
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

    const results = options.keepFeatures
      ? this.excludeOverlapping(features1, features2)
      : this.subtractOverlapping(features1, features2);

    if (results.length === 0) {
      throw new Error(
        options.keepFeatures
          ? '모든 피처가 겹쳐서 남는 피처가 없습니다.'
          : '차집합 연산에 실패했습니다.'
      );
    }

    const separator = options.keepFeatures ? '_겹침제외_' : '_−_';
    return this.createResultLayer(
      results,
      `${layer1.name}${separator}${layer2.name}`,
      '#ef4444'
    );
  }

  /**
   * 겹치는 부분을 잘라낸다. 입력 레이어의 속성은 그대로 유지된다.
   */
  subtractOverlapping(features1, features2) {
    const boxes2 = features2.map(f => this.safeBbox(f));
    const results = [];

    for (const f1 of features1) {
      const box1 = this.safeBbox(f1);
      let current = f1;

      for (let i = 0; i < features2.length; i++) {
        if (!this.bboxOverlaps(box1, boxes2[i])) continue;
        try {
          const diff = turf.difference(turf.featureCollection([current, features2[i]]));
          if (diff) {
            // turf.difference는 첫 피처의 속성을 물려주지만, 명시적으로 고정해 둔다
            diff.properties = mergeProperties(f1.properties, null);
            current = diff;
          }
        } catch (e) {
          console.warn('차집합 연산 실패:', e);
        }
      }

      if (current) results.push(current);
    }

    return results;
  }

  /**
   * 자르지 않고, 레이어2와 겹치는 레이어1 피처를 통째로 제외한다.
   */
  excludeOverlapping(features1, features2) {
    const boxes2 = features2.map(f => this.safeBbox(f));
    const results = [];

    for (const f1 of features1) {
      const box1 = this.safeBbox(f1);
      const overlaps = features2.some(
        (f2, i) => this.bboxOverlaps(box1, boxes2[i]) && this.geomIntersects(f1, f2)
      );

      if (overlaps) continue;

      const clone = JSON.parse(JSON.stringify(f1));
      clone.properties = mergeProperties(f1.properties, null);
      results.push(clone);
    }

    return results;
  }

  /**
   * 클리핑(Clip) - 첫 번째 레이어를 두 번째 레이어 범위로 자르기
   * @param {string} inputLayerId - 자를 레이어 ID
   * @param {string} clipLayerId - 클리핑 영역 레이어 ID
   * @param {Object} [options] intersect와 동일한 옵션
   * @returns {Object} 결과 정보
   */
  clip(inputLayerId, clipLayerId, options = {}) {
    // Intersect와 동일하게 작동
    return this.intersect(inputLayerId, clipLayerId, options);
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
