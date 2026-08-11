// © 2026 김용현
// @vitest-environment jsdom
/**
 * 분류 레이어(단계구분도·카토그램)의 스타일 가드 검증.
 *
 * 분류색은 분류 설정이 소유한다. 사용자가 바꿀 수 있는 건 투명도와 테두리뿐이다.
 * setLayerColor는 분류 레이어에서 무시되어야 하고(카토그램은 이걸 안 막으면
 * 분류색 스타일 함수가 단색으로 덮여 파괴된다), setLayerStrokeColor는
 * 반대로 단계구분도에서도 동작해야 한다(기존에는 막혀 있었다).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from './LayerManager.js';
import { choroplethTool } from '../tools/ChoroplethTool.js';
import { cartogramTool } from '../tools/CartogramTool.js';

function square(pop) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    pop
  });
}

describe('isClassified / 스타일 가드', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('일반 벡터 레이어는 분류 레이어가 아니다', () => {
    const id = layerManager.addLayer({ name: '일반', features: [square(1)], color: '#3388ff' });
    expect(layerManager.isClassified(layerManager.getLayer(id))).toBe(false);
  });

  it('_cartogramConfig가 있으면 type이 vector여도 분류 레이어다', () => {
    const id = layerManager.addLayer({
      name: '카토그램', type: 'vector', features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    info._cartogramConfig = { attribute: 'pop', colors: ['#fff', '#000'], breaks: [0, 1, 2] };
    expect(layerManager.isClassified(info)).toBe(true);
  });

  it('setLayerColor는 분류 레이어에서 무시된다', () => {
    const id = layerManager.addLayer({
      name: '카토그램', type: 'vector', features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    info._cartogramConfig = { attribute: 'pop', colors: ['#fff', '#000'], breaks: [0, 1, 2] };

    layerManager.setLayerColor(id, '#ff0000');

    expect(info.color).toBe('#3388ff');
  });

  it('setLayerFillColor도 분류 레이어에서 무시된다', () => {
    const id = layerManager.addLayer({
      name: '카토그램', type: 'vector', features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    info._cartogramConfig = { attribute: 'pop', colors: ['#fff', '#000'], breaks: [0, 1, 2] };
    const before = info.fillColor;

    layerManager.setLayerFillColor(id, '#ff0000');

    expect(info.fillColor).toBe(before);
  });

  it('setLayerStrokeColor는 단계구분도에서도 동작한다', () => {
    const id = layerManager.addLayer({
      name: '단계구분도', type: 'choropleth', features: [square(1)], color: '#3388ff'
    });

    layerManager.setLayerStrokeColor(id, '#ff0000');

    expect(layerManager.getLayer(id).strokeColor).toBe('#ff0000');
  });
});

/** 단계구분도 설정을 붙인 레이어를 만든다 */
function makeChoropleth() {
  const id = layerManager.addLayer({
    name: '단계구분도',
    type: 'choropleth',
    features: [square(10)],
    color: '#3388ff'
  });
  const info = layerManager.getLayer(id);
  info._choroplethConfig = {
    attribute: 'pop',
    breaks: [0, 50, 100],
    colors: ['#ffffcc', '#800026'],
    tool: choroplethTool
  };
  return { id, info };
}

/** 스타일 함수를 실행해 stroke 정보를 뽑는다 */
function strokeOf(info) {
  const styleFn = info.olLayer.getStyle();
  const style = styleFn(info.source.getFeatures()[0]);
  return {
    color: style.getStroke().getColor(),
    width: style.getStroke().getWidth(),
    lineDash: style.getStroke().getLineDash()
  };
}

