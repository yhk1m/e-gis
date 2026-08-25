// © 2026 김용현
/**
 * FeatureEditGeometry - 피처 편집(합치기/자르기) 순수 지오메트리 로직
 *
 * OpenLayers / DOM 에 의존하지 않고 GeoJSON(EPSG:4326) in → GeoJSON out 으로만 동작한다.
 * 덕분에 Node 환경에서 단위 테스트가 가능하다. 좌표 변환은 호출부(FeatureEditTool)가 담당.
 */

import * as turf from '@turf/turf';
import { isNumericValue } from '../utils/layerSelect.js';

/**
 * 여러 피처의 속성을 하나로 합친다.
 * 선택한 모든 피처의 필드를 모으고(합집합), 수치 필드는 합계,
 * 그 외 필드는 값이 있는 첫 피처의 값을 쓴다.
 *
 * 레이어를 넘나들며 합칠 때 한쪽 레이어에만 있는 필드가 사라지지 않게 하기 위한 규칙이다.
 * 어떤 필드가 수치인지는 그 필드에 값이 처음 들어 있는 피처의 값으로 정한다 —
 * 빈 칸(흔히 null)이 앞서 나온다고 문자열 필드로 오판해서는 안 된다.
 * 판별은 앱 공통 규칙인 isNumericValue 를 쓴다(숫자 문자열도 숫자로 본다):
 * GeoJSON·셰이프파일 로더가 숫자를 문자열로 남겨두므로, 주제도가 숫자로 보는 필드를
 * 합치기가 못 더하는 일이 없게 하기 위해서다.
 *
 * @param {Object[]} propsArray - 각 피처의 properties 객체 배열
 * @returns {Object}
 */
export function mergeAttributes(propsArray) {
  const list = (propsArray || []).map((p) => (p && typeof p === 'object' ? p : {}));
  const has = (p, key) => Object.prototype.hasOwnProperty.call(p, key);

  // 등장 순서를 지키려고 Map 을 쓴다.
  // (필드명이 '2020' 처럼 정수꼴이면 결과 객체에서 앞으로 당겨진다 — JS 객체의 성질이라 어쩔 수 없다.
  //  원본 레이어의 속성 테이블도 같은 순서로 보이므로 어긋나 보이지는 않는다)
  //
  // 수치 여부는 '값이 처음 들어 있는' 피처로 정한다. 빈 칸은 타입의 근거가 못 된다 —
  // 공공 GeoJSON 은 빈 칸을 null 로 두는 일이 흔한데, 그것 때문에 합계가 조용히 틀어지면 안 된다.
  // 판별은 앱 공통 규칙인 isNumericValue 를 쓴다. GeoJSON·셰이프파일 로더는 숫자를 문자열
  // 그대로 두므로, 주제도가 숫자로 보는 필드를 합치기가 못 더하는 일이 없어야 한다.
  const fields = new Map();   // key -> { numeric, decided, blank }
  list.forEach((props) => {
    Object.keys(props).forEach((key) => {
      const v = props[key];
      const known = fields.get(key);
      if (!known) {
        fields.set(key, { numeric: isNumericValue(v), decided: hasValue(v), blank: v });
      } else if (!known.decided && hasValue(v)) {
        known.numeric = isNumericValue(v);
        known.decided = true;
      }
    });
  });

  const result = {};
  fields.forEach((field, key) => {
    if (field.numeric) {
      result[key] = list.reduce(
        (sum, p) => sum + (has(p, key) && isNumericValue(p[key]) ? parseFloat(p[key]) : 0),
        0
      );
    } else {
      const filled = list.find((p) => has(p, key) && hasValue(p[key]));
      // 아무 피처에도 값이 없으면 그 필드가 처음 나온 피처의 (빈) 값을 그대로 둔다
      result[key] = filled ? filled[key] : field.blank;
    }
  });

  return result;
}

/**
 * 같은 타입의 피처들을 하나의 피처로 합친다.
 * 폴리곤은 union, 라인은 MultiLineString 으로 결합한다.
 * @param {Object[]} features - GeoJSON Feature 배열 (모두 같은 지오메트리 계열)
 * @returns {Object} 합쳐진 GeoJSON Feature
 */
