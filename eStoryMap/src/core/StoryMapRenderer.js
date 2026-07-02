// © 2026 김용현
// eStoryMap/src/core/StoryMapRenderer.js
// 현재 페이지 상태 → OL 지도 반영. 지오데이터 재파싱 없이 setVisible 토글만
// (상위 스펙 §3 렌더링 파이프라인 — 전환이 가볍고 빠른 이유).

/**
 * 페이지의 layerVisibility대로 레지스트리의 모든 레이어 가시성을 맞춘다.
 * 미등재 레이어는 숨김(§2 가시성 계약).
 * @param {object} page - StoryDoc 페이지
 * @param {import('./SourceRegistry.js').SourceRegistry} registry
 */
export function applyPageVisibility(page, registry) {
  for (const { sourceId, layerId, layer } of registry.entriesList()) {
    const entry = page.layerVisibility.find(
      (v) => v.sourceId === sourceId && v.layerId === layerId,
    );
    layer.setVisible(entry ? entry.visible : false);
  }
  // (M4) page.camera 적용 지점 — CameraAnimator에서 이동/애니메이션 담당 예정.
  // (v2) page.overrides 적용 지점.
}
