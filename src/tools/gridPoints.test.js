// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { featuresToPoints, resolveCellSize, numericFields, MIN_CELL_SIZE } from './gridPoints.js';

/** ol/Feature 대역 */
function fakeFeature(type, coordinates, props = {}) {
  return {
    getGeometry: () => ({ getType: () => type, getCoordinates: () => coordinates }),
    getProperties: () => ({ geometry: '도형객체', ...props })
  };
}

describe('featuresToPoints', () => {
  it('점 피처에서 좌표와 속성을 뽑는다', () => {
    const f = fakeFeature('Point', [100, 200], { 이름: '가게', 매출: 30 });
    expect(featuresToPoints([f])).toEqual([
      { x: 100, y: 200, props: { 이름: '가게', 매출: 30 } }
    ]);
  });

  it('geometry 속성은 빼고 담는다', () => {
    const [point] = featuresToPoints([fakeFeature('Point', [1, 2], { 이름: '가' })]);
    expect(point.props).not.toHaveProperty('geometry');
  });

  it('MultiPoint 는 점마다 하나씩 센다', () => {
    const f = fakeFeature('MultiPoint', [[1, 2], [3, 4]], { 이름: '두곳' });
    const points = featuresToPoints([f]);
    expect(points).toHaveLength(2);
    expect(points.map(p => [p.x, p.y])).toEqual([[1, 2], [3, 4]]);
  });

  it('점이 아닌 도형은 건너뛴다', () => {
    const line = fakeFeature('LineString', [[0, 0], [1, 1]]);
    const polygon = fakeFeature('Polygon', [[[0, 0], [1, 0], [1, 1], [0, 0]]]);
    expect(featuresToPoints([line, polygon])).toEqual([]);
  });

  it('좌표가 숫자가 아니면 건너뛴다', () => {
    const bad = fakeFeature('Point', ['x', null]);
    const good = fakeFeature('Point', [5, 6]);
    expect(featuresToPoints([bad, good])).toEqual([{ x: 5, y: 6, props: {} }]);
  });

  it('빈 입력에도 안전하다', () => {
    expect(featuresToPoints([])).toEqual([]);
    expect(featuresToPoints(null)).toEqual([]);
    expect(featuresToPoints([null, undefined, {}])).toEqual([]);
  });
});

describe('resolveCellSize', () => {
  it('고른 값을 쓴다', () => {
    expect(resolveCellSize('1000', '')).toEqual({ cellSize: 1000 });
  });

  it("'직접 입력'이면 타이핑한 값을 쓴다", () => {
    expect(resolveCellSize('', '2000')).toEqual({ cellSize: 2000 });
  });

  it('비어 있으면 안내한다', () => {
    expect(resolveCellSize('', '')).toHaveProperty('error');
    expect(resolveCellSize('', '   ')).toHaveProperty('error');
  });

  it('숫자가 아니거나 0 이하면 막는다', () => {
    expect(resolveCellSize('', '가나다')).toHaveProperty('error');
    expect(resolveCellSize('', '0')).toHaveProperty('error');
    expect(resolveCellSize('', '-100')).toHaveProperty('error');
  });

  it('너무 잘게 쪼개면 막는다 (칸 수가 폭발한다)', () => {
    expect(resolveCellSize('', String(MIN_CELL_SIZE - 1))).toHaveProperty('error');
    expect(resolveCellSize('', String(MIN_CELL_SIZE))).toEqual({ cellSize: MIN_CELL_SIZE });
  });
});

describe('numericFields', () => {
  it('숫자로 읽히는 속성만 고른다', () => {
    const points = [{ props: { 이름: '가게', 매출: 30, 주소: '서울시' } }];
    expect(numericFields(points)).toEqual(['매출']);
  });

  it('문자열 숫자도 후보로 본다', () => {
    expect(numericFields([{ props: { 인구: '1234' } }])).toEqual(['인구']);
  });

  it('결측이 섞여 있어도 한 점이라도 숫자면 후보다', () => {
    const points = [{ props: { 매출: '-' } }, { props: { 매출: 50 } }];
    expect(numericFields(points)).toEqual(['매출']);
  });

  it('빈 값만 있는 속성은 제외한다', () => {
    expect(numericFields([{ props: { 비고: '', 메모: null } }])).toEqual([]);
  });
});
