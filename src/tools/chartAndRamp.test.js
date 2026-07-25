// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { choroplethTool } from './ChoroplethTool.js';
import { chartMapTool } from './ChartMapTool.js';

const RAMP = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'];

describe('ChoroplethTool.sampleColorRamp', () => {
  it('분류 수와 상관없이 팔레트 양 끝 색을 포함한다', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const colors = choroplethTool.sampleColorRamp(RAMP, n);
      expect(colors).toHaveLength(n);
      expect(colors[0]).toBe(RAMP[0]);
      expect(colors[n - 1]).toBe(RAMP[RAMP.length - 1]);
    }
  });

  it('중간 색이 양 끝 사이에 고르게 분포한다 (밝기가 단조 감소)', () => {
    const lum = (hex) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);

    const colors = choroplethTool.sampleColorRamp(RAMP, 4);
    const steps = colors.slice(1).map((c, i) => lum(colors[i]) - lum(c));
    steps.forEach(step => expect(step).toBeGreaterThan(0));

    // 간격이 한쪽으로 쏠리지 않는다 (최대/최소 간격 차이가 2배 미만)
    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(2);
  });

  it('분류 수가 적어도 앞쪽 옅은 색만 쓰지 않는다 (예전 동작 회귀 방지)', () => {
    const colors = choroplethTool.sampleColorRamp(RAMP, 3);
    // 예전: colors[1], colors[3], colors[5] — 가장 진한 색이 빠졌다
    expect(colors[2]).toBe('#084594');
  });

  it('경계값을 안전하게 처리한다', () => {
    expect(choroplethTool.sampleColorRamp(RAMP, 1)).toEqual(['#084594']);
    expect(choroplethTool.sampleColorRamp(['#ff0000'], 3)).toEqual(['#ff0000', '#ff0000', '#ff0000']);
    expect(choroplethTool.sampleColorRamp([], 3)).toEqual([]);
  });
});

describe('ChartMapTool 단일 지표', () => {
  it('파이는 값이 하나면 조각이 아니라 원으로 그린다', () => {
    const svg = chartMapTool.createPieChart([42], ['pop'], 40, ['#3b82f6']);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<path');
    expect(svg).toContain('#3b82f6');
  });

  it('파이 수치 라벨은 지표가 1개면 값, 여러 개면 %', () => {
    expect(chartMapTool.createPieChart([1500], ['pop'], 40, ['#3b82f6'], true)).toContain('1.5K');
    expect(chartMapTool.createPieChart([10, 0], ['a', 'b'], 40, ['#3b82f6', '#ef4444'], true)).toContain('100%');
  });

  it('여러 지표 파이는 그대로 조각으로 그린다', () => {
    const svg = chartMapTool.createPieChart([3, 7], ['a', 'b'], 40, ['#3b82f6', '#ef4444']);
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<circle');
  });

  it('단일 막대는 값 막대 + 최댓값까지 남은 흰 막대로 이뤄진다', () => {
    const size = 40;
    const maxHeight = size - 4;
    const svg = chartMapTool.createSingleBarChart(50, 100, size, '#3b82f6');

    const rects = [...svg.matchAll(/<rect[^>]*?fill="([^"]+)"[^>]*?\/>/g)];
    const height = (fill) => {
      const m = svg.match(new RegExp(`<rect[^>]*height="([\\d.]+)"[^>]*fill="${fill}"`));
      return m ? parseFloat(m[1]) : null;
    };

    expect(rects).toHaveLength(2);
    expect(height('#3b82f6')).toBeCloseTo(maxHeight * 0.5, 5); // 값 막대
    expect(height('#fff')).toBeCloseTo(maxHeight * 0.5, 5);    // 최댓값까지 남은 칸
    expect(svg).toMatch(/fill="#fff" stroke="#333"/);          // 흰색 + 검은 테두리
  });

  it('최댓값인 피처는 막대만 그리고 흰 막대를 얹지 않는다', () => {
    const svg = chartMapTool.createSingleBarChart(100, 100, 40, '#3b82f6');
    expect(svg).toContain('#3b82f6');
    expect(svg).not.toContain('#fff');
  });

  it('단일 막대 너비는 값과 무관하게 같고 길이만 달라진다', () => {
    const dims = (svg) => ({
      w: parseFloat(svg.match(/width="([\d.]+)"/)[1]),
      h: parseFloat(svg.match(/height="([\d.]+)"/)[1])
    });
    // 크기 기준 필드로 size가 달라져도 너비는 refSize가 정한 값 그대로
    const small = dims(chartMapTool.createSingleBarChart(50, 100, 20, '#3b82f6', false, 40));
    const large = dims(chartMapTool.createSingleBarChart(50, 100, 60, '#3b82f6', false, 40));

    expect(small.w).toBe(large.w);
    expect(large.h).toBeGreaterThan(small.h);
  });

  it('단일 막대의 수치 라벨은 최댓값 대비 %이고 12px 이상이다', () => {
    const svg = chartMapTool.createSingleBarChart(25, 100, 40, '#3b82f6', true);
    expect(svg).toContain('25%');
    const fs = parseFloat(svg.match(/font-size="([\d.]+)"/)[1]);
    expect(fs).toBeGreaterThanOrEqual(12);
  });

  it('단일 막대의 수치 라벨은 막대를 가리지 않게 막대 위에 있다', () => {
    const svg = chartMapTool.createSingleBarChart(50, 100, 60, '#3b82f6', true);
    const textY = parseFloat(svg.match(/<text[^>]*\sy="([\d.]+)"/)[1]);
    const rectTops = [...svg.matchAll(/<rect[^>]*\sy="([\d.]+)"/g)].map(m => parseFloat(m[1]));
    expect(rectTops.length).toBeGreaterThan(0);
    expect(textY).toBeLessThan(Math.min(...rectTops));
  });

  it('막대 차트 너비는 피처 크기가 아니라 설정 크기(refSize)로 정해진다', () => {
    const widthOf = (svg) => parseFloat(svg.match(/width="([\d.]+)"/)[1]);
    const a = chartMapTool.createBarChart([10, 20], ['a', 'b'], 20, [100, 100], undefined, false, 40);
    const b = chartMapTool.createBarChart([10, 20], ['a', 'b'], 60, [100, 100], undefined, false, 40);
    expect(widthOf(a)).toBe(widthOf(b));
  });

  it('최댓값이 0이면 막대를 그리지 않는다', () => {
    expect(chartMapTool.createSingleBarChart(0, 0, 40, '#3b82f6')).toBe('');
  });
});
