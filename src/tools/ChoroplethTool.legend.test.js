// @vitest-environment jsdom
// © 2026 김용현
/**
 * 범례 색 칸과 구간 채움 편집 API.
 * - 색 칸마다 data-class 가 붙고, 칸을 누르면 onLegendColorClick 훅이 (layerId, classIndex, anchor) 를 받는다.
 *   훅이 없으면(실험 꺼짐) 아무 일도 없다.
 * - setClassFill / setClassColor / setAllFills 는 설정을 바꾸고 스타일·범례를 다시 그린다.
 * - 전부 단색이 되면 fills 키를 지운다(저장본이 불필요하게 커지지 않게).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../core/LayerManager.js';
import { choroplethTool, swatchStyle } from './ChoroplethTool.js';
import { eventBus, Events } from '../utils/EventBus.js';

HTMLCanvasElement.prototype.getContext = () => null;

function square(pop) {
  return new Feature({ geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]), pop });
}

function makeChoropleth() {
  const id = layerManager.addLayer({ name: '단계구분도', type: 'choropleth', features: [square(10), square(90)], color: '#3388ff' });
  const info = layerManager.getLayer(id);
  info._choroplethConfig = {
    attribute: 'pop', breaks: [0, 50, 100], colors: ['#ffffcc', '#800026'], tool: choroplethTool,
    title: '제목', unit: '', format: 'comma', rounding: 0
  };
  info.fillOpacity = 0.7;
  choroplethTool.createLegend(id, '단계구분도', 'pop', info._choroplethConfig.breaks, info._choroplethConfig.colors);
  return { id, info, legend: document.getElementById(`choropleth-legend-${id}`) };
}

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach((l) => layerManager.removeLayer(l.id));
  document.body.innerHTML = '<div id="map"></div>';
  choroplethTool.onLegendColorClick = null;
});

describe('범례 색 칸', () => {
  it('칸마다 data-class 가 붙고 배경은 구간 색', () => {
    const { legend } = makeChoropleth();
    const swatches = legend.querySelectorAll('.choropleth-legend-color');
    expect(swatches).toHaveLength(2);
    expect(swatches[0].dataset.class).toBe('0');
    expect(swatches[1].dataset.class).toBe('1');
    // jsdom(cssstyle) 은 hex 를 rgb() 로 바꾼다 — 어느 쪽이든 통과
    expect(swatches[1].style.background).toMatch(/#800026|rgb\(128, 0, 38\)/);
  });

  it('칸을 누르면 훅이 불리고, 훅이 없으면 조용하다', () => {
    const { id, legend } = makeChoropleth();
    const sw = legend.querySelectorAll('.choropleth-legend-color')[1];
    expect(() => sw.click()).not.toThrow();
    const hook = vi.fn();
    choroplethTool.onLegendColorClick = hook;
    sw.click();
    expect(hook).toHaveBeenCalledWith({ layerId: id, classIndex: 1, anchor: sw });
  });

  it('범례 항목을 다시 그려도 클릭이 살아 있다(위임)', () => {
    const { id, legend } = makeChoropleth();
    const hook = vi.fn();
    choroplethTool.onLegendColorClick = hook;
    choroplethTool.refreshLegendItems(id);
    legend.querySelectorAll('.choropleth-legend-color')[0].click();
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ classIndex: 0 }));
  });
});

describe('swatchStyle — 범례 칸 스타일은 지도의 채움 배경을 따른다', () => {
  const tile = 'data:image/png;base64,AAAA';

  it('단색·채움 없음은 구간 색', () => {
    expect(swatchStyle(null, '#800026', null)).toBe('background:#800026');
    expect(swatchStyle({ kind: 'solid' }, '#800026', tile)).toBe('background:#800026');
  });

  it('배경이 구간 색인 패턴은 구간 색 위에 타일', () => {
    expect(swatchStyle({ kind: 'dots', background: 'class' }, '#800026', tile))
      .toBe(`background-color:#800026;background-image:url(${tile})`);
  });

  it('배경 없음 패턴은 타일만 — 지도처럼 밑이 비친다', () => {
    expect(swatchStyle({ kind: 'hatch', background: 'none' }, '#800026', tile))
      .toBe(`background-color:transparent;background-image:url(${tile})`);
  });

  it('배경 없음 패턴인데 타일이 없으면 투명(지도 fallback 과 같다), 그 밖의 채움은 구간 색', () => {
    expect(swatchStyle({ kind: 'hatch', background: 'none' }, '#800026', null)).toBe('background:transparent');
    expect(swatchStyle({ kind: 'texture', name: 'paper' }, '#800026', null)).toBe('background:#800026');
    expect(swatchStyle({ kind: 'image', dataUrl: 'data:image/png;base64,AAAA' }, '#800026', null)).toBe('background:#800026');
  });

  it('renderLegendItems 는 배경 없음 패턴 칸에 구간 색을 깔지 않는다', () => {
    const { id, info, legend } = makeChoropleth();
    info._choroplethConfig.fills = [{ kind: 'solid' }, { kind: 'hatch', background: 'none' }];
    choroplethTool.refreshLegendItems(id);
    const sw = legend.querySelectorAll('.choropleth-legend-color');
    expect(sw[0].style.backgroundColor).toMatch(/#ffffcc|rgb\(255, 255, 204\)/);
    expect(sw[1].style.backgroundColor).toBe('transparent');
  });
});

describe('편집 API', () => {
  it('setClassFill 은 fills 를 만들고 스타일 변경 이벤트를 낸다', () => {
    const { id, info } = makeChoropleth();
    const changed = vi.fn();
    eventBus.on(Events.LAYER_STYLE_CHANGED, changed);
    expect(choroplethTool.setClassFill(id, 1, { kind: 'hatch', spacing: 99 })).toBe(true);
    expect(info._choroplethConfig.fills).toEqual([{ kind: 'solid' }, expect.objectContaining({ kind: 'hatch', spacing: 24 })]);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ layerId: id }));
    eventBus.off(Events.LAYER_STYLE_CHANGED, changed);
  });

  it('전부 단색으로 돌아가면 fills 키를 지운다', () => {
    const { id, info } = makeChoropleth();
    choroplethTool.setClassFill(id, 0, { kind: 'dots' });
    choroplethTool.setClassFill(id, 0, { kind: 'solid' });
    expect('fills' in info._choroplethConfig).toBe(false);
  });

  it('구간 밖 인덱스·없는 레이어는 false', () => {
    const { id } = makeChoropleth();
    expect(choroplethTool.setClassFill(id, 2, { kind: 'dots' })).toBe(false);
    expect(choroplethTool.setClassFill('nope', 0, { kind: 'dots' })).toBe(false);
  });

  it('setClassColor 는 colors 를 새 배열로 바꾸고 범례 칸 색도 바뀐다', () => {
    const { id, info, legend } = makeChoropleth();
    const before = info._choroplethConfig.colors;
    expect(choroplethTool.setClassColor(id, 0, '#123456')).toBe(true);
    expect(info._choroplethConfig.colors).not.toBe(before);
    expect(info._choroplethConfig.colors[0]).toBe('#123456');
    expect(legend.querySelectorAll('.choropleth-legend-color')[0].style.background).toMatch(/#123456|rgb\(18, 52, 86\)/);
    expect(choroplethTool.setClassColor(id, 0, 'red')).toBe(false);
  });

  it('setAllFills 는 목록을 정규화해 걸고 null 이면 지운다', () => {
    const { id, info } = makeChoropleth();
    expect(choroplethTool.setAllFills(id, [{ kind: 'hatch' }, { kind: 'cross', width: 100 }])).toBe(true);
    expect(info._choroplethConfig.fills[1].width).toBe(6);
    expect(choroplethTool.setAllFills(id, null)).toBe(true);
    expect('fills' in info._choroplethConfig).toBe(false);
  });
});
