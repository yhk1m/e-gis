// © 2026 김용현
/**
 * 레이어 정보 + 피처 속성 → 지구본이 칠할 값.
 * LayerManager.updateLayerStyle 의 분기(단계구분도·카토그램·등고선·일반)를 OpenLayers 없이 재현한다.
 * 규칙이 갈라지면 2D 와 지구본의 색이 달라 보이므로 기본값을 그쪽과 똑같이 둔다.
 */
import { describe, it, expect } from 'vitest';
import { featureStyle, classIndex, darkenColor, rgba, STROKE_DASH } from './layerStyles.js';

const BREAKS = [0, 10, 20, 30];
const COLORS = ['#f7fbff', '#9ecae1', '#2171b5'];

describe('classIndex', () => {
  it('ChoroplethTool.getColorIndex 와 같다 (상한 포함, 넘치면 마지막)', () => {
    expect(classIndex(0, BREAKS)).toBe(0);
    expect(classIndex(10, BREAKS)).toBe(0);
    expect(classIndex(10.1, BREAKS)).toBe(1);
    expect(classIndex(30, BREAKS)).toBe(2);
    expect(classIndex(99, BREAKS)).toBe(2);
  });

  it('숫자가 아니면 -1', () => {
    expect(classIndex(NaN, BREAKS)).toBe(-1);
    expect(classIndex(5, null)).toBe(-1);
  });
});

describe('darkenColor · rgba', () => {
  it('각 채널 -40, 0 아래로 안 간다', () => {
    expect(darkenColor('#2171b5')).toBe('#00498d');
    expect(darkenColor('#000000')).toBe('#000000');
  });

  it('rgba 문자열을 만든다', () => {
    expect(rgba('#2171b5', 0.5)).toBe('rgba(33, 113, 181, 0.5)');
    expect(rgba(undefined, 0.5)).toBe('rgba(128, 128, 128, 0.5)');
    expect(rgba('rgba(1, 2, 3, 0.2)', 0.5)).toBe('rgba(1, 2, 3, 0.2)');
  });
});

describe('featureStyle — 일반 벡터', () => {
  it('폴리곤: 채움·테두리·불투명도·대시를 그대로 옮긴다', () => {
    const s = featureStyle({
      type: 'vector', geometryType: 'Polygon', color: '#ff0000', fillColor: '#00ff00',
      strokeColor: '#0000ff', fillOpacity: 0.6, strokeOpacity: 0.9, strokeWidth: 3, strokeDash: 'dashed'
    }, {});
    expect(s).toEqual({
      fillColor: '#00ff00', fillSpec: null, fillOpacity: 0.6,
      strokeColor: '#0000ff', strokeOpacity: 0.9, strokeWidth: 3, lineDash: [10, 10], pointRadius: 6
    });
  });

  it('값이 없으면 LayerManager 기본값 (색 = color, 채움 0.3, 테두리 1, 두께 2, 점 6)', () => {
    const s = featureStyle({ type: 'vector', geometryType: 'Point', color: '#123456' }, {});
    expect(s.fillColor).toBe('#123456');
    expect(s.strokeColor).toBe('#123456');
    expect(s.fillOpacity).toBe(0.3);
    expect(s.strokeOpacity).toBe(1);
    expect(s.strokeWidth).toBe(2);
    expect(s.pointRadius).toBe(6);
    expect(s.lineDash).toBeNull();
  });

  it('두께 0 은 0 그대로 (테두리 없음)', () => {
    expect(featureStyle({ type: 'vector', geometryType: 'Polygon', color: '#000', strokeWidth: 0 }, {}).strokeWidth).toBe(0);
  });

  it('pointRadius 를 존중한다', () => {
    expect(featureStyle({ type: 'vector', geometryType: 'MultiPoint', color: '#000', pointRadius: 11 }, {}).pointRadius).toBe(11);
  });

  it('점의 테두리는 대시를 안 쓴다 (LayerManager 점 분기의 makeStroke 에 lineDash 없음)', () => {
    expect(featureStyle({ type: 'vector', geometryType: 'Point', color: '#000', strokeDash: 'dashed' }, {}).lineDash).toBeNull();
    expect(featureStyle({ type: 'vector', geometryType: 'LineString', color: '#000', strokeDash: 'dashed' }, {}).lineDash).toEqual([10, 10]);
  });
});

