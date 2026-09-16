// © 2026 김용현
// @vitest-environment jsdom
/**
 * 숨긴 레이어의 범례가 되살아나는 결함의 재현.
 *
 * 범례 표시/숨김은 레이어 패널의 체크박스 핸들러 한 곳에서만 맞춰졌다. 그래서
 *  - 자동 저장/프로젝트 복원이 `visible:false` 레이어의 범례를 만들면 그대로 보였고,
 *  - 지도 내보내기 창의 '범례 표시'가 모든 범례에 display=''를 걸어 숨긴 것까지 되살렸다.
 * 이제 범례를 만드는 곳과 켜고 끄는 곳 모두 legendVisibility.js를 거친다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import VectorSource from 'ol/source/Vector.js';
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
};

import { layerManager } from '../core/LayerManager.js';
import { applyLegendVisibility, syncLegendVisibility } from './legendVisibility.js';
import { choroplethTool } from './ChoroplethTool.js';
import { heatmapTool } from './HeatmapTool.js';
import { chartMapTool } from './ChartMapTool.js';
import { exportPanel } from '../ui/panels/ExportPanel.js';

function square(pop) {
  return new Feature({ geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]), pop });
}

function addLayer(visible, extra = {}) {
  return layerManager.addLayer({
    name: 'L', type: 'vector', geometryType: 'Polygon', visible,
    source: new VectorSource({ features: [square(10), square(20)] }),
    ...extra
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
});

describe('applyLegendVisibility', () => {
  it('해당 레이어의 범례만 숨기고 다른 레이어 범례는 건드리지 않는다', () => {
    document.getElementById('map').innerHTML =
      '<div id="choropleth-legend-a"></div><div id="chart-legend-a"></div><div id="legend-b"></div>';
    applyLegendVisibility('a', false);
    expect(document.getElementById('choropleth-legend-a').style.display).toBe('none');
    expect(document.getElementById('chart-legend-a').style.display).toBe('none');
    expect(document.getElementById('legend-b').style.display).toBe('');
    applyLegendVisibility('a', true);
    expect(document.getElementById('choropleth-legend-a').style.display).toBe('');
  });
});

describe('숨긴 레이어의 범례는 만들 때부터 숨겨진다 (복원 경로)', () => {
  it('단계구분도', () => {
    const id = addLayer(false);
    choroplethTool.createLegend(id, 'L', 'pop', [0, 10, 20], ['#eee', '#333']);
    expect(document.getElementById(`choropleth-legend-${id}`).style.display).toBe('none');
  });

  it('히트맵', () => {
    const id = addLayer(false, { geometryType: 'Point', source: new VectorSource({ features: [new Feature(new Point([0, 0]))] }) });
    heatmapTool.createLegend(id, 'L', ['#00f', '#0ff', '#0f0', '#ff0', '#f00']);
    expect(document.getElementById(`heatmap-legend-${id}`).style.display).toBe('none');
  });

  it('도형표현도', () => {
    const id = addLayer(false);
    chartMapTool.createLegend(id, 'L', 'pie', ['pop'], { pop: 20 });
    expect(document.getElementById(`chart-legend-${id}`).style.display).toBe('none');
  });

  it('보이는 레이어의 범례는 그대로 보인다', () => {
    const id = addLayer(true);
    choroplethTool.createLegend(id, 'L', 'pop', [0, 10, 20], ['#eee', '#333']);
    expect(document.getElementById(`choropleth-legend-${id}`).style.display).toBe('');
  });

  it('syncLegendVisibility는 레이어의 현재 가시성을 그대로 반영한다', () => {
    const id = addLayer(false);
    document.getElementById('map').innerHTML = `<div id="legend-${id}"></div>`;
    expect(syncLegendVisibility(id)).toBe(false);
    expect(document.getElementById(`legend-${id}`).style.display).toBe('none');
  });
});

describe('지도 내보내기 창의 범례 표시', () => {
  it("'범례 표시'를 켜도 숨긴 레이어의 범례는 되살리지 않는다", () => {
    const hidden = addLayer(false);
    const shown = addLayer(true);
    document.getElementById('map').innerHTML =
      `<div class="choropleth-legend" id="choropleth-legend-${hidden}" style="display:none"></div>` +
      `<div class="choropleth-legend" id="choropleth-legend-${shown}"></div>`;
    const panel = exportPanel;
    panel.mapElements.showLegend = true;
    panel.applyMapElements();
    expect(document.getElementById(`choropleth-legend-${hidden}`).style.display).toBe('none');
    expect(document.getElementById(`choropleth-legend-${shown}`).style.display).toBe('');
  });

  it("'범례 표시'를 끄면 보이는 레이어의 범례도 숨긴다", () => {
    const shown = addLayer(true);
    document.getElementById('map').innerHTML = `<div class="choropleth-legend" id="choropleth-legend-${shown}"></div>`;
    const panel = exportPanel;
    panel.mapElements.showLegend = false;
    panel.applyMapElements();
    expect(document.getElementById(`choropleth-legend-${shown}`).style.display).toBe('none');
  });
});
