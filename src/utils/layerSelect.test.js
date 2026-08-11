// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  isVectorLayer,
  resolveInitialLayerId,
  buildLayerOptions,
  collectFieldNames,
  collectNumericFields,
  isNumericValue
} from './layerSelect.js';

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

/** OpenLayers Feature를 흉내낸 최소 객체 */
function feat(props) {
  return {
    getKeys: () => Object.keys(props),
    get: key => props[key]
  };
}

describe('collectFieldNames', () => {
  it('모든 피처의 필드를 처음 나온 순서대로 모은다', () => {
    const fields = collectFieldNames([
      feat({ GRID_CD: '다사0001' }),
      feat({ GRID_CD: '다사0038', pop: 103, year: 2024 })
    ]);
    expect(fields).toEqual(['GRID_CD', 'pop', 'year']);
  });

  it('geometry는 빼고 중복도 한 번만', () => {
    expect(collectFieldNames([feat({ geometry: {}, a: 1 }), feat({ a: 2 })])).toEqual(['a']);
  });

  it('피처가 없으면 빈 배열', () => {
    expect(collectFieldNames([])).toEqual([]);
    expect(collectFieldNames(null)).toEqual([]);
  });
});

describe('collectNumericFields', () => {
  it('첫 피처에 없어도 뒤쪽 피처의 숫자 필드를 찾는다', () => {
    // 테이블 결합에서 CSV에 짝이 없던 격자가 앞에 오는 실제 상황
    const fields = collectNumericFields([
      feat({ GRID_CD: '다사0001' }),
      feat({ GRID_CD: '다사0002' }),
      feat({ GRID_CD: '다사0038', pop: 103 })
    ]);
    expect(fields).toEqual(['pop']);
  });

  it('숫자 문자열도 숫자 필드로 본다', () => {
    expect(collectNumericFields([feat({ v: '103' })])).toEqual(['v']);
  });

  it('문자열 필드는 제외한다', () => {
    expect(collectNumericFields([feat({ 이름: '강남구' })])).toEqual([]);
  });

  it('값이 비어 있는 피처가 섞여도 필드를 놓치지 않는다', () => {
    const fields = collectNumericFields([
      feat({ pop: null }),
      feat({ pop: undefined }),
      feat({ pop: 42 })
    ]);
    expect(fields).toEqual(['pop']);
  });
});

describe('isNumericValue', () => {
  it('숫자와 숫자 문자열은 참', () => {
    expect(isNumericValue(0)).toBe(true);
    expect(isNumericValue(-3.5)).toBe(true);
    expect(isNumericValue('103 ')).toBe(true);
  });

  it('빈 문자열·null·NaN·불리언은 거짓', () => {
    expect(isNumericValue('')).toBe(false);
    expect(isNumericValue('  ')).toBe(false);
    expect(isNumericValue(null)).toBe(false);
    expect(isNumericValue(undefined)).toBe(false);
    expect(isNumericValue(NaN)).toBe(false);
    expect(isNumericValue(true)).toBe(false);
  });
});
