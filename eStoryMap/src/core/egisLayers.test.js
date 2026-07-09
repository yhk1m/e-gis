// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { Feature } from 'ol';
import {
  hexToRgba, createVectorStyle, readVectorFeatures, buildVectorLayer,
  createChoroplethStyle, createCartogramStyle,
} from './egisLayers.js';

describe('createChoroplethStyle — 단계구분도 분류색(웹 ChoroplethTool 이식)', () => {
  const cfg = { attribute: 'pop', breaks: [0, 10, 20, 30], colors: ['#111111', '#222222', '#333333'] };
  it('속성값이 속한 계급의 색으로 채운다(불투명도 0.7 기본)', () => {
    const styleFn = createChoroplethStyle(cfg, {});
    const s = styleFn(new Feature({ pop: 15 })); // 2번째 계급(10~20)
    expect(s.getFill().getColor()).toBe('rgba(34, 34, 34, 0.7)');
  });
  it('값이 없는(NaN) 피처는 회색', () => {
    const styleFn = createChoroplethStyle(cfg, {});
    const s = styleFn(new Feature({}));
    expect(s.getFill().getColor()).toContain('128, 128, 128');
  });
  it('최댓값 초과는 마지막 계급 색', () => {
    const styleFn = createChoroplethStyle(cfg, {});
    const s = styleFn(new Feature({ pop: 999 }));
    expect(s.getFill().getColor()).toBe('rgba(51, 51, 51, 0.7)');
  });
});

describe('createCartogramStyle — 카토그램 분류색(웹 CartogramTool 이식)', () => {
  const cfg = { attribute: 'pop', breaks: [0, 10, 20], colors: ['#aaaaaa', '#bbbbbb'], showLabels: true };
  it('분류색으로 채우고(0.85) 라벨 텍스트를 붙인다', () => {
    const styleFn = createCartogramStyle(cfg);
    const s = styleFn(new Feature({ pop: 5, name: '부산' }));
    expect(s.getFill().getColor()).toBe('rgba(170, 170, 170, 0.85)');
    expect(s.getText().getText()).toBe('부산');
  });
  it('showLabels가 아니면 라벨 없음', () => {
    const styleFn = createCartogramStyle({ ...cfg, showLabels: false });
    const s = styleFn(new Feature({ pop: 5, name: '부산' }));
    expect(s.getText()).toBeFalsy();
  });
});

describe('buildVectorLayer — 주제도 스타일 선택', () => {
  it('choroplethConfig가 있으면 스타일 함수(분류색)를 쓴다', () => {
    const layer = buildVectorLayer({
      id: 'L_c', name: '단계구분', type: 'vector', geometryType: 'Polygon',
      visible: true, color: '#ef4444', opacity: 1,
      choroplethConfig: { attribute: 'pop', breaks: [0, 10], colors: ['#111111'] },
      features: { type: 'FeatureCollection', features: [] },
    });
    expect(typeof layer.getStyle()).toBe('function');
  });
});

describe('hexToRgba', () => {
  it('hex를 rgba로 변환', () => {
    expect(hexToRgba('#ef4444', 0.3)).toBe('rgba(239, 68, 68, 0.3)');
  });
  it('잘못된 값은 회색', () => {
    expect(hexToRgba(null, 1)).toBe('rgba(128, 128, 128, 1)');
  });
  it('이미 rgb(a) 문자열이면 그대로', () => {
    expect(hexToRgba('rgba(1,2,3,0.5)')).toBe('rgba(1,2,3,0.5)');
  });
});

