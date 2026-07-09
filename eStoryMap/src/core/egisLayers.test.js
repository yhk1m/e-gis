// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { hexToRgba, createVectorStyle, readVectorFeatures, buildVectorLayer } from './egisLayers.js';

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