describe('단계구분도 테두리', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('기본(동기화 ON)은 분류색을 어둡게 한 색이다', () => {
    const { id, info } = makeChoropleth();
    layerManager.updateLayerStyle(id);

    // pop=10 → breaks [0,50,100]의 첫 구간 → colors[0] = '#ffffcc'
    expect(strokeOf(info).color).toBe(choroplethTool.darkenColor('#ffffcc'));
  });

  it('strokeSyncToFill이 undefined여도 동기화 ON으로 동작한다', () => {
    const { id, info } = makeChoropleth();
    delete info.strokeSyncToFill;
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).color).toBe(choroplethTool.darkenColor('#ffffcc'));
  });

  it('동기화를 끄면 지정한 단일 색을 쓴다', () => {
    const { id, info } = makeChoropleth();
    info.strokeSyncToFill = false;
    info.strokeColor = '#ff0000';
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).color).toBe('#ff0000');
  });

  it('선 스타일(dash)이 반영된다', () => {
    const { id, info } = makeChoropleth();
    info.strokeDash = 'dashed';
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).lineDash).not.toBeNull();
  });
});

describe('선 두께 0 = 테두리 없음', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  /** 두께 0은 '테두리를 그리지 말라'는 뜻이다. 예전에는 `|| 2`에 걸려 조용히 2로 돌아갔다. */
  function styleWithWidth(geometryType, width) {
    const id = layerManager.addLayer({
      name: '두께 시험', geometryType, features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    info.strokeWidth = width;
    layerManager.updateLayerStyle(id);
    return info.olLayer.getStyle();
  }

  it('폴리곤: 0이면 테두리를 그리지 않는다', () => {
    expect(styleWithWidth('Polygon', 0).getStroke()).toBeFalsy();
  });

  it('폴리곤: 0이 아니면 그대로 쓴다', () => {
    expect(styleWithWidth('Polygon', 3).getStroke().getWidth()).toBe(3);
  });

  it('선: 0이면 테두리를 그리지 않는다', () => {
    expect(styleWithWidth('LineString', 0).getStroke()).toBeFalsy();
  });

  it('포인트: 0이면 테두리를 그리지 않는다', () => {
    expect(styleWithWidth('Point', 0).getImage().getStroke()).toBeFalsy();
  });

  it('단계구분도: 0이면 테두리를 그리지 않는다', () => {
    const { id, info } = makeChoropleth();
    info.strokeWidth = 0;
    layerManager.updateLayerStyle(id);

    const style = info.olLayer.getStyle()(info.source.getFeatures()[0]);
    expect(style.getStroke()).toBeFalsy();
    // 채우기는 그대로 남아야 한다 — 테두리만 없애는 것이다
    expect(style.getFill()).toBeTruthy();
  });

  it('두께를 지정하지 않으면 기본 2를 쓴다', () => {
    const id = layerManager.addLayer({
      name: '기본', geometryType: 'Polygon', features: [square(1)], color: '#3388ff'
    });
    const info = layerManager.getLayer(id);
    delete info.strokeWidth;
    layerManager.updateLayerStyle(id);

    expect(info.olLayer.getStyle().getStroke().getWidth()).toBe(2);
  });
});

/** 카토그램 설정을 붙인 레이어를 만든다 (CartogramTool이 하는 것과 같은 형태) */
function makeCartogram() {
  const id = layerManager.addLayer({
    name: '카토그램',
    type: 'vector',
    features: [square(10)],
    color: '#3388ff'
  });
  const info = layerManager.getLayer(id);
  info._cartogramConfig = {
    attribute: 'pop',
    colors: ['#ffffcc', '#800026'],
    breaks: [0, 50, 100]
  };
  info.fillOpacity = 0.85;
  info.strokeColor = '#333';
  info.strokeWidth = 1;
  cartogramTool.applyCartogramStyle(id);
  return { id, info };
}

describe('카토그램 스타일', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('setLayerColor를 해도 분류색 스타일 함수가 유지된다', () => {
    const { id, info } = makeCartogram();
    expect(typeof info.olLayer.getStyle()).toBe('function');

    layerManager.setLayerColor(id, '#ff0000');

    // 단색 Style 객체로 덮이면 분류가 파괴된 것이다
    expect(typeof info.olLayer.getStyle()).toBe('function');
  });

  it('투명도 슬라이더를 움직여도 분류색 스타일 함수가 유지된다', () => {
    const { id, info } = makeCartogram();

    layerManager.setLayerFillOpacity(id, 0.4);

    expect(typeof info.olLayer.getStyle()).toBe('function');
  });

  it('선 두께를 바꿔도 분류색 스타일 함수가 유지된다', () => {
    const { id, info } = makeCartogram();

    layerManager.setLayerStrokeWidth(id, 5);

    expect(typeof info.olLayer.getStyle()).toBe('function');
  });

  it('선 두께 0이면 테두리를 그리지 않는다', () => {
    const { id, info } = makeCartogram();

    layerManager.setLayerStrokeWidth(id, 0);

    const style = info.olLayer.getStyle()(info.source.getFeatures()[0]);
    expect(style.getStroke()).toBeFalsy();
    expect(style.getFill()).toBeTruthy();
  });

  it('기본(동기화 ON)은 분류색을 어둡게 한 색이다', () => {
    const { info } = makeCartogram();
    expect(strokeOf(info).color).toBe(choroplethTool.darkenColor('#ffffcc'));
  });

  it('동기화를 끄면 지정한 단일 색을 쓴다', () => {
    const { id, info } = makeCartogram();
    info.strokeSyncToFill = false;
    info.strokeColor = '#00ff00';
    layerManager.updateLayerStyle(id);

    expect(strokeOf(info).color).toBe('#00ff00');
  });

  it('fillOpacity 변경이 반영된다', () => {
    const { id, info } = makeCartogram();
    layerManager.setLayerFillOpacity(id, 0.4);

    const style = info.olLayer.getStyle()(info.source.getFeatures()[0]);
    expect(style.getFill().getColor()).toContain('0.4');
  });

  it('라벨이 걸린 카토그램은 setStyle로 라벨 래퍼를 덮지 않는다', () => {
    const { id, info } = makeCartogram();

    // LabelTool이 라벨을 붙였을 때의 상태를 흉내낸다 (LabelTool.js:201, 267)
    const labelWrapper = info.olLayer.getStyle();
    info.olLayer._originalStyle = labelWrapper;
    info.olLayer._hasLabel = true;
    const setStyleBefore = info.olLayer.getStyle();

    layerManager.setLayerFillOpacity(id, 0.4);

    // 래퍼는 그대로 두고 _originalStyle만 갱신되어야 한다
    expect(info.olLayer.getStyle()).toBe(setStyleBefore);
    expect(info.olLayer._originalStyle).not.toBe(labelWrapper);
    expect(typeof info.olLayer._originalStyle).toBe('function');
  });
});

