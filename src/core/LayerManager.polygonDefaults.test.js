// © 2026 김용현
// @vitest-environment jsdom
/**
 * 새 폴리곤 레이어의 기본 스타일 규약.
 *
 * 면은 불투명(100%)이고, 색은 스타일 편집 팔레트 순서대로 하나씩 배정된다.
 * 첫 레이어는 흰색이므로 테두리가 없으면 지도에서 사라진다 — 선 색은 면 색을 보고 정한다.
 * (검은 면 위 검은 선도 안 보이므로 그때만 흰 선)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import { layerManager } from './LayerManager.js';

const square = () => new Feature({
  geometry: new Polygon([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]])
});
const dot = () => new Feature({ geometry: new Point([0, 0]) });

/** 자동 색상만으로 폴리곤 레이어를 만든다 (color를 넘기지 않는 게 핵심) */
function addPolygon(name = '폴리곤') {
  return layerManager.getLayer(layerManager.addLayer({ name, features: [square()] }));
}

describe('새 폴리곤 레이어 기본 스타일', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('첫 폴리곤은 흰 면 + 검은 선이고 면 불투명도가 100%다', () => {
    const info = addPolygon();

    expect(info.fillColor).toBe('#ffffff');
    expect(info.strokeColor).toBe('#000000');
    expect(info.fillOpacity).toBe(1);
  });

  it('실제로 그려지는 면 색도 불투명하다 (초기 스타일·갱신 스타일 모두)', () => {
    const info = addPolygon();

    expect(info.olLayer.getStyle().getFill().getColor()).toBe('rgba(255, 255, 255, 1)');

    layerManager.updateLayerStyle(info.id);
    expect(info.olLayer.getStyle().getFill().getColor()).toBe('rgba(255, 255, 255, 1)');
    expect(info.olLayer.getStyle().getStroke().getColor()).toBe('rgba(0, 0, 0, 1)');
  });

  it('두 번째부터는 팔레트 색을 순서대로 받는다', () => {
    expect(addPolygon('1').fillColor).toBe('#ffffff'); // 흰색
    expect(addPolygon('2').fillColor).toBe('#808080'); // 회색
    expect(addPolygon('3').fillColor).toBe('#000000'); // 검은색
    expect(addPolygon('4').fillColor).toBe('#e53935'); // 빨강
  });

  it('면이 검은색일 때만 선이 흰색이 된다', () => {
    addPolygon('1');
    addPolygon('2');
    const black = addPolygon('3');

    expect(black.fillColor).toBe('#000000');
    expect(black.strokeColor).toBe('#ffffff');
  });

  it('포인트·선 레이어는 기존 자동 색상을 그대로 쓴다 (흰 점은 안 보인다)', () => {
    const pointInfo = layerManager.getLayer(
      layerManager.addLayer({ name: '점', features: [dot()] })
    );

    expect(pointInfo.color).toBe('#3b82f6');
  });

  it('색을 직접 지정하면 자동 배정을 건너뛴다', () => {
    const info = layerManager.getLayer(
      layerManager.addLayer({ name: '지정색', features: [square()], color: '#123456' })
    );

    expect(info.fillColor).toBe('#123456');
    expect(info.strokeColor).toBe('#000000');
  });

  it('레이어를 모두 지우면 다음 폴리곤은 다시 흰색부터 시작한다', () => {
    addPolygon('1');
    addPolygon('2');
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));

    expect(addPolygon('새로').fillColor).toBe('#ffffff');
  });
});

/**
 * 기본 스타일은 createStyle이 처음 그리는 모습과 같아야 한다.
 *
 * 두 갈래가 어긋나 있으면 스타일 편집기를 한 번 건드리는 순간(updateLayerStyle)
 * 레이어가 눈에 띄게 달라진다. 점은 흰 테두리가 색으로 바뀌고 반투명해졌고,
 * 선은 굵기가 3에서 2로 얇아졌다. 레이어 목록의 스와치도 어느 쪽에 맞춰야 할지
 * 정할 수 없었다.
 */
describe('기본 스타일이 처음 그리는 모습과 같다', () => {
  beforeEach(() => {
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  });

  it('점: 테두리는 흰색, 면은 불투명', () => {
    const info = layerManager.getLayer(layerManager.addLayer({ name: '점', features: [dot()] }));
    expect(info.geometryType).toBe('Point');
    expect(info.strokeColor).toBe('#ffffff');
    expect(info.fillOpacity).toBe(1.0);
    expect(info.strokeWidth).toBe(2);
  });

  it('선: 색은 레이어 색, 굵기는 3', () => {
    const line = new Feature({ geometry: new LineString([[0, 0], [100, 100]]) });
    const info = layerManager.getLayer(layerManager.addLayer({ name: '선', features: [line] }));
    expect(info.geometryType).toBe('LineString');
    expect(info.strokeColor).toBe(info.color);
    expect(info.strokeWidth).toBe(3);
  });

  it('면: 테두리는 면 색에 맞춘 색, 굵기는 2 (예전과 같다)', () => {
    const info = layerManager.getLayer(layerManager.addLayer({ name: '면', features: [square()] }));
    expect(info.fillOpacity).toBe(1.0);
    expect(info.strokeWidth).toBe(2);
    expect(info.strokeColor).toBe('#000000');
  });
});
