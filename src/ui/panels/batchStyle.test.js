// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { partitionStyleTargets, geometryKind, commonStyleControls, applyStyleToAll } from './batchStyle.js';

const L = (id, geometryType, type = 'vector', extra = {}) => ({ id, geometryType, type, ...extra });

describe('partitionStyleTargets', () => {
  it('흐름, 도형표현도, 래스터, 히트맵은 제외하고 나머지는 남긴다', () => {
    const { eligible, excluded } = partitionStyleTargets([
      L('a', 'Polygon'), L('b', 'Point', 'flow'), L('c', 'Point', 'chartmap'),
      L('d', null, 'raster'), L('e', 'Point', 'heatmap'), L('f', 'LineString'), L('g', 'Polygon', 'choropleth')
    ]);
    expect(eligible.map(l => l.id)).toEqual(['a', 'f', 'g']);
    expect(excluded.map(l => l.id)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('없는 레이어(null)는 아무 쪽에도 넣지 않는다', () => {
    const { eligible, excluded } = partitionStyleTargets([null, L('a', 'Point')]);
    expect(eligible.length).toBe(1);
    expect(excluded.length).toBe(0);
  });
});

describe('geometryKind', () => {
  it('멀티 지오메트리도 같은 종류로 본다', () => {
    expect(geometryKind(L('a', 'MultiPoint'))).toBe('point');
    expect(geometryKind(L('a', 'MultiLineString'))).toBe('line');
    expect(geometryKind(L('a', 'MultiPolygon'))).toBe('polygon');
    expect(geometryKind(L('a', undefined))).toBe('polygon');
  });
});

describe('commonStyleControls', () => {
  it('모두 면이면 면 항목과 선 모양까지 나온다', () => {
    expect(commonStyleControls([L('a', 'Polygon'), L('b', 'MultiPolygon')]))
      .toEqual(['fillColor', 'fillOpacity', 'strokeColor', 'strokeWidth', 'strokeDash']);
  });
  it('모두 점이면 선 모양이 없다', () => {
    expect(commonStyleControls([L('a', 'Point'), L('b', 'Point')]))
      .toEqual(['fillColor', 'fillOpacity', 'strokeColor', 'strokeWidth']);
  });
  it('점, 선, 면이 섞이면 선 색과 선 두께만', () => {
    expect(commonStyleControls([L('a', 'Point'), L('b', 'LineString'), L('c', 'Polygon')]))
      .toEqual(['strokeColor', 'strokeWidth']);
  });
  it('선과 면이면 선 모양도 공통', () => {
    expect(commonStyleControls([L('b', 'LineString'), L('c', 'Polygon')]))
      .toEqual(['strokeColor', 'strokeWidth', 'strokeDash']);
  });
  it('모두 선이면 선 투명도가 나온다', () => {
    expect(commonStyleControls([L('b', 'LineString'), L('c', 'MultiLineString')]))
      .toEqual(['strokeColor', 'strokeOpacity', 'strokeWidth', 'strokeDash']);
  });
  it('빈 목록이면 항목이 없다', () => {
    expect(commonStyleControls([])).toEqual([]);
  });
});

describe('applyStyleToAll', () => {
  function fakeManager(layers) {
    const calls = [];
    const map = new Map(layers.map(l => [l.id, l]));
    const rec = (name) => (id, v) => calls.push([name, id, v]);
    return {
      calls,
      getLayer: (id) => map.get(id),
      setLayerColor: rec('color'),
      setLayerStrokeColor: rec('strokeColor'),
      setLayerFillColor: rec('fillColor'),
      setLayerFillOpacity: rec('fillOpacity'),
      setLayerStrokeOpacity: rec('strokeOpacity'),
      setLayerStrokeWidth: rec('strokeWidth'),
      setLayerStrokeDash: rec('strokeDash')
    };
  }

  it('선 색은 선 레이어에 setLayerColor(단일 팝업과 같음), 나머지는 setLayerStrokeColor', () => {
    const lm = fakeManager([L('a', 'LineString'), L('b', 'Polygon')]);
    applyStyleToAll(['a', 'b'], 'strokeColor', '#ff0000', lm);
    expect(lm.calls).toEqual([['color', 'a', '#ff0000'], ['strokeColor', 'b', '#ff0000']]);
  });

  it('면 색과 두께는 고른 레이어 모두에', () => {
    const lm = fakeManager([L('a', 'Point'), L('b', 'Polygon')]);
    applyStyleToAll(['a', 'b'], 'fillColor', '#00ff00', lm);
    applyStyleToAll(['a', 'b'], 'strokeWidth', 3, lm);
    expect(lm.calls).toEqual([
      ['fillColor', 'a', '#00ff00'], ['fillColor', 'b', '#00ff00'],
      ['strokeWidth', 'a', 3], ['strokeWidth', 'b', 3]
    ]);
  });

  it('스타일을 못 바꾸는 레이어는 건너뛴다', () => {
    const lm = fakeManager([L('a', 'Polygon'), L('r', null, 'raster'), L('h', 'Point', 'heatmap')]);
    applyStyleToAll(['a', 'r', 'h', 'missing'], 'fillOpacity', 0.5, lm);
    expect(lm.calls).toEqual([['fillOpacity', 'a', 0.5]]);
  });
});