describe('CartogramTool.attachCartogram', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('생성된 카토그램의 스타일 메타데이터가 실제 렌더링과 일치한다', () => {
    const id = layerManager.addLayer({
      name: '카토그램',
      type: 'vector',
      features: [square(10)],
      color: '#3388ff'
    });

    cartogramTool.attachCartogram(id, {
      attribute: 'pop',
      colors: ['#ffffcc', '#800026'],
      breaks: [0, 50, 100]
    });

    const info = layerManager.getLayer(id);
    // addLayer의 일반 기본값(0.3)이 아니라 카토그램의 실제 렌더링 값이어야 한다
    expect(info.fillOpacity).toBe(0.85);
    expect(info.strokeColor).toBe('#333');
    expect(info.strokeWidth).toBe(1);
    expect(info._cartogramConfig.attribute).toBe('pop');
    // 스타일이 실제로 걸렸는지 (분류색 함수)
    expect(typeof info.olLayer.getStyle()).toBe('function');
  });

  it('메타데이터의 fillOpacity가 실제 렌더링과 같다', () => {
    const id = layerManager.addLayer({
      name: '카토그램',
      type: 'vector',
      features: [square(10)],
      color: '#3388ff'
    });
    cartogramTool.attachCartogram(id, {
      attribute: 'pop',
      colors: ['#ffffcc', '#800026'],
      breaks: [0, 50, 100]
    });

    const info = layerManager.getLayer(id);
    const style = info.olLayer.getStyle()(info.source.getFeatures()[0]);
    // 패널이 표시하는 값(fillOpacity)과 그려지는 값이 같아야 한다
    expect(style.getFill().getColor()).toContain(String(info.fillOpacity));
  });
});
