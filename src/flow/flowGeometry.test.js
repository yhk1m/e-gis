// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { curvePoints, taperOutline, distanceToPolyline, offsetSegment, cumulativeLengths, pointAlong } from './flowGeometry.js';

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
  it('옵션 생략 시 기본 samples=24 → 25개 점', () => {
    expect(curvePoints([0, 0], [10, 0])).toHaveLength(25);
  });
  it('samples=0 은 1로 보정되어 NaN 없이 두 점을 낸다', () => {
    const pts = curvePoints([0, 0], [100, 0], { samples: 0 });
    expect(pts).toHaveLength(2);
    pts.forEach(([x, y]) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
    expect(pts[1]).toEqual([100, 0]);
  });
  it('samples 가 소수여도 반올림되어 마지막 점이 정확히 p1 이다', () => {
    const pts = curvePoints([0, 0], [100, 0], { samples: 2.5 });
    expect(pts[pts.length - 1]).toEqual([100, 0]);
  });
  it('굽는 방향은 진행 방향의 오른쪽으로 고정된다', () => {
    expect(curvePoints([0, 0], [100, 0], { samples: 2 })[1][1]).toBeGreaterThan(0);
    expect(curvePoints([0, 0], [0, 100], { samples: 2 })[1][0]).toBeLessThan(0);
  });
  it('bend=0.2 일 때 정점 오프셋(sag)은 현 길이의 0.1배다', () => {
    const apex = curvePoints([0, 0], [100, 0], { bend: 0.2, samples: 2 })[1];
    expect(apex[0]).toBeCloseTo(50);
    expect(apex[1]).toBeCloseTo(10);
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
  it('굽은 실제 곡선 위에서도 각 꼭짓점이 중심선으로부터 기대 반폭만큼 떨어져 있다', () => {
    const pts = curvePoints([0, 0], [100, 0], { bend: 0.2, samples: 24 });
    const w0 = 2;
    const w1 = 6;
    const poly = taperOutline(pts, w0, w1);
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const expectedHalf = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
      const outerVertex = poly[i];
      const innerVertex = poly[2 * n - 1 - i];
      expect(Math.abs(distanceToPolyline(outerVertex, pts) - expectedHalf)).toBeLessThan(0.01);
      expect(Math.abs(distanceToPolyline(innerVertex, pts) - expectedHalf)).toBeLessThan(0.01);
    }
  });
  it('시작=끝인 퇴화 곡선에서도 좌표가 모두 유한하다', () => {
    const poly = taperOutline(curvePoints([3, 3], [3, 3]), 1, 2);
    expect(poly.length).toBeGreaterThan(0);
    poly.forEach(([x, y]) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    });
  });
});

describe('distanceToPolyline', () => {
  it('선분까지의 최단 거리', () => {
    expect(distanceToPolyline([50, 5], [[0, 0], [100, 0]])).toBeCloseTo(5);
    expect(distanceToPolyline([-10, 0], [[0, 0], [100, 0]])).toBeCloseTo(10);
    expect(distanceToPolyline([1, 1], [[0, 0]])).toBeCloseTo(Math.SQRT2);
  });
  it('빈 폴리라인이면 Infinity', () => {
    expect(distanceToPolyline([1, 1], [])).toBe(Infinity);
  });
});

describe('offsetSegment', () => {
  it('진행 방향 오른쪽으로 offset 만큼 비키고, 반대 방향은 반대쪽으로 비킨다', () => {
    const [a, b] = offsetSegment([0, 0], [100, 0], 5);
    expect(a).toEqual([0, 5]);   // 동쪽 진행 → 오른쪽은 화면 아래(+y)
    expect(b).toEqual([100, 5]);
    const [c, d] = offsetSegment([100, 0], [0, 0], 5);
    expect(c).toEqual([100, -5]);
    expect(d).toEqual([0, -5]);
  });
  it('같은 점 둘이면 그대로', () => {
    expect(offsetSegment([3, 3], [3, 3], 5)).toEqual([[3, 3], [3, 3]]);
  });
});

describe('cumulativeLengths / pointAlong', () => {
  const pts = [[0, 0], [100, 0], [100, 50]];
  it('누적 길이는 0 에서 시작해 전체 길이로 끝난다', () => {
    expect(cumulativeLengths(pts)).toEqual([0, 100, 150]);
  });
  it('거리 d 지점과 진행 방향을 준다', () => {
    const cum = cumulativeLengths(pts);
    expect(pointAlong(pts, cum, 50)).toEqual({ x: 50, y: 0, tx: 1, ty: 0 });
    expect(pointAlong(pts, cum, 125)).toEqual({ x: 100, y: 25, tx: 0, ty: 1 });
    expect(pointAlong(pts, cum, 999).y).toBe(50);   // 끝으로 고정
    expect(pointAlong(pts, cum, -5).x).toBe(0);     // 시작으로 고정
  });
  it('점이 하나면 그 점', () => {
    expect(pointAlong([[3, 4]], [0], 10)).toEqual({ x: 3, y: 4, tx: 1, ty: 0 });
  });
});
