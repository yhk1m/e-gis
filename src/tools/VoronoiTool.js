// © 2026 김용현
/**
 * VoronoiTool - 보로노이 다이어그램(티센 폴리곤) 생성 도구
 *
 * 좌표계: 전 과정을 EPSG:3857(지도 좌표계)에서 계산한다. 프로젝트 관례("turf는 4326")와
 * 다른데, turf.voronoi는 측지 연산이 아니라 평면 연산이라 좌표계를 고를 수 있기 때문이다.
 * 4326(경위도)으로 계산하면 위도 37°에서 경도 1°≈88.8km / 위도 1°≈111km라
 * 약 25%의 이방성 왜곡이 생겨 셀이 찌그러진다.
 * 근거: docs/superpowers/specs/2026-07-15-voronoi-design.md
 *
 * 면적만 예외로 ol/sphere getArea로 측지 계산한다 (turf.area는 4326을 가정하므로 못 씀).
 */

import * as turf from '@turf/turf';
import GeoJSON from 'ol/format/GeoJSON';
import { getArea } from 'ol/sphere';
import { layerManager } from '../core/LayerManager.js';
import { dedupeSeeds, computeBBox, resolveFieldName } from './voronoiHelpers.js';

const AREA_FIELD = 'area_km2';
const DEFAULT_COLOR = '#3388ff';

class VoronoiTool {
  constructor() {
    this.geoJSONFormat = new GeoJSON();
  }

  /**
   * 포인트 레이어 목록
   */
  getPointLayers() {
    return layerManager.getAllLayers().filter(layer =>
      layer.geometryType === 'Point' || layer.geometryType === 'MultiPoint'
    );
  }

  /**
   * 폴리곤 레이어 목록 (경계 클립 후보)
   */
  getPolygonLayers() {
    return layerManager.getAllLayers().filter(layer =>
      layer.geometryType === 'Polygon' || layer.geometryType === 'MultiPolygon'
    );
  }

  /**
   * 보로노이 다이어그램 생성
   *
   * @param {string} layerId - 포인트 레이어 ID
   * @param {Object} options
   * @param {string} options.color - 결과 레이어 색상
   * @param {string|null} options.boundaryLayerId - 경계 레이어 ID, null이면 사각형 모드
   * @returns {{layerId: string, layerName: string, cellCount: number,
   *            skipped: {duplicates: number, nonPoint: number, outsideBoundary: number}}}
   */
  createVoronoi(layerId, options = {}) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    // 1~2. 시드 추출 + 중복 제거
    const { seeds: rawSeeds, nonPoint } = this.extractSeeds(layerInfo);
    const { seeds, duplicates } = dedupeSeeds(rawSeeds);

    // 3. 최소 개수
    if (seeds.length < 2) {
      throw new Error(
        `보로노이를 만들려면 서로 다른 위치의 점이 2개 이상 필요합니다 (현재 ${seeds.length}개).`
      );
    }

    // 4. 경계 준비 + bbox
    //    경계 밖 시드도 경계 안쪽으로 셀을 밀어넣으므로 extent는 합집합이어야 한다.
    const boundaryFeature = options.boundaryLayerId
      ? this.buildBoundary(options.boundaryLayerId)
      : null;
    const bbox = computeBBox(
      this.extentOf(seeds),
      boundaryFeature ? turf.bbox(boundaryFeature) : null
    );

    // 5. 보로노이 생성. 3857 좌표를 그대로 먹인다.
    let cells = this.buildCells(seeds, bbox);

    // 6. 경계 클립
    let outsideBoundary = 0;
    if (boundaryFeature) {
      const clipResult = this.clipCells(cells, boundaryFeature);
      cells = clipResult.cells;
      outsideBoundary = clipResult.outsideBoundary;
    }

    if (cells.length === 0) {
      throw new Error(
        '경계 레이어와 겹치는 셀이 없습니다. 포인트와 경계가 같은 지역인지 확인해 주세요.'
      );
    }

    // 7. 면적 필드 + OL 피처 (면적은 반드시 클립 후에 계산)
    const olFeatures = this.toOLFeaturesWithArea(cells);

    // 8. 레이어 생성
    const layerName = `${layerInfo.name}_보로노이`;
    const newLayerId = layerManager.addLayer({
      name: layerName,
      features: olFeatures,
      color: options.color || DEFAULT_COLOR
    });

