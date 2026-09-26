// © 2026 김용현
// @vitest-environment jsdom
/**
 * 시계열 도구: 구간은 모든 필드를 합쳐 한 번만 계산해 고정하고, 연도 이동은
 * cfg.attribute 만 바꾼다. 컨트롤은 #map 안에 하나만 산다.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { timeSeriesTool, BASE_INTERVAL_MS } from './TimeSeriesTool.js';

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
    features: [
      cell({ name: 'a', '2015': 10, '2020': 40, '2025': 70 }),
      cell({ name: 'b', '2015': 20, '2020': 50, '2025': 80 }),
      cell({ name: 'c', '2015': 30, '2020': 60, '2025': 90 })
    ]
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  timeSeriesTool.detach();
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('apply', () => {
  it('모든 필드의 값을 합쳐 구간을 한 번 계산하고 timeSeries 를 심는다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'], method: 'equalInterval', numClasses: 4, colorRamp: 'blues' });
    const info = layerManager.getLayer(derivedId);
    expect(info.name).toBe('구_시계열_2015~2025');
    expect(info._choroplethConfig.breaks).toEqual([10, 30, 50, 70, 90]);   // 10~90 을 4등분
    expect(info._choroplethConfig.timeSeries).toEqual({ fields: ['2015', '2020', '2025'], index: 0 });
    expect(info._choroplethConfig.attribute).toBe('2015');
    expect(info._choroplethConfig.title).toBe('구 (2015~2025)');
  });

  it('필드가 2개 미만이면 null', () => {
    const id = sourceLayer();
    expect(timeSeriesTool.apply({ layerId: id, fields: ['2015'] })).toBeNull();
  });

  it('컨트롤을 #map 에 만들고 range 의 max 는 필드 수 - 1', () => {
    const id = sourceLayer();
    timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    const box = document.getElementById('time-series-controls');
    expect(box).toBeTruthy();
    expect(box.querySelector('#ts-range').max).toBe('2');
    expect(box.querySelector('#ts-field').textContent).toBe('2015');
  });
});

describe('setIndex / step', () => {
  it('attribute 와 범례 부제·슬라이더를 바꾸고 LAYER_STYLE_CHANGED 를 낸다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    const cb = vi.fn();
    eventBus.on(Events.LAYER_STYLE_CHANGED, cb);
    timeSeriesTool.setIndex(2);
    const cfg = layerManager.getLayer(derivedId)._choroplethConfig;
    expect(cfg.attribute).toBe('2025');
    expect(cfg.timeSeries.index).toBe(2);
    expect(cb).toHaveBeenCalledWith({ layerId: derivedId });
    expect(document.querySelector('#choropleth-legend-' + derivedId + ' .choropleth-legend-subtitle').textContent).toBe('2025 (3/3)');
    expect(document.getElementById('ts-range').value).toBe('2');
    eventBus.off(Events.LAYER_STYLE_CHANGED, cb);
  });

  it('범위를 벗어난 인덱스는 잘린다, step 은 끝에서 처음으로', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    timeSeriesTool.setIndex(9);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
    timeSeriesTool.step();
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2015');
  });

  it('range 입력이 setIndex 로 이어진다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    const range = document.getElementById('ts-range');
    range.value = '1';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
  });
});

describe('play / pause / speed', () => {
  it('BASE_INTERVAL_MS / speed 마다 한 칸 간다', () => {
    vi.useFakeTimers();
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    timeSeriesTool.setSpeed(2);
    timeSeriesTool.play();
    expect(timeSeriesTool.isPlaying()).toBe(true);
    expect(document.getElementById('ts-play').getAttribute('aria-pressed')).toBe('true');
    vi.advanceTimersByTime(BASE_INTERVAL_MS / 2);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
    vi.advanceTimersByTime(BASE_INTERVAL_MS / 2);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2025');
    timeSeriesTool.pause();
    vi.advanceTimersByTime(BASE_INTERVAL_MS * 3);
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2025');
    expect(timeSeriesTool.isPlaying()).toBe(false);
  });
});

describe('detach / 레이어 삭제 / 복원', () => {
  it('detach 는 컨트롤을 없애고 재생을 멈춘다', () => {
    vi.useFakeTimers();
    const id = sourceLayer();
    timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    timeSeriesTool.play();
    timeSeriesTool.detach();
    expect(document.getElementById('time-series-controls')).toBeNull();
    expect(timeSeriesTool.isPlaying()).toBe(false);
    expect(timeSeriesTool.layerId).toBeNull();
  });

  it('대상 레이어가 삭제되면 조용히 끝난다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    layerManager.removeLayer(derivedId);
    expect(document.getElementById('time-series-controls')).toBeNull();
    expect(timeSeriesTool.layerId).toBeNull();
  });

  it('restoreControls 는 timeSeries 가 있는 레이어를 찾아 컨트롤을 되살린다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020', '2025'] });
    timeSeriesTool.setIndex(1);
    timeSeriesTool.detach();
    expect(timeSeriesTool.restoreControls()).toBe(derivedId);
    expect(document.getElementById('ts-field').textContent).toBe('2020');
    expect(layerManager.getLayer(derivedId)._choroplethConfig.attribute).toBe('2020');
  });

  it('restoreControls 는 대상이 없으면 null', () => {
    sourceLayer();
    expect(timeSeriesTool.restoreControls()).toBeNull();
  });

  it('저장 버튼은 onSave 훅을 부른다', () => {
    const id = sourceLayer();
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    const onSave = vi.fn();
    timeSeriesTool.onSave = onSave;
    document.getElementById('ts-save').click();
    expect(onSave).toHaveBeenCalledWith(derivedId);
    timeSeriesTool.onSave = null;
  });
});

describe('구간 수 보정', () => {
  it('자연 구분점은 값 개수보다 많은 구간을 줄이고, 구간은 여전히 모든 필드에서 계산한다', () => {
    const id = sourceLayer();
    // 3 피처 × 2 필드 = 값 6개 → 8구간 요청은 6구간으로
    const derivedId = timeSeriesTool.apply({ layerId: id, fields: ['2015', '2025'], method: 'naturalBreaks', numClasses: 8 });
    const cfg = layerManager.getLayer(derivedId)._choroplethConfig;
    expect(cfg.breaks).toHaveLength(7);
    expect(cfg.colors).toHaveLength(6);
    expect(cfg.breaks[0]).toBe(10);
    expect(cfg.breaks[cfg.breaks.length - 1]).toBe(90);   // 첫 필드(10~30)만이 아니라 합친 값에서
  });

  it('숫자 값이 없으면 null, 컨트롤도 안 생긴다', () => {
    const id = layerManager.addLayer({
      name: '빈',
      type: 'vector',
      features: [cell({ name: 'a', '2015': 'x', '2020': '' })]
    });
    expect(timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] })).toBeNull();
    expect(document.getElementById('time-series-controls')).toBeNull();
  });

  it('컨트롤 박스는 time-series-controls 클래스를 가진다(내보내기 중 숨김용)', () => {
    const id = sourceLayer();
    timeSeriesTool.apply({ layerId: id, fields: ['2015', '2020'] });
    expect(document.getElementById('time-series-controls').classList.contains('time-series-controls')).toBe(true);
  });
});
