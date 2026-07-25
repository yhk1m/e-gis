// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { isVectorLayer, resolveInitialLayerId, buildLayerOptions } from './layerSelect.js';

function makeLayer(overrides = {}) {
  return {
    id: 'layer-1',
    name: '서울 자치구',
    type: 'vector',
    source: { getFeatures: () => [] },
    geometryType: 'Polygon',
    featureCount: 25,
    ...overrides
  };
}

describe('isVectorLayer', () => {
  it('피처 소스를 가진 벡터 레이어만 통과시킨다', () => {
    expect(isVectorLayer(makeLayer())).toBe(true);
  });

  it('래스터·히트맵·도형표현도는 제외한다', () => {
    expect(isVectorLayer(makeLayer({ type: 'raster', source: null }))).toBe(false);
    expect(isVectorLayer(makeLayer({ type: 'heatmap' }))).toBe(false);
    expect(isVectorLayer(makeLayer({ type: 'chartmap' }))).toBe(false);
    expect(isVectorLayer(null)).toBe(false);
  });
});

describe('resolveInitialLayerId', () => {
  const layers = [makeLayer({ id: 'a' }), makeLayer({ id: 'b' })];

  it('선택 레이어가 지원 목록에 있으면 그 레이어를 고른다', () => {
    expect(resolveInitialLayerId(layers, 'b')).toBe('b');
  });

  it('지원하지 않는 레이어가 선택돼 있으면 플레이스홀더로 둔다', () => {
    expect(resolveInitialLayerId(layers, 'raster-1')).toBe('');
  });

  it('선택된 레이어가 없으면 플레이스홀더로 둔다', () => {
    expect(resolveInitialLayerId(layers, null)).toBe('');
  });
});

describe('buildLayerOptions', () => {
  it('선택 레이어 옵션에 selected를 붙인다', () => {
    const html = buildLayerOptions([makeLayer({ id: 'a', name: 'A' }), makeLayer({ id: 'b', name: 'B' })], {
      selectedId: 'b'
    });
    expect(html).toContain('<option value="b" selected>B');
    expect(html).not.toContain('<option value="a" selected');
    expect(html).toContain('<option value="">-- 레이어 선택 --</option>');
  });

  it('선택 레이어가 없으면 플레이스홀더가 선택된다', () => {
    const html = buildLayerOptions([makeLayer({ id: 'a', name: 'A' })]);
    expect(html).toContain('<option value="" selected>-- 레이어 선택 --</option>');
  });

  it('showCount 옵션이면 피처 수를 붙인다', () => {
    const html = buildLayerOptions([makeLayer({ id: 'a', name: 'A', featureCount: 3 })], { showCount: true });
    expect(html).toContain('>A (3)</option>');
  });

  it('레이어 이름의 HTML 특수문자를 이스케이프한다', () => {
    const html = buildLayerOptions([makeLayer({ id: 'a', name: '<b>"용도"</b> & 지역' })]);
    expect(html).toContain('&lt;b&gt;&quot;용도&quot;&lt;/b&gt; &amp; 지역');
  });
});
