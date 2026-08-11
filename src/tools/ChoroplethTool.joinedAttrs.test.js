// © 2026 김용현
// @vitest-environment jsdom
/**
 * 테이블 결합(TableJoinTool)은 CSV에 짝이 있는 피처에만 필드를 붙인다.
 * 격자처럼 통계에 없는 칸(인구 0 등)이 섞이면 첫 피처에 결합 필드가 없을 수 있다.
 *
 * 이때도 단계구분도는 그 레이어를 지원 대상으로 인식해야 한다.
 * (예: grid_다사_1k.gpkg 8,609칸 중 7,008칸만 인구 CSV와 매칭 —
 *  첫 피처 '다사0001'은 CSV에 없고, 6번째 '다사0038'부터 pop이 붙는다)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { choroplethTool } from './ChoroplethTool.js';

function cell(props) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    ...props
  });
}

/** 앞 5칸은 미매칭(GRID_CD만), 뒤 3칸은 pop이 결합된 격자 레이어 */
function joinedGridLayer() {
  const features = [
    cell({ GRID_CD: '다사0001' }),
    cell({ GRID_CD: '다사0002' }),
    cell({ GRID_CD: '다사0007' }),
    cell({ GRID_CD: '다사0012' }),
    cell({ GRID_CD: '다사0037' }),
    cell({ GRID_CD: '다사0038', year: 2024, stat: 'to_in_001', pop: 103 }),
    cell({ GRID_CD: '다사0039', year: 2024, stat: 'to_in_001', pop: 298 }),
    cell({ GRID_CD: '다사0040', year: 2024, stat: 'to_in_001', pop: 253 })
  ];
  return layerManager.addLayer({ name: '격자 인구', type: 'vector', features });
}

describe('결합 필드가 첫 피처에 없는 레이어', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('뒤쪽 피처에만 있는 숫자 필드도 단계구분도 속성으로 잡는다', () => {
    const id = joinedGridLayer();
    expect(choroplethTool.getNumericAttributes(id)).toContain('pop');
  });

  it('단계구분도 지원 레이어 목록에 포함된다', () => {
    const id = joinedGridLayer();
    expect(choroplethTool.getCompatibleLayers().map(l => l.id)).toContain(id);
  });
});
