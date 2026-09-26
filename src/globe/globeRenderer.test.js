// © 2026 김용현
/**
 * 무엇을 어떤 순서로 그리고, 무엇을 "지구본에 표시되지 않음" 으로 셀지.
 * 순서는 getAllLayers() 순서(아래→위)를 그대로 쓴다. 안 보이는 레이어는 세지도 않는다.
 */
import { describe, it, expect } from 'vitest';
import { buildDrawList, unsupportedReason, skippedSummary, paint } from './globeRenderer.js';
import { make } from './projections.js';

const vec = (id, extra = {}) => ({ id, name: id, type: 'vector', geometryType: 'Polygon', visible: true, source: {}, ...extra });

describe('unsupportedReason', () => {
  it('벡터·단계구분도·카토그램은 지원', () => {
    expect(unsupportedReason(vec('a'))).toBeNull();
    expect(unsupportedReason(vec('b', { type: 'choropleth', _choroplethConfig: {} }))).toBeNull();
    expect(unsupportedReason(vec('c', { _cartogramConfig: {} }))).toBeNull();
    expect(unsupportedReason(vec('d', { geometryType: 'Point' }))).toBeNull();
  });

  it('래스터·DEM·히트맵·도형표현도·흐름도는 이유를 돌려준다', () => {
    expect(unsupportedReason({ type: 'raster', geometryType: 'Raster' })).toBe('래스터');
    expect(unsupportedReason({ type: 'raster', demData: {} })).toBe('DEM');
    expect(unsupportedReason({ type: 'heatmap' })).toBe('히트맵');
    expect(unsupportedReason({ type: 'chartmap' })).toBe('도형표현도');
    expect(unsupportedReason({ type: 'flow' })).toBe('흐름도');
  });

  it('벡터 소스가 없는 레이어도 표시되지 않는다', () => {
    expect(unsupportedReason({ type: 'vector', geometryType: 'Polygon' })).toBe('벡터 아님');
  });
});

describe('buildDrawList', () => {
  it('순서를 지키고 안 보이는 것은 건너뛰며 지원 안 되는 것은 센다', () => {
    const layers = [
      vec('bottom'),
      vec('hidden', { visible: false }),
      { id: 'heat', name: '열지도', type: 'heatmap', visible: true },
      vec('top', { type: 'choropleth', _choroplethConfig: {} })
    ];
    const { items, skipped } = buildDrawList(layers);
    expect(items.map((l) => l.id)).toEqual(['bottom', 'top']);
    expect(skipped).toEqual([{ id: 'heat', name: '열지도', reason: '히트맵' }]);
  });

  it('안 보이는 미지원 레이어는 세지 않는다', () => {
    const { skipped } = buildDrawList([{ id: 'r', name: 'r', type: 'raster', visible: false }]);
    expect(skipped).toEqual([]);
  });
});

describe('skippedSummary', () => {
  it('비면 빈 문자열, 아니면 이름(이유) 목록', () => {
    expect(skippedSummary([])).toBe('');
    expect(skippedSummary([{ name: '열지도', reason: '히트맵' }, { name: '고도', reason: 'DEM' }]))
      .toBe('지구본에 표시되지 않음: 열지도(히트맵), 고도(DEM)');
  });
});

/** 메서드 호출을 (이름, 그때의 fillStyle) 로 적는 가짜 2D 컨텍스트 */
function recordingCtx() {
  const ops = [];
  const state = { fillStyle: null };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'ops') return ops;
      if (key in target) return target[key];
      return (...args) => { ops.push({ name: key, fillStyle: target.fillStyle, args }); };
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  return ctx;
}

describe('paint 배경', () => {
  const base = () => ({
    width: 800, height: 600, projection: make('orthographic', 800, 600),
    items: [], collections: new Map(), land: null,
    colors: { bg: '#eef2f7', ocean: '#dbeafe' }
  });

  it('구 밖을 colors.bg 로 먼저 칠해 오버레이가 2D 지도를 가린다', () => {
    const ctx = recordingCtx();
    paint(ctx, base());
    const firstFill = ctx.ops.findIndex((op) => op.name === 'fill' || op.name === 'fillRect');
    expect(ctx.ops[firstFill].name).toBe('fillRect');
    expect(ctx.ops[firstFill].fillStyle).toBe('#eef2f7');
    expect(ctx.ops[firstFill].args).toEqual([0, 0, 800, 600]);
  });

  it('transparent 면 배경을 칠하지 않는다(PNG 저장용)', () => {
    const ctx = recordingCtx();
    paint(ctx, { ...base(), transparent: true });
    expect(ctx.ops.some((op) => op.name === 'fillRect')).toBe(false);
    expect(ctx.ops.some((op) => op.name === 'fill' && op.fillStyle === '#dbeafe')).toBe(true);
  });
});
