// © 2026 김용현
/**
 * selectionCleanup - 선택 집합에서 이미 사라진 피처를 골라낸다.
 *
 * 레이어를 지워도 OpenLayers Select 의 선택 집합은 그대로 남는다.
 * 놔두면 툴바의 선택 취소·삭제 버튼과 속성 카드가 없는 피처를 계속 가리킨다.
 */

/**
 * 남아 있는 레이어 어디에도 속하지 않는 피처를 반환한다.
 * @param {Array} features - 현재 선택된 피처
 * @param {Array} layers - 남아 있는 레이어 정보 (layerManager.getAllLayers())
 * @returns {Array} 선택에서 빼야 할 피처
 */
export function pickOrphanFeatures(features, layers) {
  // 래스터처럼 벡터 소스가 없는 레이어는 판단 대상이 아니다
  const searchable = (layers || []).filter(
    (layer) => layer && layer.source && typeof layer.source.hasFeature === 'function'
  );

  return (features || []).filter(
    (feature) => !searchable.some((layer) => layer.source.hasFeature(feature))
  );
}
