// © 2026 김용현
import { describe, it, expect } from 'vitest';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat } from 'ol/proj';
import { measureTool } from './MeasureTool.js';

/** 서울 부근에서 한 변이 대략 주어진 도(degree)인 사각형 */
function square(deg) {
  const ring = [
    [127.0, 37.0], [127.0 + deg, 37.0], [127.0 + deg, 37.0 + deg], [127.0, 37.0 + deg], [127.0, 37.0]
  ].map(c => fromLonLat(c));
  return new Polygon([ring]);
}

describe('MeasureTool.leftClickOnly — 우클릭은 완료 전용', () => {
  const evt = (button) => ({ originalEvent: { button } });

  it('좌클릭(0)은 점으로 인정한다', () => {
    expect(measureTool.leftClickOnly(evt(0))).toBe(true);
  });

  it('우클릭(2)은 무시한다 — 완료 직후 다음 측정이 시작되던 원인', () => {
    expect(measureTool.leftClickOnly(evt(2))).toBe(false);
  });

  it('가운데 버튼(1)도 무시한다', () => {
    expect(measureTool.leftClickOnly(evt(1))).toBe(false);
  });

  it('원본 이벤트가 없으면 막지 않는다 (터치 등)', () => {
    expect(measureTool.leftClickOnly({})).toBe(true);
    expect(measureTool.leftClickOnly({ originalEvent: {} })).toBe(true);
  });
});

describe('MeasureTool.formatArea', () => {
  it('1㎢ 이상은 ㎢로 표시한다', () => {
    // 0.02° ≒ 1.8km × 2.2km ≒ 4km²
    expect(measureTool.formatArea(square(0.02))).toMatch(/km²$/);
  });

  it('1㎢ 미만은 ㎡로 표시한다', () => {
    // 0.001° ≒ 89m × 111m ≒ 9,900m²
    expect(measureTool.formatArea(square(0.001))).toMatch(/m²$/);
  });

  it('헥타르는 쓰지 않는다 (면적 단위는 ㎡·㎢로 통일)', () => {
    [0.0005, 0.001, 0.005, 0.01, 0.05].forEach(deg => {
      expect(measureTool.formatArea(square(deg))).not.toMatch(/ha/);
    });
  });
});
