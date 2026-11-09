// © 2026 김용현
// @vitest-environment jsdom
/**
 * 레이어 여러 개 고르기(선택 모드)와 작업 줄, 스타일 한꺼번에 바꾸기.
 * 설계: docs/superpowers/specs/2026-11-09-multi-layer-batch-design.md 1~3절
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
};

import { layerManager } from '../../core/LayerManager.js';
import { LayerPanel } from './LayerPanel.js';

document.body.innerHTML =
  '<div id="tab-layers"><div class="panel-header"><span class="panel-header-title">레이어 목록</span>' +
  '<div class="panel-header-actions"></div></div>' +
  '<div class="panel-content"><ul id="layer-list"></ul></div></div>';
const layerPanel = new LayerPanel('layer-list');

const geoms = {
  Polygon: () => new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
  Point: () => new Point([0, 0]),
  LineString: () => new LineString([[0, 0], [100, 100]])
};
function add(name, geometryType, extra = {}) {
  return layerManager.addLayer({
    name, geometryType, color: '#3388ff',
    features: [new Feature({ geometry: geoms[geometryType] ? geoms[geometryType]() : geoms.Polygon() })],
    ...extra
  });
}
const row = (id) => document.querySelector(`.layer-item[data-layer-id="${id}"]`);
const click = (el, opts = {}) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, ...opts }));
const modeBtn = () => document.querySelector('.layer-select-mode-btn');

beforeEach(() => {
  layerPanel.setSelectMode(false);
  layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  layerManager.clearSelection();
  document.querySelectorAll('.color-picker-popup, .layer-context-menu').forEach(p => p.remove());
});

describe('선택 모드', () => {
  it('머리줄에 「여러 개 선택」 버튼이 하나 생기고 이모지가 없다', () => {
    expect(document.querySelectorAll('.layer-select-mode-btn').length).toBe(1);
    expect(modeBtn().textContent).toContain('여러 개 선택');
    expect(modeBtn().querySelector('svg')).not.toBeNull();
    expect(modeBtn().getAttribute('aria-pressed')).toBe('false');
  });

  it('켜면 줄마다 선택 칸이 생기고, 줄을 누르면 선택에 더하고 빼며, 끄면 하나로 줄어든다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Point'); const c = add('C', 'LineString');
    expect(row(a).querySelector('.layer-select-check')).toBeNull();

    click(modeBtn());
    expect(layerPanel.selectMode).toBe(true);
    expect(modeBtn().getAttribute('aria-pressed')).toBe('true');
    expect(row(a).querySelector('.layer-select-check')).not.toBeNull();

    click(row(a).querySelector('.layer-name'));
    click(row(b).querySelector('.layer-name'));
    click(row(c).querySelector('.layer-select-check'));
    expect(layerManager.getSelectedLayerIds().sort()).toEqual([a, b, c].sort());
    expect(row(b).querySelector('.layer-select-check').getAttribute('aria-checked')).toBe('true');

    click(row(b).querySelector('.layer-name')); // 다시 누르면 빠진다
    expect(layerManager.getSelectedLayerIds().sort()).toEqual([a, c].sort());

    click(modeBtn());
    expect(layerPanel.selectMode).toBe(false);
    expect(layerManager.getSelectedLayerIds()).toEqual([c]); // 마지막으로 고른 것 하나
    expect(row(a).querySelector('.layer-select-check')).toBeNull();
  });

  it('Esc 로도 꺼진다', () => {
    const a = add('A', 'Polygon');
    layerPanel.setSelectMode(true);
    click(row(a).querySelector('.layer-name'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(layerPanel.selectMode).toBe(false);
  });

  it('모드가 아니면 보통 클릭은 하나만, Ctrl 클릭은 더하기(기존 그대로)', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Polygon');
    click(row(a).querySelector('.layer-name'));
    click(row(b).querySelector('.layer-name'));
    expect(layerManager.getSelectedLayerIds()).toEqual([b]);
    click(row(a).querySelector('.layer-name'), { ctrlKey: true });
    expect(layerManager.getSelectedLayerIds().sort()).toEqual([a, b].sort());
  });

  it('선택 모드에서 표시 체크박스는 선택이 아니라 표시만 바꾼다', () => {
    const a = add('A', 'Polygon');
    layerPanel.setSelectMode(true);
    click(row(a).querySelector('.layer-visibility'));
    expect(layerManager.getSelectedLayerIds()).toEqual([]);
    expect(layerManager.getLayer(a).visible).toBe(false);
  });
});

describe('작업 줄', () => {
  it('2개 이상이면 작업 버튼이 모두 나오고 이모지가 없다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Polygon');
    layerManager.setSelection([a, b]);
    const bar = document.querySelector('.layer-multi-select-info');
    expect(bar).not.toBeNull();
    const actions = [...bar.querySelectorAll('[data-batch]')].map(x => x.dataset.batch);
    expect(actions).toEqual(['style', 'duplicate', 'export', 'field-calc', 'zoom', 'visibility', 'remove', 'clear']);
    expect(bar.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}←-⇿·—]/u);
  });

  it('복사는 고른 레이어마다 하나씩 만들고 선택은 그대로 둔다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Point');
    layerManager.setSelection([a, b]);
    click(document.querySelector('[data-batch="duplicate"]'));
    const names = layerManager.getAllLayers().map(l => l.name);
    expect(names).toContain('A (사본)');
    expect(names).toContain('B (사본)');
    expect(layerManager.getSelectedLayerIds().sort()).toEqual([a, b].sort());
  });

  it('보이기/숨기기: 하나라도 보이면 모두 숨기고, 모두 숨겨져 있으면 모두 보인다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Polygon');
    layerManager.setSelection([a, b]);
    click(document.querySelector('[data-batch="visibility"]'));
    expect(layerManager.getLayer(a).visible).toBe(false);
    expect(layerManager.getLayer(b).visible).toBe(false);
    click(document.querySelector('[data-batch="visibility"]'));
    expect(layerManager.getLayer(a).visible).toBe(true);
  });

  it('다중 우클릭 메뉴에도 같은 작업이 있다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Polygon');
    layerManager.setSelection([a, b]);
    click(row(a).querySelector('.layer-menu-btn'));
    const items = [...document.querySelectorAll('.layer-context-menu [data-action]')].map(x => x.dataset.action);
    ['style-all', 'duplicate-all', 'export-all', 'field-calc-all', 'zoom-all', 'show-all', 'hide-all', 'remove-all']
      .forEach(act => expect(items).toContain(act));
  });
});

describe('스타일 한꺼번에', () => {
  it('고른 레이어 모두의 면 색이 바뀌고, 못 바꾸는 레이어는 건너뛰며 한 줄로 알린다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Polygon');
    const r = layerManager.addLayer({ name: 'R', type: 'raster', geometryType: 'Polygon' });
    layerPanel.showColorPicker([a, b, r]);
    const picker = document.querySelector('.color-picker-popup');
    expect(picker.querySelector('.style-excluded-note').textContent).toContain('1개');

    const input = picker.querySelector('.fill-color-input');
    input.value = '#ff0000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layerManager.getLayer(a).fillColor).toBe('#ff0000');
    expect(layerManager.getLayer(b).fillColor).toBe('#ff0000');
    expect(layerManager.getLayer(r).fillColor).not.toBe('#ff0000');
  });

  it('점, 선, 면이 섞이면 면 색 칸이 없고 선 색은 모두에 걸린다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Point'); const c = add('C', 'LineString');
    layerPanel.showColorPicker([a, b, c]);
    const picker = document.querySelector('.color-picker-popup');
    expect(picker.querySelector('.fill-color-input')).toBeNull();
    expect(picker.querySelector('.style-excluded-note')).toBeNull();
    click(picker.querySelector('.color-item[data-stroke-color="' + layerManager.getColorSwatches()[3].color + '"]'));
    const col = layerManager.getColorSwatches()[3].color;
    expect(layerManager.getLayer(a).strokeColor).toBe(col);
    expect(layerManager.getLayer(b).strokeColor).toBe(col);
    expect(layerManager.getLayer(c).color).toBe(col); // 선은 단일 팝업처럼 색 자체를 바꾼다
  });

  it('선 두께 슬라이더도 모두에 걸린다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'LineString');
    layerPanel.showColorPicker([a, b]);
    const slider = document.querySelector('.color-picker-popup .stroke-width-slider');
    slider.value = '4';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layerManager.getLayer(a).strokeWidth).toBe(4);
    expect(layerManager.getLayer(b).strokeWidth).toBe(4);
  });

  it('id 하나(문자열)나 길이 1 배열은 단일 팝업 그대로', () => {
    const a = add('A', 'LineString');
    layerPanel.showColorPicker(a);
    let picker = document.querySelector('.color-picker-popup');
    expect(picker.classList.contains('multi')).toBe(false);
    expect(picker.querySelector('.color-input')).not.toBeNull(); // 선 레이어 단일 팝업의 색 칸
    picker.remove();
    layerPanel.showColorPicker([a]);
    picker = document.querySelector('.color-picker-popup');
    expect(picker.classList.contains('multi')).toBe(false);
    const input = picker.querySelector('.color-input');
    input.value = '#00ff00';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layerManager.getLayer(a).color).toBe('#00ff00');
  });

  it('스타일 버튼을 눌러도 선택이 유지된다', () => {
    const a = add('A', 'Polygon'); const b = add('B', 'Polygon');
    layerManager.setSelection([a, b]);
    click(document.querySelector('[data-batch="style"]'));
    expect(document.querySelector('.color-picker-popup.multi')).not.toBeNull();
    expect(layerManager.getSelectedLayerIds().length).toBe(2);
  });
});
