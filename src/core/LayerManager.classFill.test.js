// © 2026 김용현
// @vitest-environment jsdom
/**
 * 단계구분도 채움 경로.
 * - fills 가 없으면 예전과 똑같은 rgba 문자열(동작 불변).
 * - apply() 가 만든 레이어는 두께 1·투명도 0.7 (예전 apply 의 스타일 함수와 같다).
 * - fills 가 있으면 classFillColor 를 거친다 — jsdom 엔 2D 컨텍스트가 없어 기준색 문자열로
 *   물러서지만 예외는 없어야 한다. 실제 패턴은 하네스가 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from './LayerManager.js';
import { choroplethTool } from '../tools/ChoroplethTool.js';

HTMLCanvasElement.prototype.getContext = () => null;

function square(pop) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    pop
  });
}

function styleOf(info) {
  const styleFn = info.olLayer.getStyle();
  return styleFn(info.source.getFeatures()[0]);
}

function makeChoropleth(fills) {
  const id = layerManager.addLayer({ name: '단계구분도', type: 'choropleth', features: [square(10)], color: '#3388ff' });
  const info = layerManager.getLayer(id);
  info._choroplethConfig = { attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'], tool: choroplethTool };
  if (fills) info._choroplethConfig.fills = fills;
  info.fillOpacity = 0.7;
  return { id, info };
}

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

describe('updateLayerStyle 채움', () => {
  it('fills 가 없으면 기준색 rgba 문자열', () => {
    const { id, info } = makeChoropleth();
    layerManager.updateLayerStyle(id);
    expect(styleOf(info).getFill().getColor()).toBe('rgba(255, 255, 204, 0.7)');
  });

  it('fills 가 있으면 classFillColor 를 거치고 컨텍스트가 없으면 문자열로 물러선다', () => {
    const { id, info } = makeChoropleth([{ kind: 'hatch' }, { kind: 'solid' }]);
    const spy = vi.spyOn(choroplethTool, 'classFillColor');
    layerManager.updateLayerStyle(id);
    const color = styleOf(info).getFill().getColor();
    expect(spy).toHaveBeenCalledWith(info._choroplethConfig, 0, 0.7);
    expect(color).toBe('rgba(255, 255, 204, 0.7)');
    spy.mockRestore();
  });

  it('classFillColor 는 구간 밖 인덱스면 첫 색을 쓴다', () => {
    const cfg = { colors: ['#ffffcc', '#800026'] };
    expect(choroplethTool.classFillColor(cfg, 5, 1)).toBe('rgba(255, 255, 204, 1)');
  });
});

describe('ChoroplethTool.apply → updateLayerStyle', () => {
  it('파생 레이어는 두께 1·투명도 0.7 로 그려지고 채움은 rgba 문자열', () => {
    const srcId = layerManager.addLayer({ name: '원본', type: 'vector', features: [square(10), square(90)], color: '#3388ff' });
    const result = choroplethTool.apply(srcId, 'pop', 'blues', 'equalInterval', 2);
    expect(result).toBeTruthy();
    const info = layerManager.getLayer(result.layerId);
    expect(info.fillOpacity).toBe(0.7);
    expect(info.strokeWidth).toBe(1);
    const style = styleOf(info);
    expect(style.getStroke().getWidth()).toBe(1);
    expect(style.getFill().getColor()).toBe(choroplethTool.hexToRgba(result.colors[0], 0.7));
    expect(style.getStroke().getColor()).toBe(choroplethTool.darkenColor(result.colors[0]));
  });

  it('값이 숫자가 아니면 회색', () => {
    const srcId = layerManager.addLayer({ name: '원본', type: 'vector', features: [square('x'), square(90)], color: '#3388ff' });
    const result = choroplethTool.apply(srcId, 'pop', 'blues', 'equalInterval', 2);
    const info = layerManager.getLayer(result.layerId);
    expect(styleOf(info).getFill().getColor()).toBe('rgba(128,128,128,0.7)');
  });
});
