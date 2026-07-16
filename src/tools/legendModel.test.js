// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { buildLegendModel, formatNumber } from './legendModel.js';

/**
 * layerManager.addLayer가 만드는 layerInfo의 스타일 기본값.
 * 테스트가 보는 모양을 실제와 맞추기 위해 필드를 그대로 흉내낸다.
 */
function makeLayer(overrides = {}) {
  return {
    id: 'layer-1',
    name: '서울 자치구',
    type: 'vector',
    visible: true,
    color: '#3b82f6',
    strokeColor: '#3b82f6',
    fillColor: '#3b82f6',
    geometryType: 'Polygon',
    strokeDash: 'solid',
    fillOpacity: 0.3,
    strokeOpacity: 1.0,
    strokeWidth: 2,
    pointRadius: 6,
    ...overrides
  };
}

describe('formatNumber', () => {
  it('comma 형식은 정수로 반올림하고 천 단위를 끊는다', () => {
    expect(formatNumber(1234567.8, 'comma')).toBe('1,234,568');
  });

  it('short 형식은 K/M로 줄인다', () => {
    expect(formatNumber(1500, 'short')).toBe('1.5K');
    expect(formatNumber(2400000, 'short')).toBe('2.4M');
  });

  it('decimal2 형식은 항상 소수점 두 자리를 남긴다', () => {
    expect(formatNumber(1234.5, 'decimal2')).toBe('1,234.50');
  });

  it('rounding은 그 배수로 값을 맞춘다', () => {
    expect(formatNumber(1234, 'comma', 100)).toBe('1,200');
  });
});

describe('buildLegendModel — 일반 벡터 레이어', () => {
  it('항목 하나에 레이어 이름을 라벨로 싣고 묶지 않는다', () => {
    const model = buildLegendModel(makeLayer());

    expect(model.grouped).toBe(false);
    expect(model.items).toHaveLength(1);
    expect(model.items[0].label).toBe('서울 자치구');
  });

  it('기호가 도형 종류와 레이어 스타일을 그대로 싣는다', () => {
    const model = buildLegendModel(makeLayer({
      geometryType: 'LineString',
      strokeDash: 'dashed',
      strokeColor: '#ef4444',
      strokeWidth: 3
    }));

    expect(model.items[0].symbol).toMatchObject({
      kind: 'line',
      strokeDash: 'dashed',
      strokeColor: '#ef4444',
      strokeWidth: 3
    });
  });

  it('Multi- 도형도 같은 종류로 본다', () => {
    expect(buildLegendModel(makeLayer({ geometryType: 'MultiPoint' })).items[0].symbol.kind).toBe('point');
    expect(buildLegendModel(makeLayer({ geometryType: 'MultiPolygon' })).items[0].symbol.kind).toBe('polygon');
  });

  it('점 레이어는 pointRadius를 싣는다', () => {
    const model = buildLegendModel(makeLayer({ geometryType: 'Point', pointRadius: 9 }));

    expect(model.items[0].symbol.kind).toBe('point');
    expect(model.items[0].symbol.pointRadius).toBe(9);
  });
});

describe('buildLegendModel — 단계구분도', () => {
  const choropleth = () => makeLayer({
    type: 'choropleth',
    name: '고령인구비율_choropleth',
    _choroplethConfig: {
      attribute: '고령인구비율',
      breaks: [0, 10, 20, 30],
      colors: ['#eff3ff', '#bdd7e7', '#6baed6'],
      title: '서울 자치구 (고령인구비율)',
      unit: '%',
      format: 'comma',
      rounding: 0
    }
  });

  it('구간 수만큼 항목을 만든다', () => {
    const model = buildLegendModel(choropleth());

    expect(model.grouped).toBe(true);
    expect(model.items).toHaveLength(3);
  });

  it('구간 라벨이 지도 위 범례와 같은 형식이다', () => {
    const model = buildLegendModel(choropleth());

    expect(model.items[0].label).toBe('0 - 10 %');
    expect(model.items[2].label).toBe('20 - 30 %');
  });

  it('제목은 설정의 title을 쓴다', () => {
    expect(buildLegendModel(choropleth()).title).toBe('서울 자치구 (고령인구비율)');
  });

  it('구간마다 분류 색을 쓰되 테두리는 레이어 스타일을 따른다', () => {
    const model = buildLegendModel(choropleth());

    expect(model.items[1].symbol.fillColor).toBe('#bdd7e7');
    expect(model.items[1].symbol.strokeColor).toBe('#3b82f6');
  });

  it('unit이 비면 라벨에 공백을 남기지 않는다', () => {
    const layer = choropleth();
    layer._choroplethConfig.unit = '';

    expect(buildLegendModel(layer).items[0].label).toBe('0 - 10');
  });

  it('설정의 format·rounding을 라벨에 반영한다', () => {
    const layer = choropleth();
    layer._choroplethConfig.breaks = [0, 1500, 2400000];
    layer._choroplethConfig.colors = ['#eff3ff', '#bdd7e7'];
    layer._choroplethConfig.format = 'short';
    layer._choroplethConfig.unit = '명';

    expect(buildLegendModel(layer).items[1].label).toBe('1.5K - 2.4M 명');
  });
});

describe('buildLegendModel — 카토그램', () => {
  // 카토그램은 type이 'vector'라(CartogramTool.js) type만 봐서는 못 잡는다.
  const cartogram = () => makeLayer({
    type: 'vector',
    name: '서울_Dorling_인구',
    _cartogramConfig: {
      attribute: '인구',
      breaks: [0, 5000, 10000],
      colors: ['#fee5d9', '#fcae91'],
      cartogramType: 'dorling'
    }
  });

  it('type이 vector여도 설정이 있으면 구간으로 펼친다', () => {
    const model = buildLegendModel(cartogram());

    expect(model.grouped).toBe(true);
    expect(model.items).toHaveLength(2);
  });

  it('제목이 없으면 레이어 이름을 쓴다', () => {
    expect(buildLegendModel(cartogram()).title).toBe('서울_Dorling_인구');
  });

  it('구간 라벨을 기본 형식으로 만든다', () => {
    expect(buildLegendModel(cartogram()).items[0].label).toBe('0 - 5,000');
  });
});

describe('buildLegendModel — 범례로 요약할 수 없는 레이어', () => {
  it('래스터는 제외한다', () => {
    expect(buildLegendModel(makeLayer({ type: 'raster', geometryType: 'Raster' }))).toBeNull();
  });

  it('히트맵은 제외한다', () => {
    expect(buildLegendModel(makeLayer({ type: 'heatmap', _heatmapConfig: {} }))).toBeNull();
  });

  it('도형표현도는 제외한다', () => {
    expect(buildLegendModel(makeLayer({ type: 'chartmap', _chartMapConfig: {} }))).toBeNull();
  });

  it('레이어가 없으면 null을 낸다', () => {
    expect(buildLegendModel(null)).toBeNull();
  });

  it('구간이 깨진 주제도는 제외한다', () => {
    const broken = makeLayer({
      type: 'choropleth',
      _choroplethConfig: { breaks: [10], colors: [], attribute: 'x' }
    });

    expect(buildLegendModel(broken)).toBeNull();
  });
});
