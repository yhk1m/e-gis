// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { computeRasterPixels, demColorAt, analysisColorAt } from './rasterPixels.js';
import { DEM_COLOR_RAMP } from './rasterColor.js';

// 2×2 그리드: [10, 20 / 30, 40], extent [0,0,2,2] (윗행이 북쪽)
const GRID = {
  data: new Float32Array([10, 20, 30, 40]),
  width: 2, height: 2,
  extent: [0, 0, 2, 2],
};

describe('computeRasterPixels', () => {
  it('view=extent, size=그리드 크기면 각 픽셀이 해당 셀 값으로 칠해진다', () => {
    const pixels = computeRasterPixels(GRID, [0, 0, 2, 2], [2, 2], (v) => [v, 0, 0]);
    // 픽셀 (0,0) = 북서 셀 = data[0] = 10
    expect(pixels[0]).toBe(10);
    expect(pixels[3]).toBe(255); // alpha
    // 픽셀 (1,1) = 남동 셀 = data[3] = 40
    const p = (1 * 2 + 1) * 4;
    expect(pixels[p]).toBe(40);
    expect(pixels[p + 3]).toBe(255);
  });

  it('colorAt이 null을 반환하면 투명 픽셀', () => {
    const pixels = computeRasterPixels(GRID, [0, 0, 2, 2], [2, 2],
      (v) => (v === 10 ? null : [1, 2, 3]));
    expect(pixels[3]).toBe(0);        // (0,0) 투명
    expect(pixels[7]).toBe(255);      // (1,0) 칠해짐
  });

  it('그리드 범위 밖 화면 영역은 투명', () => {
    // view가 그리드보다 넓음: 픽셀 (0,0)은 그리드 왼쪽 밖
    const pixels = computeRasterPixels(GRID, [-2, -2, 2, 2], [2, 2], () => [9, 9, 9]);
    expect(pixels[3]).toBe(0);        // (0,0) 밖 → 투명
    expect(pixels[7]).toBe(255);      // (1,0)은 그리드 안(북서 셀)
  });
});

describe('demColorAt', () => {
  const dem = { minVal: 0, maxVal: 700, noDataValue: -9999 };
  it('min→램프 시작색, max→흰색', () => {
    const colorAt = demColorAt(dem);
    expect(colorAt(0)).toEqual(DEM_COLOR_RAMP[0].color);
    expect(colorAt(700)).toEqual([255, 255, 255]);
  });
  it('노데이터/NaN/비유한은 null(투명)', () => {
    const colorAt = demColorAt(dem);
    expect(colorAt(-9999)).toBeNull();
    expect(colorAt(NaN)).toBeNull();
    expect(colorAt(Infinity)).toBeNull();
  });
});

describe('analysisColorAt', () => {
  it('filter 스킴은 fillColorRgb 단색(없으면 기본 빨강)', () => {
    expect(analysisColorAt({ colorScheme: 'filter', noDataValue: -9999, fillColorRgb: [1, 2, 3] })(5, 0))
      .toEqual([1, 2, 3]);
    expect(analysisColorAt({ colorScheme: 'filter', noDataValue: -9999 })(5, 0))
      .toEqual([227, 23, 10]);
  });
  it('value === -1은 마스크(투명)', () => {
    const colorAt = analysisColorAt({ colorScheme: 'slope', noDataValue: -9999, minVal: 0, maxVal: 45 });
    expect(colorAt(-1, 0)).toBeNull();
  });
  it('relief는 elevation 색에 음영을 곱한다(shade=1이면 그대로)', () => {
    const colorAt = analysisColorAt({
      colorScheme: 'relief', noDataValue: -9999, minVal: 0, maxVal: 100,
      shadeData: [1, 0],
    });
    expect(colorAt(0, 0)).toEqual([38, 115, 0]);       // shade 1 → 원색
    expect(colorAt(0, 1)).toEqual([13, 40, 0]);        // shade 0 → ×0.35
  });
  it('일반 스킴은 getColorForScheme에 위임(slope 0 → 녹색)', () => {
    const colorAt = analysisColorAt({ colorScheme: 'slope', noDataValue: -9999, minVal: 0, maxVal: 45 });
    expect(colorAt(0, 0)).toEqual([0, 128, 0]);
  });
});
