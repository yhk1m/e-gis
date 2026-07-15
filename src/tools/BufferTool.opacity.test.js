// © 2026 김용현
// @vitest-environment jsdom
/**
 * BufferPanel의 투명도 슬라이더가 실제로 동작하는지 검증.
 *
 * 버그: 패널은 opacity를 받아 bufferTool.createBuffer에 넘기지만, BufferTool은
 * 그 값을 어디에도 쓰지 않았다(addLayer는 opacity를 받지 않고, getBufferStyle은
 * 정의만 되어 있고 호출되지 않는다). 슬라이더를 아무리 움직여도 결과가 같았다.
 *
 * 올바른 경로는 layerManager.setLayerFillOpacity — LayerPanel의 투명도 편집이
 * 쓰는 것과 같은 API다(LayerPanel.js:826). layerInfo.fillOpacity를 설정하고
 * updateLayerStyle을 부르므로 실제 스타일과 패널 표시값이 어긋나지 않는다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { layerManager } from '../core/LayerManager.js';
import { bufferTool } from './BufferTool.js';

/** 서울 근처의 작은 사각형 (EPSG:3857) */
function seoulSquare() {
  const ring = [
    fromLonLat([127.0, 37.5]),
    fromLonLat([127.01, 37.5]),
    fromLonLat([127.01, 37.51]),
    fromLonLat([127.0, 37.51]),
    fromLonLat([127.0, 37.5])
  ];
  return new Feature({ geometry: new Polygon([ring]) });
}

function fillAlpha(style) {
  const color = style.getFill().getColor();
  const m = /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(color);
  return m ? parseFloat(m[1]) : null;
}

describe('BufferTool — 투명도 옵션', () => {
  let sourceId;

  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
    sourceId = layerManager.addLayer({
      name: '원본',
      features: [seoulSquare()],
      color: '#3388ff'
    });
  });

  it('넘긴 투명도가 layerInfo와 실제 스타일에 반영된다', () => {
    const result = bufferTool.createBuffer(sourceId, 500, 'meters', {
      color: '#ff0000',
      opacity: 0.7
    });

    const buffer = layerManager.getLayer(result.layerId);
    expect(buffer.fillOpacity).toBe(0.7);
    expect(fillAlpha(buffer.olLayer.getStyle())).toBe(0.7);
  });

  it('투명도를 주지 않으면 기본값(0.3)을 유지한다', () => {
    const result = bufferTool.createBuffer(sourceId, 500, 'meters', {
      color: '#ff0000'
    });

    const buffer = layerManager.getLayer(result.layerId);
    expect(buffer.fillOpacity).toBe(0.3);
  });

  it('서로 다른 투명도는 서로 다른 결과를 낸다', () => {
    const a = bufferTool.createBuffer(sourceId, 500, 'meters', { opacity: 0.2 });
    const b = bufferTool.createBuffer(sourceId, 500, 'meters', { opacity: 0.9 });

    const alphaA = fillAlpha(layerManager.getLayer(a.layerId).olLayer.getStyle());
    const alphaB = fillAlpha(layerManager.getLayer(b.layerId).olLayer.getStyle());

    expect(alphaA).not.toBe(alphaB);
  });
});
