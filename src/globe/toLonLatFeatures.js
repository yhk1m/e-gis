// © 2026 김용현
/**
 * OL 피처(EPSG:3857) → GeoJSON FeatureCollection(EPSG:4326).
 *
 * e-GIS 는 피처를 전부 3857 로 들고 있고 d3-geo 는 경위도만 받는다.
 * 변환은 비싸므로 GlobeController 가 레이어별로 캐시한다(소스 revision 으로 무효화).
 */
import GeoJSON from 'ol/format/GeoJSON';

const format = new GeoJSON();

/**
 * @param {import('ol/Feature').default[]} features
 * @returns {{type: 'FeatureCollection', features: object[]}}
 */
export function toLonLatFeatures(features) {
  const withGeometry = (features || []).filter((f) => f && typeof f.getGeometry === 'function' && f.getGeometry());
  return format.writeFeaturesObject(withGeometry, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
    decimals: 6,
    // d3-geo 는 외곽 링이 시계 방향(우측 규칙 아님)이어야 "작은 폴리곤"으로 읽는다.
    // 내장 GeoJSON(서울 자치구·시도·시군구)은 RFC 7946 대로 반시계라 그대로 넘기면
    // 구 전체가 칠해지고 실제 영역만 구멍이 된다. OL 이 링 방향을 시계로 맞춰 쓰게 한다.
    rightHanded: false
  });
}

/** LayerManager 레이어 객체에서 피처를 꺼내 변환한다. 벡터 소스가 없으면 빈 컬렉션. */
export function layerToLonLat(layerInfo) {
  const source = layerInfo.source || layerInfo.olLayer?.getSource?.();
  if (!source || typeof source.getFeatures !== 'function') return { type: 'FeatureCollection', features: [] };
  return toLonLatFeatures(source.getFeatures());
}
