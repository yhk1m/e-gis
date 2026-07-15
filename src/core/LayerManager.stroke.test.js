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
