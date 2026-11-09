// © 2026 김용현
// @vitest-environment jsdom
/**
 * 레이어 패널에서 여러 레이어를 골라 둔 채 분석 패널을 열면
 * 「선택한 레이어 N개 모두」가 미리 골라지고, 실행하면 레이어마다 따로 적용된다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
};

import { layerManager } from '../../core/LayerManager.js';
import { MULTI_LAYER_VALUE } from '../../utils/layerSelect.js';
import { bufferPanel } from './BufferPanel.js';
import { fieldCalculatorPanel } from './FieldCalculatorPanel.js';
import { heatmapPanel } from './HeatmapPanel.js';

function addPoints(name, props) {
  return layerManager.addLayer({
    name, type: 'vector', geometryType: 'Point',
    source: new VectorSource({
      features: [0, 1].map(i => new Feature({ geometry: new Point(fromLonLat([127 + i * 0.01, 37.5])), ...props }))
    })
  });
}

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  layerManager.clear();
  document.body.innerHTML = '<span id="status-message">준비</span>';
});

describe('버퍼 패널', () => {
  it('2개 이상 골라 두면 「모두」가 미리 골라지고 선택은 그대로 남는다', () => {
    const a = addPoints('학교', { pop: 1 });
    const b = addPoints('병원', { pop: 2 });
    addPoints('공원', { pop: 3 });
    layerManager.setSelection([a, b]);

    bufferPanel.show();
    const select = document.getElementById('buffer-layer');
    expect(select.value).toBe(MULTI_LAYER_VALUE);
    expect(select.options[0].textContent).toBe('선택한 레이어 2개 모두');
    expect(layerManager.getSelectedLayerIds()).toEqual([a, b]);
    bufferPanel.close();
  });

  it('하나만 골랐으면 「모두」 항목이 없다', () => {
    const a = addPoints('학교', { pop: 1 });
    addPoints('병원', { pop: 2 });
    layerManager.setSelection([a]);

    bufferPanel.show();
    const select = document.getElementById('buffer-layer');
    expect(select.value).toBe(a);
    expect(select.innerHTML).not.toContain(MULTI_LAYER_VALUE);
    bufferPanel.close();
  });

  it('실행하면 레이어마다 버퍼 레이어가 따로 생기고 상태 표시줄에 알린다', async () => {
    const ids = [addPoints('학교', {}), addPoints('병원', {}), addPoints('공원', {})];
    layerManager.setSelection(ids);
    const before = layerManager.getAllLayers().length;

    bufferPanel.show();
    document.getElementById('buffer-apply').click();
    await flush();

    const added = layerManager.getAllLayers().slice(before);
    expect(layerManager.getAllLayers().length).toBe(before + 3);
    expect(document.getElementById('status-message').textContent).toBe('3개 레이어에 적용');
    expect(document.querySelector('.buffer-modal')).toBeNull();
    expect(added.length).toBe(3);
  });
});

describe('필드 계산기', () => {
  it('공통 필드만 보여 주고 새 필드를 모든 레이어에 넣는다', async () => {
    const a = addPoints('학교', { pop: 10, only_a: 1 });
    const b = addPoints('병원', { pop: 20, only_b: 1 });
    layerManager.setSelection([a, b]);

    fieldCalculatorPanel.show();
    expect(document.getElementById('field-calc-layer').value).toBe(MULTI_LAYER_VALUE);
    const fieldButtons = [...document.querySelectorAll('#field-calc-field-buttons .field-btn')].map(x => x.dataset.field);
    expect(fieldButtons).toEqual(['pop']);

    document.getElementById('field-calc-name').value = 'pop2';
    document.getElementById('field-calc-expr').value = '[pop] * 2';
    document.getElementById('field-calc-apply').click();
    await flush();

    for (const [id, want] of [[a, 20], [b, 40]]) {
      const feats = layerManager.getLayer(id).source.getFeatures();
      expect(feats.every(f => f.get('pop2') === want)).toBe(true);
    }
    expect(document.getElementById('status-message').textContent).toBe('2개 레이어에 적용');
  });
});

describe('히트맵 패널', () => {
  it('가중치 필드는 모든 레이어에 있는 숫자 필드만', () => {
    const a = addPoints('학교', { pop: 10, area: 3 });
    const b = addPoints('병원', { pop: 20 });
    layerManager.setSelection([a, b]);

    heatmapPanel.show();
    expect(document.getElementById('heatmap-layer').value).toBe(MULTI_LAYER_VALUE);
    const weights = [...document.getElementById('heatmap-weight').options].map(o => o.value);
    expect(weights).toEqual(['', 'pop']);
    heatmapPanel.close();
  });
});

describe('격자 패널', () => {
  it('레이어마다 「이름 격자 크기」 레이어를 만든다', async () => {
    const { gridPanel } = await import('./GridPanel.js');
    const a = addPoints('학교', { pop: 10 });
    const b = addPoints('병원', { pop: 20 });
    layerManager.setSelection([a, b]);

    gridPanel.show();
    expect(document.getElementById('grid-layer').value).toBe(MULTI_LAYER_VALUE);
    expect(document.getElementById('grid-name').disabled).toBe(true);
    document.getElementById('grid-apply').click();
    await flush();

    const names = layerManager.getAllLayers().map(l => l.name);
    expect(names).toContain('학교 격자 1km');
    expect(names).toContain('병원 격자 1km');
    expect(document.getElementById('status-message').textContent).toBe('2개 레이어에 적용');
  });
});
