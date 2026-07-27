// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { strokeWidthOf, makeStroke } from './strokeStyle.js';

describe('strokeWidthOf', () => {
  it('0을 기본값으로 되돌리지 않는다 (테두리 없음이 사라지던 회귀 방지)', () => {
    expect(strokeWidthOf({ strokeWidth: 0 }, 2)).toBe(0);
  });

  it('값이 없으면 기본값을 쓴다', () => {
    expect(strokeWidthOf({}, 2)).toBe(2);
    expect(strokeWidthOf({ strokeWidth: undefined }, 0.8)).toBe(0.8);
  });

  it('지정한 두께를 그대로 돌려준다', () => {
    expect(strokeWidthOf({ strokeWidth: 4.5 }, 2)).toBe(4.5);
  });
});

describe('makeStroke', () => {
  it('두께가 0이면 Stroke를 만들지 않는다', () => {
    // 캔버스는 lineWidth 0을 무시하고 직전 값을 쓴다 — 넘기면 안 된다
    expect(makeStroke({ color: '#000', width: 0 })).toBeUndefined();
  });

  it('두께가 있으면 Stroke를 만든다', () => {
    const stroke = makeStroke({ color: '#ff0000', width: 3 });
    expect(stroke.getWidth()).toBe(3);
    expect(stroke.getColor()).toBe('#ff0000');
  });
});
