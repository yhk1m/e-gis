// © 2026 김용현
/**
 * 구간 채움 계획(순수). 캔버스 없이 "무엇을 그릴지"만 검증한다.
 * - 정규화: 빠진 값은 기본값, 범위 밖은 잘라내고, 모르는 종류는 단색.
 * - 계획: 단색은 ops 없이 rgba, 패턴은 타일 크기·배경·잉크·마지막 alpha 가 맞다.
 * - 질감: 같은 시드면 같은 ops(지도·범례·내보내기가 같은 무늬).
 * - 프리셋: 구간이 높을수록 촘촘하다.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeFill, planFill, presetFills, mulberry32, fillSpecBytes, isSolid,
  FILL_KINDS, TEXTURE_NAMES, HATCH_ANGLES, PRESET_NAMES, TEXTURE_TILE
} from './classFill.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('normalizeFill', () => {
  it('없거나 모르는 종류는 단색', () => {
    expect(normalizeFill(undefined)).toEqual({ kind: 'solid' });
    expect(normalizeFill(null)).toEqual({ kind: 'solid' });
    expect(normalizeFill({ kind: 'zebra' })).toEqual({ kind: 'solid' });
    expect(isSolid({ kind: 'solid' })).toBe(true);
    expect(isSolid({ kind: 'hatch' })).toBe(false);
  });

  it('사선은 기본값을 채우고 각도는 넷 중 하나로', () => {
    expect(normalizeFill({ kind: 'hatch' })).toEqual({
      kind: 'hatch', angle: 45, spacing: 8, width: 2, color: '#333333', background: 'class'
    });
    expect(normalizeFill({ kind: 'hatch', angle: 30 }).angle).toBe(45);
    expect(normalizeFill({ kind: 'hatch', angle: 135 }).angle).toBe(135);
    expect(HATCH_ANGLES).toEqual([0, 45, 90, 135]);
  });

  it('범위를 벗어난 값은 잘라낸다', () => {
    const f = normalizeFill({ kind: 'dots', spacing: 99, radius: -1, color: 'red', background: 'blue' });
    expect(f).toEqual({ kind: 'dots', spacing: 24, radius: 0.5, color: '#333333', background: 'class' });
    expect(normalizeFill({ kind: 'cross', background: 'none' }).background).toBe('none');
    expect(normalizeFill({ kind: 'cross', background: '#ff0000' }).background).toBe('#ff0000');
  });

  it('이미지는 dataUrl 이 없으면 단색, 있으면 크기·배율·불투명도를 채운다', () => {
    expect(normalizeFill({ kind: 'image' })).toEqual({ kind: 'solid' });
    expect(normalizeFill({ kind: 'image', dataUrl: 'http://x/y.png' })).toEqual({ kind: 'solid' });
    expect(normalizeFill({ kind: 'image', dataUrl: PNG, width: 64, height: 32 })).toEqual({
      kind: 'image', dataUrl: PNG, width: 64, height: 32, scale: 1, opacity: 1
    });
    expect(normalizeFill({ kind: 'image', dataUrl: PNG, scale: 9 }).scale).toBe(4);
  });

  it('질감은 이름·강도', () => {
    expect(normalizeFill({ kind: 'texture' })).toEqual({ kind: 'texture', name: 'paper', strength: 0.5 });
    expect(normalizeFill({ kind: 'texture', name: 'lava', strength: 3 })).toEqual({ kind: 'texture', name: 'paper', strength: 1 });
    expect(TEXTURE_NAMES).toEqual(['paper', 'gloss', 'sand', 'forest', 'water']);
    expect(FILL_KINDS).toEqual(['solid', 'hatch', 'dots', 'cross', 'image', 'texture']);
  });
});

describe('planFill', () => {
  it('단색은 ops 없이 기준색 rgba', () => {
    const p = planFill({ kind: 'solid' }, '#ff0000', 0.7);
    expect(p).toEqual({ size: 0, background: 'rgba(255, 0, 0, 0.7)', fallback: 'rgba(255, 0, 0, 0.7)', ops: [] });
    expect(planFill(undefined, '#ff0000', 0.7)).toEqual(p);
  });

  it('기준색이 이상하면 회색으로', () => {
    expect(planFill(undefined, 'red', 1).background).toBe('rgba(128, 128, 128, 1)');
  });

  it('점: 타일 = 간격, 가운데 원 하나, 배경은 기준색, 마지막에 alpha', () => {
    const p = planFill({ kind: 'dots', spacing: 10, radius: 2 }, '#112233', 0.5);
    expect(p.size).toEqual([10, 10]);
    expect(p.background).toBe('#112233');
    expect(p.fallback).toBe('rgba(17, 34, 51, 0.5)');
    expect(p.ops).toEqual([
      { op: 'circle', x: 5, y: 5, r: 2, color: '#333333' },
      { op: 'alpha', value: 0.5 }
    ]);
  });

  it('배경 none 은 배경 없음·fallback 은 투명, 직접 색은 그 색', () => {
    expect(planFill({ kind: 'dots', background: 'none' }, '#112233', 1).background).toBeNull();
    expect(planFill({ kind: 'dots', background: 'none' }, '#112233', 1).fallback).toBe('rgba(0, 0, 0, 0)');
    expect(planFill({ kind: 'dots', background: '#ffffff' }, '#112233', 1).background).toBe('#ffffff');
  });

  it('pixelScale 은 간격·굵기·반지름을 같이 키운다', () => {
    const p = planFill({ kind: 'dots', spacing: 8, radius: 1.5 }, '#112233', 1, { pixelScale: 2 });
    expect(p.size).toEqual([16, 16]);
    expect(p.ops[0].r).toBe(3);
  });

  it('격자: 가로·세로 선 하나씩', () => {
    const p = planFill({ kind: 'cross', spacing: 8, width: 1 }, '#112233', 1);
    expect(p.ops.filter((o) => o.op === 'line')).toEqual([
      { op: 'line', x1: 0, y1: 4, x2: 8, y2: 4, color: '#333333', width: 1 },
      { op: 'line', x1: 4, y1: 0, x2: 4, y2: 8, color: '#333333', width: 1 }
    ]);
  });

  it('사선 0·90 은 타일 = 간격에 선 하나, 45·135 는 타일 = 간격×√2 에 선 셋', () => {
    const h0 = planFill({ kind: 'hatch', angle: 0, spacing: 8, width: 2 }, '#112233', 1);
    expect(h0.size).toEqual([8, 8]);
    expect(h0.ops[0]).toEqual({ op: 'line', x1: 0, y1: 4, x2: 8, y2: 4, color: '#333333', width: 2 });
    const h90 = planFill({ kind: 'hatch', angle: 90, spacing: 8, width: 2 }, '#112233', 1);
    expect(h90.ops[0]).toEqual({ op: 'line', x1: 4, y1: 0, x2: 4, y2: 8, color: '#333333', width: 2 });

    const h45 = planFill({ kind: 'hatch', angle: 45, spacing: 8, width: 2 }, '#112233', 1);
    expect(h45.size).toEqual([11, 11]);
    const lines = h45.ops.filter((o) => o.op === 'line');
    expect(lines).toHaveLength(3);
    // x + y = T 가 가운데 선: (0,T)→(T,0) 를 굵기만큼 늘린 것
    expect(lines[1]).toEqual({ op: 'line', x1: -2, y1: 13, x2: 13, y2: -2, color: '#333333', width: 2 });

    const h135 = planFill({ kind: 'hatch', angle: 135, spacing: 8, width: 2 }, '#112233', 1);
    const l135 = h135.ops.filter((o) => o.op === 'line');
    // x - y = 0 이 가운데 선: (0,0)→(T,T)
    expect(l135[1]).toEqual({ op: 'line', x1: -2, y1: -2, x2: 13, y2: 13, color: '#333333', width: 2 });
  });

  it('이미지: 타일 = 크기×배율×pixelScale, 배경 없음, image 뒤 alpha', () => {
    const p = planFill({ kind: 'image', dataUrl: PNG, width: 100, height: 50, scale: 0.5, opacity: 0.8 }, '#112233', 0.6, { pixelScale: 2 });
    expect(p.size).toEqual([100, 50]);
    expect(p.background).toBeNull();
    expect(p.fallback).toBe('rgba(17, 34, 51, 0.6)');
    expect(p.ops).toEqual([
      { op: 'image', dataUrl: PNG, x: 0, y: 0, w: 100, h: 50, opacity: 0.8 },
      { op: 'alpha', value: 0.6 }
    ]);
  });

  it('질감: 흰 바탕 + 표식 + multiply 틴트 + alpha, 같은 시드는 같은 결과', () => {
    const a = planFill({ kind: 'texture', name: 'paper', strength: 0.5 }, '#3366cc', 0.7);
    const b = planFill({ kind: 'texture', name: 'paper', strength: 0.5 }, '#3366cc', 0.7);
    expect(a).toEqual(b);
    expect(a.size).toEqual([TEXTURE_TILE, TEXTURE_TILE]);
    expect(a.background).toBe('#ffffff');
    expect(a.ops.at(-2)).toEqual({ op: 'tint', color: '#3366cc', alpha: 1 });
    expect(a.ops.at(-1)).toEqual({ op: 'alpha', value: 0.7 });
    expect(a.ops.length).toBeGreaterThan(50);

    const c = planFill({ kind: 'texture', name: 'paper', strength: 0.5 }, '#3366cc', 0.7, { seed: 99 });
    expect(c.ops).not.toEqual(a.ops);
  });

  it('질감 다섯 가지가 모두 계획을 내고 강도 0 이면 표식이 보이지 않는다', () => {
    for (const name of TEXTURE_NAMES) {
      const p = planFill({ kind: 'texture', name, strength: 0.5 }, '#3366cc', 1);
      expect(p.ops.length).toBeGreaterThan(2);
      const zero = planFill({ kind: 'texture', name, strength: 0 }, '#3366cc', 1);
      const inks = zero.ops.filter((o) => o.op !== 'tint' && o.op !== 'alpha').map((o) => o.color);
      inks.forEach((c) => expect(c).toMatch(/, 0\)$|, 0\.000\)$/));
    }
  });

  it('광택은 바탕이 회색이고 흰 띠를 그린다', () => {
    const p = planFill({ kind: 'texture', name: 'gloss', strength: 1 }, '#3366cc', 1);
    expect(p.background).toBe('#cfcfcf');
    expect(p.ops.some((o) => o.op === 'line' && o.color.startsWith('rgba(255, 255, 255'))).toBe(true);
  });

  it('광택 띠는 x + y = c 사선이고 띠마다 c 가 타일 한 변씩 어긋나 이음매 없이 이어진다', () => {
    const p = planFill({ kind: 'texture', name: 'gloss', strength: 1 }, '#3366cc', 1);
    const T = p.size[0];
    const lines = p.ops.filter((o) => o.op === 'line');
    expect(lines.length % 3).toBe(0);
    lines.forEach((l) => expect(l.x1 + l.y1).toBeCloseTo(l.x2 + l.y2, 9));
    for (let b = 0; b < lines.length; b += 3) {
      const cs = lines.slice(b, b + 3).map((l) => l.x1 + l.y1);
      expect(cs[1] - cs[0]).toBeCloseTo(T, 9);
      expect(cs[2] - cs[1]).toBeCloseTo(T, 9);
    }
  });

  it('광택 강도 0 이면 바탕이 흰색이라 틴트 뒤 정확히 기준색', () => {
    expect(planFill({ kind: 'texture', name: 'gloss', strength: 0 }, '#3366cc').background).toBe('#ffffff');
  });
});

describe('mulberry32', () => {
  it('같은 시드는 같은 수열, 0 이상 1 미만', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    xs.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
    expect(mulberry32(43)()).not.toBe(xs[0]);
  });
});

describe('presetFills', () => {
  it('bw-hatch 는 높은 구간일수록 간격이 좁고 배경이 없다', () => {
    const fills = presetFills('bw-hatch', 5);
    expect(fills).toHaveLength(5);
    fills.forEach((f) => { expect(f.kind).toBe('hatch'); expect(f.background).toBe('none'); expect(f.color).toBe('#222222'); });
    expect(fills[0].spacing).toBe(20);
    expect(fills[4].spacing).toBe(6);
    expect(fills[2].spacing).toBeLessThan(fills[1].spacing);
  });

  it('dots-density 는 점 간격이 좁아지고 구간 색을 깐다', () => {
    const fills = presetFills('dots-density', 3);
    expect(fills.map((f) => f.kind)).toEqual(['dots', 'dots', 'dots']);
    expect(fills.map((f) => f.spacing)).toEqual([18, 12, 6]);
    expect(fills[0].background).toBe('class');
  });

  it('texture-uniform 은 전부 종이 질감, 구간 하나면 가장 촘촘, 모르는 이름은 null', () => {
    expect(presetFills('texture-uniform', 2)).toEqual([
      { kind: 'texture', name: 'paper', strength: 0.5 },
      { kind: 'texture', name: 'paper', strength: 0.5 }
    ]);
    expect(presetFills('bw-hatch', 1)[0].spacing).toBe(6);
    expect(presetFills('nope', 3)).toBeNull();
    expect(PRESET_NAMES).toEqual(['bw-hatch', 'dots-density', 'texture-uniform']);
  });

  it('개수가 NaN·undefined 면 구간 하나로 본다', () => {
    expect(presetFills('bw-hatch', NaN)).toHaveLength(1);
    expect(presetFills('dots-density', undefined)).toHaveLength(1);
  });
});

describe('fillSpecBytes', () => {
  it('이미지만 크기를 세고 나머지는 0', () => {
    expect(fillSpecBytes({ kind: 'hatch' })).toBe(0);
    expect(fillSpecBytes({ kind: 'image', dataUrl: 'data:image/png;base64,' + 'A'.repeat(4000) })).toBe(3000);
  });
});
