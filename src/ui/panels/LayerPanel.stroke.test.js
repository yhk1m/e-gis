// © 2026 김용현
// @vitest-environment jsdom
/**
 * 스타일 편집 팝업의 분류 레이어 분기 검증.
 *
 * 로직(LayerManager·CartogramTool)은 테스트가 덮지만 이 팝업은 커버리지가 없었다.
 * 체크박스가 실제로 그려지는지, 면 색상 섹션이 정말 숨는지는 마크업을 봐야 안다.
 *
 * 분류 레이어(단계구분도·카토그램)는 채우기 색을 분류 설정이 소유한다.
 * 사용자는 투명도와 테두리만 바꾼다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
// jsdom에 없는 API 스텁. 팝업 코드가 테마 감지 등에 쓴다.
window.matchMedia = window.matchMedia || function () {
  return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
};

import { layerManager } from '../../core/LayerManager.js';
import { LayerPanel } from './LayerPanel.js';

// LayerPanel은 싱글턴이 아니라 클래스 export이고, 생성자가 #layer-list 컨테이너를
// 찾아 이벤트를 건다(LayerPanel.js:16, 44). 실제 앱의 DOM을 최소로 흉내낸다.
// showColorPicker 자체는 layerManager와 팝업 DOM만 만지므로 이걸로 충분하다.
document.body.innerHTML = '<div class="panel-content"><div id="layer-list"></div></div>';
const layerPanel = new LayerPanel();

function square(pop) {
  return new Feature({
    geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    pop
  });
}

/** 팝업을 열고 마크업을 돌려준다 */
function openPicker(layerId) {
  layerPanel.showColorPicker(layerId);
  const picker = document.querySelector('.color-picker-popup');
  return picker;
}

function addPolygonLayer(name) {
  return layerManager.addLayer({
    name,
    geometryType: 'Polygon',
    features: [square(10)],
    color: '#3388ff'
  });
}

describe('스타일 편집 팝업 — 분류 레이어 분기', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
    // body 전체를 비우면 생성자가 잡아 둔 #layer-list가 사라진다. 팝업만 치운다.
    document.querySelectorAll('.color-picker-popup').forEach(p => p.remove());
  });

  it('일반 폴리곤: 면 색상은 있고 동기화 체크박스는 없다', () => {
    const id = addPolygonLayer('일반');
    const picker = openPicker(id);

    expect(picker.querySelector('.fill-color-input')).not.toBeNull();
    expect(picker.querySelector('.stroke-sync-checkbox')).toBeNull();
    expect(picker.textContent).not.toContain('분류 설정이 결정');
  });

  it('단계구분도: 면 색상이 사라지고 동기화 체크박스가 나온다', () => {
    const id = layerManager.addLayer({
      name: '단계구분도',
      type: 'choropleth',
      geometryType: 'Polygon',
      features: [square(10)],
      color: '#3388ff'
    });
    const picker = openPicker(id);

    expect(picker.querySelector('.fill-color-input')).toBeNull();
    expect(picker.textContent).toContain('분류 설정이 결정');
    expect(picker.querySelector('.stroke-sync-checkbox')).not.toBeNull();
  });

  it('카토그램(type이 vector여도) 분류 레이어로 인식한다', () => {
    const id = addPolygonLayer('카토그램');
    const info = layerManager.getLayer(id);
    info._cartogramConfig = { attribute: 'pop', colors: ['#fff', '#000'], breaks: [0, 1, 2] };

    const picker = openPicker(id);

    expect(picker.querySelector('.fill-color-input')).toBeNull();
    expect(picker.querySelector('.stroke-sync-checkbox')).not.toBeNull();
  });

  it('동기화 기본은 체크됨이고 선 색상이 비활성이다', () => {
    const id = layerManager.addLayer({
      name: '단계구분도', type: 'choropleth', geometryType: 'Polygon',
      features: [square(10)], color: '#3388ff'
    });
    const picker = openPicker(id);

    expect(picker.querySelector('.stroke-sync-checkbox').checked).toBe(true);
    expect(picker.querySelector('.stroke-color-section').style.pointerEvents).toBe('none');
  });

  it('동기화가 꺼져 있으면 체크 해제 + 선 색상 활성', () => {
    const id = layerManager.addLayer({
      name: '단계구분도', type: 'choropleth', geometryType: 'Polygon',
      features: [square(10)], color: '#3388ff'
    });
    layerManager.getLayer(id).strokeSyncToFill = false;

    const picker = openPicker(id);

    expect(picker.querySelector('.stroke-sync-checkbox').checked).toBe(false);
    expect(picker.querySelector('.stroke-color-section').style.pointerEvents).toBe('');
  });

  it('체크박스를 끄면 레이어에 반영되고 선 색상이 열린다', () => {
    const id = layerManager.addLayer({
      name: '단계구분도', type: 'choropleth', geometryType: 'Polygon',
      features: [square(10)], color: '#3388ff'
    });
    const picker = openPicker(id);
    const checkbox = picker.querySelector('.stroke-sync-checkbox');

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(layerManager.getLayer(id).strokeSyncToFill).toBe(false);
    expect(picker.querySelector('.stroke-color-section').style.pointerEvents).toBe('');
  });
});
