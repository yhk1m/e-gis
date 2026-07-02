// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { demColor, hypsometricColor, hslToRgb, getColorForScheme } from './rasterColor.js';

describe('demColor (DEM 8스톱 램프)', () => {
  it('0은 램프 시작(진녹)', () => {
    expect(demColor(0)).toEqual([0, 97, 71]);
  });
  it('1은 흰색(고산)', () => {
    expect(demColor(1)).toEqual([255, 255, 255]);
  });
  it('스톱 사이는 선형 보간(0.075 = 0~0.15의 중점)', () => {
    expect(demColor(0.075)).toEqual([17, 118, 53]);
  });
  it('범위 밖은 양끝으로 클램프', () => {
    expect(demColor(-0.5)).toEqual([0, 97, 71]);
    expect(demColor(1.5)).toEqual([255, 255, 255]);
  });
});

describe('hypsometricColor', () => {
  it('정지점 색을 그대로 반환한다(0/0.5/1)', () => {
    expect(hypsometricColor(0)).toEqual([38, 115, 0]);
    expect(hypsometricColor(0.5)).toEqual([240, 220, 130]);
    expect(hypsometricColor(1)).toEqual([245, 245, 245]);
  });
});

describe('hslToRgb', () => {
  it('h=0, s=70, l=50 → 빨강 계열', () => {
    expect(hslToRgb(0, 70, 50)).toEqual([217, 38, 38]);
  });
});

describe('getColorForScheme', () => {
  it('grayscale은 값 그대로 회색조', () => {
    expect(getColorForScheme(128, 'grayscale')).toEqual([128, 128, 128]);
  });
  it('elevation은 min~max 정규화 후 hypsometric', () => {
    expect(getColorForScheme(0, 'elevation', 0, 100)).toEqual([38, 115, 0]);
    expect(getColorForScheme(100, 'elevation', 0, 100)).toEqual([245, 245, 245]);
  });
  it('slope 최소값은 녹색 [0,128,0]', () => {
    expect(getColorForScheme(0, 'slope', 0, 45)).toEqual([0, 128, 0]);
  });
  it('aspect는 방위각 → HSL 색', () => {
    expect(getColorForScheme(90, 'aspect')).toEqual([128, 217, 38]);
  });
  it('알 수 없는 스킴은 회색', () => {
    expect(getColorForScheme(10, 'nope')).toEqual([128, 128, 128]);
  });
});
