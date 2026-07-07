// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { isHexColor, contrastText, hexToRgb, DEFAULT_SLIDE_BG } from './color.js';

describe('hexToRgb', () => {
  it('#rrggbb → "r, g, b" (rgba용), 잘못된 값은 기본색', () => {
    expect(hexToRgb('#0b0f14')).toBe('11, 15, 20');
    expect(hexToRgb('#ffffff')).toBe('255, 255, 255');
    expect(hexToRgb('nope')).toBe('11, 15, 20');
  });
});

describe('isHexColor', () => {
  it('#rrggbb만 허용', () => {
    expect(isHexColor('#0b0f14')).toBe(true);
    expect(isHexColor('#FFFFFF')).toBe(true);
    expect(isHexColor('#fff')).toBe(false); // 3자리 미허용
    expect(isHexColor('white')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

describe('contrastText', () => {
  it('밝은 배경 → 어두운 글자, 어두운 배경 → 밝은 글자', () => {
    expect(contrastText('#ffffff')).toBe('#111111');
    expect(contrastText('#f8fafc')).toBe('#111111');
    expect(contrastText('#0b0f14')).toBe('#f8fafc');
    expect(contrastText('#1d4ed8')).toBe('#f8fafc'); // 진한 파랑 → 밝은 글자
  });
  it('잘못된 입력이면 밝은 글자', () => {
    expect(contrastText('nope')).toBe('#f8fafc');
  });
});

describe('DEFAULT_SLIDE_BG', () => {
  it('기존 다크 배경', () => {
    expect(DEFAULT_SLIDE_BG).toBe('#0b0f14');
  });
});
