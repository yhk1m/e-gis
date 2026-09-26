// @vitest-environment jsdom
// © 2026 김용현
/**
 * 시계열 설정 창: 폴리곤 + 숫자 필드 2개 이상인 레이어만, 필드 체크 목록은 속성 순서,
 * 「연도 자동 선택」은 19xx/20xx 로 시작하는 필드만 켠다, 적용은 timeSeriesTool.apply 에
 * 체크 순서대로 넘긴다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import { layerManager } from '../../core/LayerManager.js';
import { timeSeriesTool } from '../../tools/TimeSeriesTool.js';
import { timeSeriesPanel } from './TimeSeriesPanel.js';

function cell(props) {
  return new Feature({ geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]), ...props });
}

function polygonLayer() {
  return layerManager.addLayer({
    name: '구',
    type: 'vector',
    features: [cell({ name: 'a', '2015': 1, '2020': 2, area: 3, '2025': 4 }), cell({ name: 'b', '2015': 5, '2020': 6, area: 7, '2025': 8 })]
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  timeSeriesPanel.close();
  timeSeriesPanel.configure({ onMessage: null });
  timeSeriesTool.detach();
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
  vi.restoreAllMocks();
});

describe('TimeSeriesPanel.compatibleLayers', () => {
  it('폴리곤이고 숫자 필드가 2개 이상인 레이어만', () => {
    const poly = polygonLayer();
    layerManager.addLayer({ name: '점', type: 'vector', features: [new Feature({ geometry: new Point([0, 0]), '2015': 1, '2020': 2 })] });
    layerManager.addLayer({ name: '한 필드', type: 'vector', features: [cell({ '2015': 1 })] });
    expect(timeSeriesPanel.compatibleLayers().map((l) => l.id)).toEqual([poly]);
  });
});

describe('TimeSeriesPanel UI', () => {
  it('없으면 alert 만, 있으면 창과 필드 체크 목록(속성 순서)', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    timeSeriesPanel.show();
    expect(alertSpy).toHaveBeenCalled();
    expect(document.querySelector('.time-series-modal')).toBeNull();

    polygonLayer();
    timeSeriesPanel.show();
    const boxes = Array.from(document.querySelectorAll('.ts-field-check'));
    // JS 객체는 정수 모양 키('2015')를 문자 키보다 앞에, 오름차순으로 둔다 — OL Feature 도 그렇다.
    // 연도 열은 자연히 시간순이 되므로 그대로 둔다.
    expect(boxes.map((b) => b.value)).toEqual(['2015', '2020', '2025', 'area']);
    expect(boxes.every((b) => !b.checked)).toBe(true);
  });

  it('연도 자동 선택은 연도 필드만 켠다', () => {
    polygonLayer();
    timeSeriesPanel.show();
    document.getElementById('ts-auto-years').click();
    const checked = Array.from(document.querySelectorAll('.ts-field-check:checked')).map((b) => b.value);
    expect(checked).toEqual(['2015', '2020', '2025']);
  });

  it('적용은 체크한 필드를 속성 순서로 넘기고 창을 닫는다', () => {
    const id = polygonLayer();
    timeSeriesPanel.show();
    const applySpy = vi.spyOn(timeSeriesTool, 'apply').mockReturnValue('derived');
    document.getElementById('ts-auto-years').click();
    document.getElementById('ts-classes').value = '4';
    document.getElementById('ts-classes').dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('ts-method').value = 'quantile';
    document.getElementById('ts-apply').click();
    expect(applySpy).toHaveBeenCalledWith({
      layerId: id, fields: ['2015', '2020', '2025'], method: 'quantile', numClasses: 4,
      colorRamp: 'blues', reverse: false, customColors: null
    });
    expect(document.querySelector('.time-series-modal')).toBeNull();
  });

  it('필드가 2개 미만이면 alert 하고 적용하지 않는다', () => {
    polygonLayer();
    timeSeriesPanel.show();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const applySpy = vi.spyOn(timeSeriesTool, 'apply');
    document.querySelector('.ts-field-check[value="2015"]').click();
    document.getElementById('ts-apply').click();
    expect(alertSpy).toHaveBeenCalled();
    expect(applySpy).not.toHaveBeenCalled();
  });

  it('커스텀 팔레트를 고르면 색 입력이 넘어간다', () => {
    const id = polygonLayer();
    timeSeriesPanel.show();
    const applySpy = vi.spyOn(timeSeriesTool, 'apply').mockReturnValue('derived');
    document.getElementById('ts-auto-years').click();
    const ramp = document.getElementById('ts-ramp');
    ramp.value = 'custom';
    ramp.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('ts-custom-colors').style.display).toBe('block');
    document.getElementById('ts-apply').click();
    const call = applySpy.mock.calls[0][0];
    expect(call.colorRamp).toBe('custom');
    expect(call.customColors).toEqual(['#ffffcc', '#fd8d3c', '#800026']);
    expect(id).toBe(call.layerId);
  });

  it('필드가 30개를 넘으면 안내하고 적용하지 않는다', () => {
    const props = {};
    for (let y = 1990; y <= 2020; y++) props[String(y)] = y;
    layerManager.addLayer({ name: '긴 시계열', type: 'vector', features: [cell(props)] });
    timeSeriesPanel.show();
    const onMessage = vi.fn();
    timeSeriesPanel.configure({ onMessage });
    const applySpy = vi.spyOn(timeSeriesTool, 'apply');
    document.getElementById('ts-auto-years').click();
    expect(document.querySelectorAll('.ts-field-check:checked').length).toBe(31);
    document.getElementById('ts-apply').click();
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('30'));
    expect(applySpy).not.toHaveBeenCalled();
    expect(document.querySelector('.time-series-modal')).not.toBeNull();
  });

  it('적용이 실패(null)하면 안내하고 창을 남긴다', () => {
    polygonLayer();
    timeSeriesPanel.show();
    const onMessage = vi.fn();
    timeSeriesPanel.configure({ onMessage });
    vi.spyOn(timeSeriesTool, 'apply').mockReturnValue(null);
    document.getElementById('ts-auto-years').click();
    document.getElementById('ts-apply').click();
    expect(onMessage).toHaveBeenCalled();
    expect(document.querySelector('.time-series-modal')).not.toBeNull();
  });

  it('레이어·필드 이름은 이스케이프해서 넣는다', () => {
    layerManager.addLayer({
      name: '<img src=x onerror=alert(1)>',
      type: 'vector',
      features: [cell({ '<b>2015</b>': 1, '2020': 2 })]
    });
    timeSeriesPanel.show();
    const modal = document.querySelector('.time-series-modal');
    expect(modal.querySelector('img')).toBeNull();
    expect(modal.querySelector('#ts-fields b')).toBeNull();
    const values = Array.from(document.querySelectorAll('.ts-field-check')).map((b) => b.value);
    expect(values).toContain('<b>2015</b>');
  });

  it('Esc·바깥 클릭·닫기 버튼으로 닫힌다', () => {
    polygonLayer();
    timeSeriesPanel.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.time-series-modal')).toBeNull();

    timeSeriesPanel.show();
    const overlay = document.querySelector('.time-series-modal');
    overlay.querySelector('.time-series-content').click();
    expect(document.querySelector('.time-series-modal')).not.toBeNull();
    overlay.click();
    expect(document.querySelector('.time-series-modal')).toBeNull();

    timeSeriesPanel.show();
    document.getElementById('ts-close-panel').click();
    expect(document.querySelector('.time-series-modal')).toBeNull();
  });
});
