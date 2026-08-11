// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { aggregateToGrid, estimateCellCount } from './gridAggregate.js';

/** EPSG:3857 미터 좌표의 점 */
const pt = (x, y, props = {}) => ({ x, y, props });

describe('aggregateToGrid — 격자 칸별 집계', () => {
  it('같은 칸에 든 점들을 한 칸으로 묶어 센다', () => {
    const cells = aggregateToGrid(
      [pt(10, 10), pt(500, 500), pt(999, 999)],
      { cellSize: 1000 }
    );

    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(3);
    expect(cells[0]).toMatchObject({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
  });

  it('칸 경계에 정확히 걸린 점은 오른쪽·위 칸으로 간다 (floor 규칙)', () => {
    const cells = aggregateToGrid([pt(999.9, 0), pt(1000, 0)], { cellSize: 1000 });

    expect(cells).toHaveLength(2);
    expect(cells.map(c => c.minX)).toEqual([0, 1000]);
  });

  it('격자 기준점은 좌표 원점이다 — 데이터를 한 칸만큼 옮기면 칸도 한 칸 밀린다', () => {
    // 데이터 최소 좌표를 기준으로 잡으면 두 결과의 격자가 어긋나 겹쳐 볼 수 없다
    const before = aggregateToGrid([pt(100, 100), pt(2100, 100)], { cellSize: 1000 });
    const after = aggregateToGrid([pt(1100, 1100), pt(3100, 1100)], { cellSize: 1000 });

    expect(before.map(c => [c.minX, c.minY])).toEqual([[0, 0], [2000, 0]]);
    expect(after.map(c => [c.minX, c.minY])).toEqual([[1000, 1000], [3000, 1000]]);
  });

  it('음수 좌표(서반구·남반구)도 원점 기준으로 칸을 나눈다', () => {
    const cells = aggregateToGrid([pt(-1, -1), pt(-1000, -1000)], { cellSize: 1000 });

    // -1과 -1000은 모두 floor(x/1000) = -1 칸이다
    expect(cells.map(c => [c.minX, c.minY])).toEqual([[-1000, -1000]]);
    expect(cells[0].count).toBe(2);
  });

  it('빈 칸은 결과에 넣지 않는다', () => {
    // 두 점이 10칸 떨어져 있어도 칸은 2개만 나온다
    const cells = aggregateToGrid([pt(100, 100), pt(10100, 100)], { cellSize: 1000 });

    expect(cells).toHaveLength(2);
  });

  it('합계(sum)는 지정한 필드를 더한다', () => {
    const cells = aggregateToGrid(
      [pt(10, 10, { pm10: 40 }), pt(20, 20, { pm10: 60 })],
      { cellSize: 1000, method: 'sum', field: 'pm10' }
    );

    expect(cells[0].value).toBe(100);
  });

  it('평균(avg)은 숫자로 읽히는 값만 센다', () => {
    const cells = aggregateToGrid(
      [pt(10, 10, { v: 40 }), pt(20, 20, { v: '60' }), pt(30, 30, { v: '-' })],
      { cellSize: 1000, method: 'avg', field: 'v' }
    );

    expect(cells[0].value).toBe(50);   // (40 + 60) / 2, '-'는 제외
    expect(cells[0].count).toBe(3);    // 개수는 점 전체
  });

  it('칸 안의 값을 하나도 못 읽으면 value는 null이다', () => {
    const cells = aggregateToGrid(
      [pt(10, 10, { v: '-' }), pt(20, 20, {})],
      { cellSize: 1000, method: 'avg', field: 'v' }
    );

    expect(cells[0].value).toBeNull();
  });

  it('개수 집계에서는 value가 count와 같다', () => {
    const cells = aggregateToGrid([pt(10, 10), pt(20, 20)], { cellSize: 1000, method: 'count' });

    expect(cells[0].value).toBe(2);
    expect(cells[0].count).toBe(2);
  });

  it('좌표가 숫자가 아닌 점은 건너뛴다', () => {
    const cells = aggregateToGrid(
      [pt(10, 10), pt(NaN, 10), pt(10, undefined)],
      { cellSize: 1000 }
    );

    expect(cells[0].count).toBe(1);
  });

  it('점이 없으면 빈 배열', () => {
    expect(aggregateToGrid([], { cellSize: 1000 })).toEqual([]);
  });

  it('셀 크기가 0 이하면 예외', () => {
    expect(() => aggregateToGrid([pt(0, 0)], { cellSize: 0 })).toThrow();
    expect(() => aggregateToGrid([pt(0, 0)], { cellSize: -100 })).toThrow();
  });

  it('점의 순서가 달라도 결과는 같다', () => {
    const a = aggregateToGrid([pt(100, 100), pt(2100, 100)], { cellSize: 1000 });
    const b = aggregateToGrid([pt(2100, 100), pt(100, 100)], { cellSize: 1000 });

    expect(a).toEqual(b);
  });

  it('결과 순서는 항상 같다 (아래→위, 왼쪽→오른쪽)', () => {
    const cells = aggregateToGrid(
      [pt(2100, 2100), pt(100, 100), pt(2100, 100)],
      { cellSize: 1000 }
    );

    expect(cells.map(c => [c.minX, c.minY])).toEqual([[0, 0], [2000, 0], [2000, 2000]]);
  });
});

describe('estimateCellCount — 그리기 전 칸 수 어림', () => {
  it('데이터 범위를 덮는 칸 수를 센다 (빈 칸까지 포함한 상한)', () => {
    // x는 0~2칸, y는 0~1칸 → 3 x 2 = 6
    const count = estimateCellCount([pt(100, 100), pt(2100, 1100)], 1000);

    expect(count).toBe(6);
  });

  it('실제로 만들어지는 칸 수보다 작지 않다', () => {
    const points = [pt(100, 100), pt(5100, 100), pt(100, 5100)];
    const estimated = estimateCellCount(points, 1000);
    const actual = aggregateToGrid(points, { cellSize: 1000 }).length;

    expect(estimated).toBeGreaterThanOrEqual(actual);
  });

  it('점이 없거나 셀 크기가 잘못되면 0', () => {
    expect(estimateCellCount([], 1000)).toBe(0);
    expect(estimateCellCount([pt(0, 0)], 0)).toBe(0);
  });

  it('좌표가 숫자가 아닌 점만 있으면 0', () => {
    expect(estimateCellCount([pt(NaN, NaN)], 1000)).toBe(0);
  });
});