export function mergeGeoJSON(features) {
  if (!features || features.length < 2) {
    throw new Error('합칠 피처가 2개 이상 필요합니다.');
  }

  const props = mergeAttributes(features.map((f) => f.properties || {}));
  const type = turf.getType(features[0]);

  if (type === 'Polygon' || type === 'MultiPolygon') {
    let merged = features[0];
    for (let i = 1; i < features.length; i++) {
      merged = turf.union(turf.featureCollection([merged, features[i]]));
      if (!merged) throw new Error('폴리곤 합치기에 실패했습니다.');
    }
    return turf.feature(merged.geometry, props);
  }

  if (type === 'LineString' || type === 'MultiLineString') {
    const coords = [];
    features.forEach((f) => {
      const g = f.geometry;
      if (g.type === 'LineString') coords.push(g.coordinates);
      else if (g.type === 'MultiLineString') g.coordinates.forEach((c) => coords.push(c));
    });
    return turf.multiLineString(coords, props);
  }

  throw new Error('합치기는 폴리곤 또는 라인 피처만 지원합니다.');
}

/**
 * 라인 피처를 자를 선으로 분할한다.
 * @param {Object} line - GeoJSON LineString/MultiLineString Feature
 * @param {Object} cutter - 자를 선 (LineString Feature)
 * @returns {Object[]|null} 분할된 Feature 배열, 교차 없으면 null
 */
export function splitLineByLine(line, cutter) {
  const split = turf.lineSplit(line, cutter);
  const parts = split.features;
  if (parts.length < 2) return null;
  const props = line.properties || {};
  return parts.map((p) => turf.feature(p.geometry, { ...props }));
}

/**
 * 폴리곤 피처를 자를 선으로 분할한다.
 * 1차: 경계 노딩 + polygonize 로 틈 없는 정확 분할
 * 폴백: 버퍼 + difference
 * @param {Object} polygon - GeoJSON Polygon/MultiPolygon Feature
 * @param {Object} line - 자를 선 (LineString Feature)
 * @returns {Object[]|null} 분할된 Feature 배열(2개 이상), 분할 불가 시 null
 */
export function splitPolygonByLine(polygon, line) {
  try {
    const result = polygonizeSplit(polygon, line);
    if (result && result.length >= 2) return assignProps(result, polygon);
  } catch (e) {
    // 폴백으로 진행
  }
  const fallback = bufferDiffSplit(polygon, line);
  if (fallback && fallback.length >= 2) return assignProps(fallback, polygon);
  return null;
}

/**
 * 자를 선이 피처와 교차하는지 빠르게 검사한다 (분할 전 사전 필터).
 * @param {Object} feature - GeoJSON Feature
 * @param {Object} line - 자를 선 (LineString Feature)
 * @returns {boolean}
 */
export function lineIntersectsFeature(feature, line) {
  try {
    return turf.booleanIntersects(feature, line);
  } catch (e) {
    return false;
  }
}

// ==================== 내부 헬퍼 ====================

/** 값이 실제로 들어 있는지 (빈 문자열·null·undefined 는 없는 것으로 본다) */
function hasValue(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function polygonizeSplit(polygon, line) {
  const boundary = turf.polygonToLine(polygon);
  const boundaryLines = toLineStrings(boundary);

  const segments = [];

  // 경계선을 자를 선으로 분할한 조각들
  boundaryLines.forEach((bl) => {
    turf.lineSplit(bl, line).features.forEach((s) => segments.push(s));
  });

  // 자를 선 중 폴리곤 내부에 있는 구간들 (경계와 노드 공유)
  const cutSegments = turf.lineSplit(line, polygon).features;
  cutSegments.forEach((seg) => {
    const mid = turf.along(seg, turf.length(seg, { units: 'kilometers' }) / 2, {
      units: 'kilometers'
    });
    if (turf.booleanPointInPolygon(mid, polygon)) segments.push(seg);
  });

  const polys = turf.polygonize(turf.featureCollection(segments));
  return polys.features;
}

function bufferDiffSplit(polygon, line) {
  const bbox = turf.bbox(polygon);
  const diagKm = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[3]], {
    units: 'kilometers'
  });
  const epsKm = Math.max(diagKm * 1e-5, 1e-6);

  const buffered = turf.buffer(line, epsKm, { units: 'kilometers' });
  if (!buffered) return null;

  const diff = turf.difference(turf.featureCollection([polygon, buffered]));
  if (!diff) return null;

  const g = diff.geometry;
  if (g.type === 'Polygon') return [turf.feature(g)];
  if (g.type === 'MultiPolygon') return g.coordinates.map((c) => turf.polygon(c));
  return null;
}

function toLineStrings(boundary) {
  const out = [];
  const push = (feat) => {
    const g = feat.geometry;
    if (g.type === 'LineString') out.push(turf.lineString(g.coordinates));
    else if (g.type === 'MultiLineString')
      g.coordinates.forEach((c) => out.push(turf.lineString(c)));
  };
  if (boundary.type === 'FeatureCollection') boundary.features.forEach(push);
  else push(boundary);
  return out;
}

function assignProps(feats, polygon) {
  const props = polygon.properties || {};
  return feats.map((f) => turf.feature(f.geometry, { ...props }));
}
