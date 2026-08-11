// © 2026 김용현
/**
 * 여러 조각으로 된 행정구역의 라벨 배치.
 *
 * 카토그램 창의 라벨과 일반 라벨 기능 두 경로 모두, 부속 도서가 아니라
 * 본토 한 곳에만 이름이 붙어야 한다.
 */
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Polygon from 'ol/geom/Polygon.js';
import { cartogramTool } from './CartogramTool.js';
import { labelTool } from './LabelTool.js';

const box = (minX, minY, maxX, maxY) => [[
  [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]
]];

const ISLAND = box(0, 0, 1, 1);
const MAINLAND = box(10, 10, 30, 30);
const inMainland = (pt) => pt[0] > 10 && pt[0] < 30 && pt[1] > 10 && pt[1] < 30;

/** 섬이 앞에 오는 멀티폴리곤 피처 (전남·인천 데이터가 이 모양이다) */
const islandFirstFeature = () => new Feature({
  geometry: new MultiPolygon([ISLAND, MAINLAND]),
  name: '전남광주통합특별시',
  v: 3
});

const CONFIG = { attribute: 'v', colors: ['#111111', '#222222'], breaks: [0, 5, 10] };

describe('카토그램 스타일 — 라벨은 라벨 기능이 담당한다', () => {
  it('면 스타일 하나만 준다 (라벨 텍스트 없음)', () => {
    const style = cartogramTool.cartogramStyle({ ...CONFIG })(islandFirstFeature());

    expect(Array.isArray(style)).toBe(false);
    expect(style.getFill()).toBeTruthy();
    expect(style.getText()).toBeFalsy();
  });

  it('예전에 저장한 showLabels 설정이 들어와도 라벨을 그리지 않는다', () => {
    // .egis·자동저장에 남아 있는 옛 설정이 되살아나면 안 된다
    const style = cartogramTool.cartogramStyle({ ...CONFIG, showLabels: true })(islandFirstFeature());

    expect(Array.isArray(style)).toBe(false);
    expect(style.getText()).toBeFalsy();
  });
});

describe('일반 라벨 기능(LabelTool)의 중심점', () => {
  it('멀티폴리곤은 본토에 라벨을 붙인다 — 섬이 첫 조각이어도', () => {
    const center = labelTool.getFeatureCenter(islandFirstFeature(), false);

    expect(inMainland(center)).toBe(true);
  });

  it('단일 폴리곤은 그대로 내부점을 쓴다', () => {
    const center = labelTool.getFeatureCenter(new Feature({ geometry: new Polygon(MAINLAND) }), false);

    expect(inMainland(center)).toBe(true);
  });
});
