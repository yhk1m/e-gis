// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  MULTI_LAYER_VALUE,
  buildLayerOptions,
  resolveMultiLayerIds,
  resolveInitialLayerValue,
  commonFields
} from './layerSelect.js';

const layers = [
  { id: 'a', name: '학교' },
  { id: 'b', name: '병원' },
  { id: 'c', name: '공원' }
];

describe('MULTI_LAYER_VALUE', () => {
  it('정해진 값이다', () => {
    expect(MULTI_LAYER_VALUE).toBe('__selected__');
  });
});

describe('buildLayerOptions multiIds', () => {
  it('2개 이상이면 맨 위에 「선택한 레이어 N개 모두」를 넣는다', () => {
    const html = buildLayerOptions(layers, { multiIds: ['a', 'b'], selectedId: MULTI_LAYER_VALUE });
    expect(html).toMatch(/^<option value="__selected__" selected>선택한 레이어 2개 모두<\/option>/);
    // 플레이스홀더는 선택되지 않는다
    expect(html).not.toMatch(/<option value="" selected>/);
  });

  it('1개 이하면 넣지 않는다', () => {
    expect(buildLayerOptions(layers, { multiIds: ['a'] })).not.toContain('__selected__');
    expect(buildLayerOptions(layers, {})).not.toContain('__selected__');
  });

  it('multiIds 가 있어도 단일 선택은 그대로 동작한다', () => {
    const html = buildLayerOptions(layers, { multiIds: ['a', 'b'], selectedId: 'c' });
    expect(html).toContain('<option value="c" selected>공원</option>');
    expect(html).toContain('<option value="__selected__">선택한 레이어 2개 모두</option>');
  });
});

describe('resolveMultiLayerIds', () => {
  it('지원 레이어만 선택 순서대로 남긴다', () => {
    expect(resolveMultiLayerIds(layers, ['c', 'x', 'a'])).toEqual(['c', 'a']);
  });

  it('남은 것이 2개 미만이면 빈 배열', () => {
    expect(resolveMultiLayerIds(layers, ['c', 'x'])).toEqual([]);
    expect(resolveMultiLayerIds(layers, null)).toEqual([]);
  });
});

describe('resolveInitialLayerValue', () => {
  it('지원 레이어가 2개 이상 선택돼 있으면 「모두」를 고른다', () => {
    expect(resolveInitialLayerValue(layers, 'b', ['a', 'b'])).toBe(MULTI_LAYER_VALUE);
  });

  it('지원 레이어가 1개만 선택돼 있으면 단일 규칙을 따른다', () => {
    expect(resolveInitialLayerValue(layers, 'b', ['x', 'b'])).toBe('b');
  });

  it('선택이 없으면 플레이스홀더', () => {
    expect(resolveInitialLayerValue(layers, null, [])).toBe('');
  });
});

describe('commonFields', () => {
  it('모든 목록에 있는 필드만 첫 목록 순서대로', () => {
    expect(commonFields([['pop', 'name', 'area'], ['area', 'pop'], ['pop', 'x', 'area']])).toEqual(['pop', 'area']);
  });

  it('목록이 없으면 빈 배열', () => {
    expect(commonFields([])).toEqual([]);
  });
});
