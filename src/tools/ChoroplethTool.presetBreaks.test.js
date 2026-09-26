// @vitest-environment jsdom
// © 2026 김용현
/**
 * 시계열은 연도 사이에 구간을 공유해야 하므로 apply 에 미리 계산한 구간을 넘긴다.
 * 넘긴 구간은 그대로 쓰이고, 파생 레이어 이름·범례 제목도 지정할 수 있어야 한다.
 * (스펙 4단계: "ChoroplethTool.apply 에 options.breaks 를 받는 확장 하나")
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { choroplethTool } from './ChoroplethTool.js';

HTMLCanvasElement.prototype.getContext = () => null;

function cell(props) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    ...props
  });
}

function sourceLayer() {
  return layerManager.addLayer({
    name: '구',
    type: 'vector',
    features: [cell({ '2015': 10, '2020': 40 }), cell({ '2015': 20, '2020': 80 }), cell({ '2015': 30, '2020': 120 })]
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

describe('ChoroplethTool.apply options.breaks', () => {
  it('넘긴 구간을 계산하지 않고 그대로 쓴다', () => {
    const id = sourceLayer();
    const breaks = [0, 40, 80, 120];
    const result = choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 3, { breaks });
    expect(result.breaks).toEqual(breaks);
    expect(result.breaks).not.toBe(breaks);                    // 복사본
    const cfg = layerManager.getLayer(result.layerId)._choroplethConfig;
    expect(cfg.breaks).toEqual(breaks);
    expect(cfg.colors).toHaveLength(3);
  });

  it('구간을 안 넘기면 예전처럼 값에서 계산한다', () => {
    const id = sourceLayer();
    const result = choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 2, {});
    expect(result.breaks).toEqual([10, 20, 30]);
  });

  it('구간 개수가 계급 수와 안 맞거나 숫자가 아니면 무시하고 계산한다', () => {
    const id = sourceLayer();
    expect(choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 2, { breaks: [0, 40, 80, 120] }).breaks)
      .toEqual([10, 20, 30]);
    expect(choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 2, { breaks: [0, 'x', 80] }).breaks)
      .toEqual([10, 20, 30]);
  });

  it('name·title 을 지정할 수 있고, 없으면 예전 규칙', () => {
    const id = sourceLayer();
    const a = choroplethTool.apply(id, '2015', 'blues', 'equalInterval', 3, { name: '구_시계열_2015~2020', title: '구 (2015~2020)' });
    expect(layerManager.getLayer(a.layerId).name).toBe('구_시계열_2015~2020');
    expect(layerManager.getLayer(a.layerId)._choroplethConfig.title).toBe('구 (2015~2020)');
    expect(document.querySelector(`#choropleth-legend-${a.layerId}`).textContent).toContain('구 (2015~2020)');
    const b = choroplethTool.apply(id, '2020', 'blues', 'equalInterval', 3, {});
    expect(layerManager.getLayer(b.layerId).name).toBe('구_단계구분_2020');
    expect(layerManager.getLayer(b.layerId)._choroplethConfig.title).toBe('구 (2020)');
  });
});
