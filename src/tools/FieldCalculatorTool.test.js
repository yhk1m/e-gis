// © 2026 김용현
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { fieldCalculatorTool } from './FieldCalculatorTool.js';

/**
 * 서울 부근(위도 37도)의 약 0.01° 사각형.
 * 실제 지상 거리로 가로 약 890m, 세로 약 1,110m → 둘레 약 4,000m.
 * 웹 메르카토르 평면에서 재면 위도 37도 왜곡(약 1.25배) 때문에 약 5,000m가 나온다.
 */
function squareNearSeoul() {
  const ring = [
    [127.00, 37.00], [127.01, 37.00], [127.01, 37.01], [127.00, 37.01], [127.00, 37.00]
  ].map(c => fromLonLat(c));
  return new Polygon([ring]);
}

describe('FieldCalculatorTool.perimeterOf', () => {
  it('폴리곤 둘레를 실제 지상 거리(m)로 계산한다', () => {
    const perimeter = fieldCalculatorTool.perimeterOf(squareNearSeoul());
    // 890 × 2 + 1110 × 2 ≒ 4,000m
    expect(perimeter).toBeGreaterThan(3800);
    expect(perimeter).toBeLessThan(4200);
  });

  it('예전 방식(지도 좌표 평면 거리)보다 작다 — 메르카토르 왜곡이 빠졌다', () => {
    const polygon = squareNearSeoul();
    const coords = polygon.getLinearRing(0).getCoordinates();
    let planar = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      planar += Math.hypot(coords[i + 1][0] - coords[i][0], coords[i + 1][1] - coords[i][1]);
    }
    const perimeter = fieldCalculatorTool.perimeterOf(polygon);
    expect(perimeter).toBeLessThan(planar);
    // 위도 37도에서 약 1.25배 차이
    expect(planar / perimeter).toBeGreaterThan(1.2);
    expect(planar / perimeter).toBeLessThan(1.3);
  });

  it('선 도형은 길이를 그대로 돌려준다', () => {
    const line = new LineString([[127.0, 37.0], [127.01, 37.0]].map(c => fromLonLat(c)));
    const perimeter = fieldCalculatorTool.perimeterOf(line);
    expect(perimeter).toBeGreaterThan(850);
    expect(perimeter).toBeLessThan(930);
  });

  it('도형이 없으면 0', () => {
    expect(fieldCalculatorTool.perimeterOf(null)).toBe(0);
  });
});

describe('FieldCalculatorTool.evaluateExpression', () => {
  const feature = () => new Feature({
    geometry: squareNearSeoul(),
    인구: 5000,
    이름: '가나동',
    빈값: ''
  });

  it('대괄호로 감싼 필드 값을 넣어 계산한다', () => {
    expect(fieldCalculatorTool.evaluateExpression('[인구] * 2', feature())).toBe(10000);
  });

  it('숫자가 아니거나 비어 있는 필드는 0으로 본다', () => {
    expect(fieldCalculatorTool.evaluateExpression('[빈값] + 1', feature())).toBe(1);
    expect(fieldCalculatorTool.evaluateExpression('[이름] + 1', feature())).toBe(1);
    expect(fieldCalculatorTool.evaluateExpression('[없는필드] + 3', feature())).toBe(3);
  });

  it('$area 는 ㎡ 단위 실제 면적이다', () => {
    const area = fieldCalculatorTool.evaluateExpression('$area', feature());
    // 890m × 1,110m ≒ 0.99 km²
    expect(area).toBeGreaterThan(900000);
    expect(area).toBeLessThan(1100000);
  });

  it('면적과 둘레를 함께 써서 인구밀도를 낼 수 있다', () => {
    const density = fieldCalculatorTool.evaluateExpression('[인구] / ($area / 1000000)', feature());
    expect(density).toBeGreaterThan(4500);
    expect(density).toBeLessThan(5600);
  });

  it('결과는 소수점 셋째 자리에서 반올림한다', () => {
    expect(fieldCalculatorTool.evaluateExpression('10 / 3', feature())).toBe(3.333);
  });

  it('$area_km2 는 ㎢ 단위 면적이다', () => {
    const km2 = fieldCalculatorTool.evaluateExpression('$area_km2', feature());
    expect(km2).toBeGreaterThan(0.9);
    expect(km2).toBeLessThan(1.1);
  });

  it('$area_km2 가 $area 치환에 먹히지 않는다', () => {
    const f = feature();
    const km2 = fieldCalculatorTool.evaluateExpression('$area_km2', f);
    const m2 = fieldCalculatorTool.evaluateExpression('$area', f);
    // 같은 도형이므로 정확히 100만 배 차이여야 한다
    expect(m2 / km2).toBeGreaterThan(999000);
    expect(m2 / km2).toBeLessThan(1001000);
  });

  it('한 식에 ㎡와 ㎢를 같이 써도 된다', () => {
    const v = fieldCalculatorTool.evaluateExpression('$area / 1000000 - $area_km2', feature());
    expect(Math.abs(v)).toBeLessThan(0.001);
  });
});