describe('featureStyle — 등고선', () => {
  const layer = {
    type: 'vector', geometryType: 'LineString', color: '#A0522D', strokeColor: '#A0522D', strokeWidth: 0.8,
    _contourConfig: { interval: 20, majorRatio: 1.5 / 0.8 }
  };

  it('계곡선(interval×5 배수)만 두께 × majorRatio, 채움 없음 기본', () => {
    expect(featureStyle(layer, { elevation: 40 }).strokeWidth).toBeCloseTo(0.8);
    expect(featureStyle(layer, { elevation: 100 }).strokeWidth).toBeCloseTo(1.5);
    expect(featureStyle(layer, { elevation: 100 }).strokeColor).toBe('#A0522D');
  });

  it('두께가 없으면 0.8 기본, 테두리 불투명도를 존중한다', () => {
    const { strokeWidth, ...rest } = layer;
    const s = featureStyle({ ...rest, strokeOpacity: 0.5 }, { elevation: 40 });
    expect(s.strokeWidth).toBeCloseTo(0.8);
    expect(s.strokeOpacity).toBe(0.5);
  });
});

describe('featureStyle — 단계구분도', () => {
  const layer = {
    type: 'choropleth', geometryType: 'Polygon', color: '#ffffff',
    _choroplethConfig: { attribute: 'v', breaks: BREAKS, colors: COLORS }
  };

  it('구간 색을 기준색으로, 테두리는 어둡게, 채움 0.7', () => {
    const s = featureStyle(layer, { v: 15 });
    expect(s.fillColor).toBe('#9ecae1');
    expect(s.fillSpec).toBeNull();
    expect(s.fillOpacity).toBe(0.7);
    expect(s.strokeColor).toBe(darkenColor('#9ecae1'));
    expect(s.strokeWidth).toBe(1);
  });

  it('fills[i] 가 있으면 fillSpec 으로 싣는다', () => {
    const withFills = { ...layer, _choroplethConfig: { ...layer._choroplethConfig, fills: [null, { kind: 'hatch', angle: 45 }, null] } };
    expect(featureStyle(withFills, { v: 15 }).fillSpec).toEqual({ kind: 'hatch', angle: 45 });
    expect(featureStyle(withFills, { v: 1 }).fillSpec).toBeNull();
  });

  it('값이 없으면 회색, 테두리 #666666', () => {
    const s = featureStyle(layer, { v: 'x' });
    expect(s.fillColor).toBe('#808080');
    expect(s.fillSpec).toBeNull();
    expect(s.strokeColor).toBe('#666666');
  });

  it('테두리 동기화를 끄면 strokeColor 를 쓴다', () => {
    const s = featureStyle({ ...layer, strokeSyncToFill: false, strokeColor: '#ff00ff' }, { v: 15 });
    expect(s.strokeColor).toBe('#ff00ff');
  });

  it('레이어의 fillOpacity·strokeWidth·strokeDash 를 존중한다', () => {
    const s = featureStyle({ ...layer, fillOpacity: 0.4, strokeWidth: 2.5, strokeDash: 'dotted' }, { v: 15 });
    expect(s.fillOpacity).toBe(0.4);
    expect(s.strokeWidth).toBe(2.5);
    expect(s.lineDash).toEqual([2, 6]);
  });
});

describe('featureStyle — 카토그램', () => {
  const layer = {
    type: 'vector', geometryType: 'Polygon', color: '#ffffff',
    _cartogramConfig: { attribute: 'v', breaks: BREAKS, colors: COLORS }
  };

  it('구간 색, 채움 0.85, 테두리 어둡게', () => {
    const s = featureStyle(layer, { v: 25 });
    expect(s.fillColor).toBe('#2171b5');
    expect(s.fillOpacity).toBe(0.85);
    expect(s.strokeColor).toBe(darkenColor('#2171b5'));
    expect(s.strokeWidth).toBe(1);
  });

  it('값이 없으면 첫 구간 색 (cartoColorIndex 규칙), 동기화 끄면 #333333 기본', () => {
    expect(featureStyle(layer, { v: 'x' }).fillColor).toBe('#f7fbff');
    expect(featureStyle({ ...layer, strokeSyncToFill: false }, { v: 25 }).strokeColor).toBe('#333333');
  });
});

describe('STROKE_DASH', () => {
  it('LayerManager 의 표와 같다', () => {
    expect(STROKE_DASH).toEqual({ solid: null, dashed: [10, 10], dotted: [2, 6], 'dash-dot': [10, 5, 2, 5] });
  });
});
