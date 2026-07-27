// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { sampleColorRamp, lerpColor, hexToRgba } from './colorRamp.js';

// 등시선 램프 (IsochroneTool과 같은 6칸)
const RAMP = ['#ff0000', '#ff4500', '#ffa500', '#ffff00', '#90ee90', '#008000'];

describe('sampleColorRamp', () => {
  it('램프 칸 수보다 많이 뽑아도 색이 겹치지 않는다 (등시선 구간 7개 이상 회귀 방지)', () => {
    for (const n of [7, 10, 12, 20]) {
      const colors = sampleColorRamp(RAMP, n);
      expect(colors).toHaveLength(n);
      // 예전: 7번째부터 전부 같은 색이었다
      expect(new Set(colors).size).toBe(n);
    }
  });

  it('개수와 상관없이 램프 양 끝을 포함한다', () => {
    for (const n of [2, 3, 5, 6, 9]) {
      const colors = sampleColorRamp(RAMP, n);
      expect(colors[0]).toBe(RAMP[0]);
      expect(colors[n - 1]).toBe(RAMP[RAMP.length - 1]);
    }
  });

  it('램프 칸 수와 같으면 램프를 그대로 쓴다 (기존 6구간 색 유지)', () => {
    expect(sampleColorRamp(RAMP, RAMP.length)).toEqual(RAMP);
  });

  it('구간이 적어도 램프 한쪽만 쓰지 않는다', () => {
    // 예전: 3구간이면 앞 3칸(빨강 계열)만 나왔다
    const colors = sampleColorRamp(RAMP, 3);
    expect(colors).toEqual(['#ff0000', '#ffd200', '#008000']);
  });

  it('경계값을 안전하게 처리한다', () => {
    expect(sampleColorRamp(RAMP, 1)).toEqual(['#008000']);
    expect(sampleColorRamp(RAMP, 0)).toEqual([]);
    expect(sampleColorRamp([], 3)).toEqual([]);
    expect(sampleColorRamp(['#ff0000'], 3)).toEqual(['#ff0000', '#ff0000', '#ff0000']);
  });
});

describe('lerpColor', () => {
  it('양 끝과 중간을 보간한다', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('hexToRgba', () => {
  it('16진 색을 rgba 문자열로 바꾼다', () => {
    expect(hexToRgba('#ff4500', 0.6)).toBe('rgba(255, 69, 0, 0.6)');
  });
});
