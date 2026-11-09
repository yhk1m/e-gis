// © 2026 김용현
// @vitest-environment jsdom
/**
 * 원본 포인트 레이어를 지워도 그 레이어로 만든 히트맵이 지도에 남던 결함의 재현.
 *
 * 히트맵은 원본 피처를 복제한 별도 레이어라, 원본이 지워져도 그대로 그려졌다.
 * LAYER_REMOVED 처리는 지워진 id 가 히트맵 자신일 때만 보고 있었다.
 * 도형표현도(ChartMapTool)처럼 원본이 지워지면 거기서 만든 히트맵도 함께 지운다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom 엔 canvas 그라디언트가 없어 OL Heatmap 생성자가 죽는다 — 같은 모양의 벡터 레이어로 바꾼다
vi.mock('ol/layer/Heatmap', async () => {
  const { default: VectorLayer } = await import('ol/layer/Vector.js');
  return { default: VectorLayer };
});
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorSource from 'ol/source/Vector.js';
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
};

import { layerManager } from '../core/LayerManager.js';
import { heatmapTool } from './HeatmapTool.js';

function addPoints(name = 'pts') {
  return layerManager.addLayer({
    name, type: 'vector', geometryType: 'Point',
    source: new VectorSource({ features: [0, 1, 2].map(i => new Feature(new Point([i * 100, 0]))) })
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  layerManager.clear();
});

describe('히트맵 원본 레이어 삭제', () => {
  it('원본 포인트 레이어를 지우면 그 히트맵 레이어와 범례도 사라진다', () => {
    const src = addPoints();
    const heat = heatmapTool.createHeatmap(src, {});
    expect(layerManager.getLayer(heat)).toBeTruthy();
    expect(document.getElementById(`heatmap-legend-${heat}`)).toBeTruthy();

    layerManager.removeLayer(src);

    expect(layerManager.getLayer(heat)).toBeFalsy();
    expect(heatmapTool.heatmapLayers.has(heat)).toBe(false);
    expect(document.getElementById(`heatmap-legend-${heat}`)).toBeNull();
  });

  it('다른 포인트 레이어로 만든 히트맵은 그대로 둔다', () => {
    const a = addPoints('a');
    const b = addPoints('b');
    heatmapTool.createHeatmap(a, {});
    const heatB = heatmapTool.createHeatmap(b, {});

    layerManager.removeLayer(a);

    expect(layerManager.getLayer(heatB)).toBeTruthy();
    expect(document.getElementById(`heatmap-legend-${heatB}`)).toBeTruthy();
  });

  it('히트맵 레이어만 지우면 원본 포인트 레이어는 남는다', () => {
    const src = addPoints();
    const heat = heatmapTool.createHeatmap(src, {});

    layerManager.removeLayer(heat);

    expect(layerManager.getLayer(src)).toBeTruthy();
    expect(document.getElementById(`heatmap-legend-${heat}`)).toBeNull();
  });
});
