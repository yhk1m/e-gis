// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { curvePoints, taperOutline, distanceToPolyline } from './flowGeometry.js';

describe('curvePoints', () => {
  it('양 끝은 입력점이고 samples+1 개를 돌려준다', () => {
    const pts = curvePoints([0, 0], [100, 0], { samples: 10 });
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([100, 0]);
  });
  it('A→B 와 B→A 는 현의 서로 반대편으로 굽는다', () => {
    const ab = curvePoints([0, 0], [100, 0], { samples: 10 })[5];
    const ba = curvePoints([100, 0], [0, 0], { samples: 10 })[5];
    expect(Math.sign(ab[1])).toBe(-Math.sign(ba[1]));
    expect(Math.abs(ab[1])).toBeGreaterThan(5);
  });
  it('같은 점 둘이면 예외 없이 두 점만 돌려준다', () => {
    expect(curvePoints([3, 3], [3, 3])).toEqual([[3, 3], [3, 3]]);
  });
});

describe('taperOutline', () => {
  it('점 수의 두 배인 닫힌 다각형을 만들고 폭이 w0→w1 로 변한다', () => {
    const pts = [[0, 0], [50, 0], [100, 0]];
    const poly = taperOutline(pts, 2, 10);
    expect(poly).toHaveLength(6);
    // 출발 쪽 폭 2 (좌우 ±1), 도착 쪽 폭 10 (좌우 ±5)
    expect(Math.abs(poly[0][1] - poly[5][1])).toBeCloseTo(2);
    expect(Math.abs(poly[2][1] - poly[3][1])).toBeCloseTo(10);
  });
  it('점이 하나면 빈 배열', () => {
    expect(taperOutline([[0, 0]], 1, 2)).toEqual([]);
  });
});

describe('distanceToPolyline', () => {
  it('선분까지의 최단 거리', () => {
    expect(distanceToPolyline([50, 5], [[0, 0], [100, 0]])).toBeCloseTo(5);
    expect(distanceToPolyline([-10, 0], [[0, 0], [100, 0]])).toBeCloseTo(10);
    expect(distanceToPolyline([1, 1], [[0, 0]])).toBeCloseTo(Math.SQRT2);
  });
});