describe('createVectorStyle — 세부 스타일(.egis 스타일 필드)', () => {
  it('fillColor/fillOpacity가 채우기에, strokeColor가 테두리에 반영된다', () => {
    const s = createVectorStyle({
      color: '#ff0000', fillColor: '#00ff00', fillOpacity: 0.5, strokeColor: '#0000ff',
    }, 'Polygon');
    expect(s.getFill().getColor()).toBe('rgba(0, 255, 0, 0.5)');
    expect(s.getStroke().getColor()).toBe('rgba(0, 0, 255, 1)');
  });
  it('strokeDash·strokeWidth가 테두리에 반영된다', () => {
    const s = createVectorStyle({ color: '#ff0000', strokeDash: 'dashed', strokeWidth: 4 }, 'Polygon');
    expect(s.getStroke().getLineDash()).toEqual([10, 10]);
    expect(s.getStroke().getWidth()).toBe(4);
  });
  it('Point는 pointRadius·strokeColor가 반영된다(세부 스타일 존재 시)', () => {
    const s = createVectorStyle({ color: '#ff0000', pointRadius: 10, strokeColor: '#0000ff' }, 'Point');
    expect(s.getImage().getRadius()).toBe(10);
    expect(s.getImage().getStroke().getColor()).toBe('rgba(0, 0, 255, 1)');
  });
  it('세부 필드가 하나라도 있으면 나머지는 color로 폴백한다', () => {
    const s = createVectorStyle({ color: '#ff0000', strokeWidth: 5 }, 'LineString');
    expect(s.getStroke().getColor()).toBe('rgba(255, 0, 0, 1)');
    expect(s.getStroke().getWidth()).toBe(5);
  });
  it('필드가 있어도 전부 기본값이면(안 건드린 레이어) 초기 스타일 유지 — Point 흰 테두리', () => {
    const s = createVectorStyle({
      color: '#ff0000', strokeColor: '#ff0000', fillColor: '#ff0000',
      fillOpacity: 0.3, strokeOpacity: 1, strokeWidth: 2, strokeDash: 'solid', pointRadius: 6,
    }, 'Point');
    expect(s.getImage().getStroke().getColor()).toBe('#ffffff');
  });
});

describe('createVectorStyle', () => {
  it('Point는 image(원) 스타일, fill 없음', () => {
    const s = createVectorStyle('#3b82f6', 'Point');
    expect(s.getImage()).toBeTruthy();
    expect(s.getFill()).toBeFalsy();
  });
  it('세부 필드 없는 구버전 Point는 기존 모양(흰 테두리) 유지', () => {
    const s = createVectorStyle('#3b82f6', 'Point');
    expect(s.getImage().getStroke().getColor()).toBe('#ffffff');
  });
  it('LineString은 stroke만', () => {
    const s = createVectorStyle('#3b82f6', 'LineString');
    expect(s.getStroke()).toBeTruthy();
    expect(s.getFill()).toBeFalsy();
    expect(s.getImage()).toBeFalsy();
  });
  it('Polygon은 fill+stroke', () => {
    const s = createVectorStyle('#3b82f6', 'Polygon');
    expect(s.getFill()).toBeTruthy();
    expect(s.getStroke()).toBeTruthy();
  });
});

describe('readVectorFeatures', () => {
  const FC = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: '부산' },
        geometry: { type: 'Point', coordinates: [129.0, 35.1] } },
    ],
  };
  it('GeoJSON(4326) → OL Feature[] (좌표는 3857로 변환)', () => {
    const feats = readVectorFeatures(FC);
    expect(feats).toHaveLength(1);
    const [x] = feats[0].getGeometry().getCoordinates();
    // 129°E는 웹메르카토르에서 약 1.436e7 m
    expect(x).toBeGreaterThan(1.4e7);
    expect(x).toBeLessThan(1.5e7);
  });
  it('features가 null이면 빈 배열', () => {
    expect(readVectorFeatures(null)).toEqual([]);
  });
});

describe('buildVectorLayer', () => {
  it('정규화된 벡터 레이어 → OL VectorLayer(egisLayerId 부여, visible 반영)', () => {
    const layerData = {
      id: 'L_a', name: '인구', type: 'vector', geometryType: 'Polygon',
      visible: false, color: '#ef4444', opacity: 1,
      features: { type: 'FeatureCollection', features: [] },
    };
    const layer = buildVectorLayer(layerData);
    expect(layer.get('egisLayerId')).toBe('L_a');
    expect(layer.getVisible()).toBe(false);
    expect(layer.getSource()).toBeTruthy();
  });

  it('opacity를 OL 레이어에 적용한다', () => {
    const layer = buildVectorLayer({
      id: 'L_b', name: '반투명', type: 'vector', geometryType: 'Polygon',
      visible: true, color: '#ef4444', opacity: 0.5,
      features: { type: 'FeatureCollection', features: [] },
    });
    expect(layer.getOpacity()).toBe(0.5);
  });
});
