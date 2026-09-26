// © 2026 김용현
/**
 * 스와이프 비교의 순수 계산.
 * - 클립 사각형: 세로 막대면 왼쪽 ratio 만큼, 가로 막대면 위쪽 ratio 만큼 (CSS 픽셀, 시계 방향 네 모서리)
 * - 포인터 → 비율: 지도 사각형 밖으로 나가도 0~1 로 잘린다
 * - 막대 위치 스타일: 비율을 % 로
 * - 대상 목록: 레이어 전부 + 현재가 아닌 배경지도(hidden 묶음 제외)
 */
import { describe, it, expect } from 'vitest';
import {
  clampRatio, swipeClipCorners, ratioFromPointer, dividerStyle, swipeTargetOptions, parseTargetValue
} from './swipeMath.js';

describe('clampRatio', () => {
  it('0~1 로 자르고 숫자가 아니면 0.5', () => {
    expect(clampRatio(-0.2)).toBe(0);
    expect(clampRatio(1.7)).toBe(1);
    expect(clampRatio(0.3)).toBe(0.3);
    expect(clampRatio(NaN)).toBe(0.5);
    expect(clampRatio(undefined)).toBe(0.5);
  });
});

describe('swipeClipCorners', () => {
  it('세로 막대: 왼쪽 ratio 만큼', () => {
    expect(swipeClipCorners([800, 600], 0.25, 'vertical')).toEqual([[0, 0], [200, 0], [200, 600], [0, 600]]);
  });

  it('가로 막대: 위쪽 ratio 만큼', () => {
    expect(swipeClipCorners([800, 600], 0.5, 'horizontal')).toEqual([[0, 0], [800, 0], [800, 300], [0, 300]]);
  });

  it('비율 0 과 1 은 빈 사각형·전체', () => {
    expect(swipeClipCorners([800, 600], 0, 'vertical')).toEqual([[0, 0], [0, 0], [0, 600], [0, 600]]);
    expect(swipeClipCorners([800, 600], 1, 'vertical')).toEqual([[0, 0], [800, 0], [800, 600], [0, 600]]);
  });

  it('크기가 없으면 빈 사각형', () => {
    expect(swipeClipCorners(null, 0.5, 'vertical')).toEqual([[0, 0], [0, 0], [0, 0], [0, 0]]);
    expect(swipeClipCorners(undefined, 0.5, 'horizontal')).toEqual([[0, 0], [0, 0], [0, 0], [0, 0]]);
  });
});

describe('ratioFromPointer', () => {
  const rect = { left: 100, top: 50, width: 800, height: 600 };

  it('세로 막대는 x, 가로 막대는 y 를 본다', () => {
    expect(ratioFromPointer({ clientX: 300, clientY: 350 }, rect, 'vertical')).toBe(0.25);
    expect(ratioFromPointer({ clientX: 300, clientY: 350 }, rect, 'horizontal')).toBe(0.5);
  });

  it('사각형 밖은 0~1 로 잘린다', () => {
    expect(ratioFromPointer({ clientX: 0, clientY: 0 }, rect, 'vertical')).toBe(0);
    expect(ratioFromPointer({ clientX: 5000, clientY: 0 }, rect, 'vertical')).toBe(1);
    expect(ratioFromPointer({ clientX: 0, clientY: 9999 }, rect, 'horizontal')).toBe(1);
  });

  it('폭이 0 이면 0.5', () => {
    expect(ratioFromPointer({ clientX: 10, clientY: 10 }, { left: 0, top: 0, width: 0, height: 0 }, 'vertical')).toBe(0.5);
  });
});

describe('dividerStyle', () => {
  it('세로 막대는 left 만, 가로 막대는 top 만 움직인다', () => {
    expect(dividerStyle(0.25, 'vertical')).toEqual({ left: '25%', top: '0' });
    expect(dividerStyle(0.4, 'horizontal')).toEqual({ left: '0', top: '40%' });
  });
});

describe('swipeTargetOptions', () => {
  const layers = [
    { id: 'l-1', name: '시도' },
    { id: 'l-2', name: '도로' }
  ];
  const basemaps = [
    { key: 'VW_BASE', label: '일반', group: 'korea' },
    { key: 'OSM', label: 'OSM 표준', group: 'world' },
    { key: 'SATELLITE', label: '위성 (Esri)', group: 'world' },
    { key: 'NONE', label: '없음', group: 'hidden' }
  ];

  it('레이어는 위에 있는 것부터, 배경지도는 현재와 hidden 을 뺀다', () => {
    expect(swipeTargetOptions(layers, basemaps, 'OSM')).toEqual([
      { value: 'layer:l-2', label: '도로', group: 'layer' },
      { value: 'layer:l-1', label: '시도', group: 'layer' },
      { value: 'basemap:VW_BASE', label: 'VWorld 일반', group: 'basemap' },
      { value: 'basemap:SATELLITE', label: '위성 (Esri)', group: 'basemap' }
    ]);
  });

  it('레이어가 없어도 배경지도만으로 목록이 된다', () => {
    const opts = swipeTargetOptions([], basemaps, 'SATELLITE');
    expect(opts.map((o) => o.value)).toEqual(['basemap:VW_BASE', 'basemap:OSM']);
  });

  it('둘 다 없으면 빈 배열', () => {
    expect(swipeTargetOptions([], [{ key: 'OSM', label: 'OSM', group: 'world' }], 'OSM')).toEqual([]);
  });

  it('히트맵(WebGL) 레이어는 목록에 넣지 않는다', () => {
    const withHeatmap = [
      { id: 'l-1', name: '시도', type: 'vector' },
      { id: 'l-h', name: '시도_히트맵', type: 'heatmap' }
    ];
    const opts = swipeTargetOptions(withHeatmap, [], 'OSM');
    expect(opts.map((o) => o.value)).toEqual(['layer:l-1']);
  });

  it('흐름도(자체 렌더러) 레이어도 목록에 넣지 않는다', () => {
    const withFlow = [
      { id: 'l-1', name: '시도', type: 'vector' },
      { id: 'l-f', name: '통근 흐름', type: 'flow' }
    ];
    expect(swipeTargetOptions(withFlow, [], 'OSM').map((o) => o.value)).toEqual(['layer:l-1']);
  });

  it('이름이 비면 id 를 라벨로 쓴다', () => {
    const opts = swipeTargetOptions([{ id: 'l-9', name: '' }], [], 'OSM');
    expect(opts).toEqual([{ value: 'layer:l-9', label: 'l-9', group: 'layer' }]);
  });
});

describe('parseTargetValue', () => {
  it('layer:<id> 와 basemap:<key> 를 푼다', () => {
    expect(parseTargetValue('layer:layer-123-abc')).toEqual({ kind: 'layer', id: 'layer-123-abc' });
    expect(parseTargetValue('basemap:VW_BASE')).toEqual({ kind: 'basemap', id: 'VW_BASE' });
  });

  it('모양이 아니면 null', () => {
    expect(parseTargetValue('')).toBeNull();
    expect(parseTargetValue('layer:')).toBeNull();
    expect(parseTargetValue('raster:x')).toBeNull();
    expect(parseTargetValue(null)).toBeNull();
  });
});
