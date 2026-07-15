// © 2026 김용현
// @vitest-environment jsdom
/**
 * 보로노이 결과 레이어의 투명도 옵션 검증.
 *
 * 설계 초안은 "addLayer가 opacity를 받지 않으니 슬라이더를 넣으면 죽은 컨트롤이 된다"며
 * 투명도를 뺐으나, 이는 오판이었다. layerManager.setLayerFillOpacity가 정식 경로이며
 * LayerPanel의 투명도 편집이 이미 그것을 쓴다(LayerPanel.js:826).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { fromLonLat } from 'ol/proj.js';
import { layerManager } from '../core/LayerManager.js';
import { voronoiTool } from './VoronoiTool.js';

function stations() {
  return [
    [126.98, 37.57],
    [129.08, 35.18],
    [127.38, 36.35]
  ].map(ll => new Feature({ geometry: new Point(fromLonLat(ll)) }));
}

function fillAlpha(style) {
  const m = /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(style.getFill().getColor());
  return m ? parseFloat(m[1]) : null;
}

describe('VoronoiTool — 투명도 옵션', () => {
  let sourceId;

  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
    sourceId = layerManager.addLayer({
      name: '관측소',
      features: stations(),
      color: '#3388ff'
    });
  });

  it('넘긴 투명도가 layerInfo와 실제 스타일에 반영된다', () => {
    const result = voronoiTool.createVoronoi(sourceId, { color: '#ff0000', opacity: 0.8 });
    const cells = layerManager.getLayer(result.layerId);

    expect(cells.fillOpacity).toBe(0.8);
    expect(fillAlpha(cells.olLayer.getStyle())).toBe(0.8);
  });

  it('투명도를 주지 않으면 기본값(0.3)을 유지한다', () => {
    const result = voronoiTool.createVoronoi(sourceId, { color: '#ff0000' });
    expect(layerManager.getLayer(result.layerId).fillOpacity).toBe(0.3);
  });
});