    return {
      layerId: newLayerId,
      layerName,
      cellCount: olFeatures.length,
      skipped: { duplicates, nonPoint, outsideBoundary }
    };
  }

  /**
   * OL 피처에서 시드를 뽑는다. 좌표는 EPSG:3857 원좌표 그대로.
   * MultiPoint는 각 점을 개별 시드로 펼치되 부모 속성을 공유한다.
   *
   * 레이어의 geometryType은 첫 피처만 보고 정해지므로(LayerManager.js:106-115)
   * 포인트 레이어에도 다른 타입이 섞여 있을 수 있다. 조용히 버리지 않고 센다.
   *
   * @returns {{seeds: Array<{coord: number[], properties: Object}>, nonPoint: number}}
   */
  extractSeeds(layerInfo) {
    const features = layerInfo.olLayer.getSource().getFeatures();
    const seeds = [];
    let nonPoint = 0;

    for (const feature of features) {
      const geom = feature.getGeometry();
      if (!geom) {
        nonPoint++;
        continue;
      }

      const properties = { ...feature.getProperties() };
      delete properties.geometry;

      const type = geom.getType();
      if (type === 'Point') {
        seeds.push({ coord: geom.getCoordinates(), properties });
      } else if (type === 'MultiPoint') {
        for (const coord of geom.getCoordinates()) {
          seeds.push({ coord, properties: { ...properties } });
        }
      } else {
        nonPoint++;
      }
    }

    return { seeds, nonPoint };
  }

  /**
   * 시드들의 extent
   */
  extentOf(seeds) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { coord } of seeds) {
      if (coord[0] < minX) minX = coord[0];
      if (coord[1] < minY) minY = coord[1];
      if (coord[0] > maxX) maxX = coord[0];
      if (coord[1] > maxY) maxY = coord[1];
    }
    return [minX, minY, maxX, maxY];
  }

  /**
   * 경계 레이어의 폴리곤들을 하나로 합친다.
   *
   * union이 실패하면 조용히 폴백하지 않고 에러를 던진다. 사용자가 경계를 지정했는데
   * 사각형 결과가 나오면 그걸 맞다고 믿게 되기 때문이다.
   */
  buildBoundary(boundaryLayerId) {
    const layerInfo = layerManager.getLayer(boundaryLayerId);
    if (!layerInfo) {
      throw new Error('경계 레이어를 찾을 수 없습니다.');
    }

    // 옵션 없이 write → 3857 원좌표 유지
    const geoFeatures = layerInfo.olLayer.getSource().getFeatures()
      .map(f => this.geoJSONFormat.writeFeatureObject(f))
      .filter(f => f.geometry &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));

    if (geoFeatures.length === 0) {
      throw new Error('경계 레이어에 폴리곤 피처가 없습니다.');
    }
    if (geoFeatures.length === 1) {
      return geoFeatures[0];
    }

    try {
      const merged = turf.union(turf.featureCollection(geoFeatures));
      if (!merged) throw new Error('union 결과가 비어 있습니다.');
      return merged;
    } catch (error) {
      console.warn('경계 union 실패:', error);
      throw new Error(
        '경계 레이어의 도형을 합치는 데 실패했습니다. ' +
        '다른 경계 레이어를 쓰거나 사각형 모드로 시도해 주세요.'
      );
    }
  }

  /**
   * 셀들을 경계로 자른다. 경계 밖 셀은 버리고 개수를 센다.
   */
  clipCells(cells, boundaryFeature) {
    const kept = [];
    let outsideBoundary = 0;

    for (const cell of cells) {
      let piece = null;
      try {
        piece = turf.intersect(turf.featureCollection([cell, boundaryFeature]));
      } catch (error) {
        console.warn('셀 클립 실패:', error);
      }

      if (piece) {
        // turf.intersect는 속성을 넘겨주지 않으므로 원본 셀 속성을 다시 붙인다.
        piece.properties = { ...cell.properties };
        kept.push(piece);
      } else {
        outsideBoundary++;
      }
    }

    return { cells: kept, outsideBoundary };
  }

  /**
   * turf.voronoi 호출. 속성 복사는 turf가 알아서 한다(cloneProperties).
   */
  buildCells(seeds, bbox) {
    const points = turf.featureCollection(
      seeds.map(s => turf.point(s.coord, s.properties))
    );

    try {
      // d3-voronoi는 겹친 좌표에 구멍(hole)이 있는 sparse array를 돌려준다.
      // map이 구멍을 건너뛰므로 예외는 나지 않지만 배열이 sparse로 남는다.
      // dedupeSeeds가 앞단에서 중복을 걸러 개수를 보고하므로 여기 구멍은 없어야 하고,
      // filter(Boolean)은 sparse가 새어 나올 경우를 막는 방어용이다.
      return turf.voronoi(points, { bbox }).features.filter(Boolean);
    } catch (error) {
      throw new Error('보로노이 생성에 실패했습니다: ' + error.message);
    }
  }

  /**
   * GeoJSON 셀 → OL 피처. 면적 필드를 붙인다.
   * readFeatures를 옵션 없이 호출하므로 좌표 변환이 없다(3857 유지).
   */
  toOLFeaturesWithArea(cells) {
    const olFeatures = this.geoJSONFormat.readFeatures(turf.featureCollection(cells));

    // 셀마다 속성 키가 다를 수 있으므로 전체 합집합을 봐야 한다.
    // TableJoinTool은 조인 키가 맞은 피처에만 필드를 붙이므로(TableJoinTool.js:237),
    // 부분 조인 후에는 일부 포인트에만 area_km2가 있다. 첫 셀만 보면 충돌을 놓쳐
    // 사용자의 원본 area_km2를 계산값으로 덮어쓴다.
    const existingKeys = [...new Set(
      cells.flatMap(c => Object.keys(c.properties || {}))
    )];
    const areaField = resolveFieldName(AREA_FIELD, existingKeys);

    for (const feature of olFeatures) {
      const areaM2 = getArea(feature.getGeometry(), { projection: 'EPSG:3857' });
      feature.set(areaField, Number((areaM2 / 1e6).toFixed(3)));
    }

    return olFeatures;
  }
}

export const voronoiTool = new VoronoiTool();
