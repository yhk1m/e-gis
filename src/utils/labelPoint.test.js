// © 2026 김용현
import { describe, it, expect } from 'vitest';
import Polygon from 'ol/geom/Polygon.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Point from 'ol/geom/Point.js';
import { largestPolygon, labelPoint } from './labelPoint.js';

/** [minX,minY]~[maxX,maxY] 사각형 링 */
const box = (minX, minY, maxX, maxY) => [[
  [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]
]];

const ISLAND = box(0, 0, 1, 1);        // 작은 섬
const MAINLAND = box(10, 10, 30, 30);  // 본토

const inMainland = (pt) => pt[0] > 10 && pt[0] < 30 && pt[1] > 10 && pt[1] < 30;

describe('labelPoint — 라벨은 본토(가장 큰 조각)에 붙는다', () => {
  it('폴리곤은 자기 내부의 점을 준다', () => {
    const pt = labelPoint(new Polygon(MAINLAND));
    expect(inMainland(pt)).toBe(true);
  });

  it('멀티폴리곤은 가장 큰 조각을 고른다 — 섬이 배열 첫 번째여도', () => {
    // 예전에는 polygons[0](= 섬)의 경계상자 중심을 썼다. 전남·인천처럼
    // 부속 도서가 앞에 오는 데이터에서 라벨이 바다 위 섬에 찍혔다.
    const pt = labelPoint(new MultiPolygon([ISLAND, MAINLAND]));
    expect(inMainland(pt)).toBe(true);
  });

  it('조각 순서가 반대여도 결과가 같다', () => {
    const a = labelPoint(new MultiPolygon([ISLAND, MAINLAND]));
    const b = labelPoint(new MultiPolygon([MAINLAND, ISLAND]));
    expect(a).toEqual(b);
  });

  it('섬이 여러 개여도 본토를 고른다', () => {
    const pt = labelPoint(new MultiPolygon([
      box(0, 0, 1, 1), box(2, 0, 3, 1), box(4, 0, 5, 2), MAINLAND, box(6, 0, 7, 1)
    ]));
    expect(inMainland(pt)).toBe(true);
  });

  it('largestPolygon은 본토 폴리곤을 돌려준다', () => {
    const poly = largestPolygon(new MultiPolygon([ISLAND, MAINLAND]));
    expect(poly.getType()).toBe('Polygon');
    expect(poly.getExtent()).toEqual([10, 10, 30, 30]);
  });

  it('폴리곤이 아닌 지오메트리·빈 값은 null', () => {
    expect(labelPoint(new Point([1, 2]))).toBeNull();
    expect(labelPoint(null)).toBeNull();
    expect(largestPolygon(new MultiPolygon([]))).toBeNull();
  });

  it('같은 지오메트리를 다시 물어도 같은 값을 준다 (캐시)', () => {
    const geom = new MultiPolygon([ISLAND, MAINLAND]);
    expect(labelPoint(geom)).toEqual(labelPoint(geom));
  });
});
