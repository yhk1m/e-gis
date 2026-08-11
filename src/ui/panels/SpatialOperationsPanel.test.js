// © 2026 김용현
// @vitest-environment jsdom
/**
 * 공간 연산 패널의 옵션 배선 검증.
 * 연산 유형에 맞는 옵션만 보이고, 선택값이 도구 옵션으로 정확히 넘어가야 한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import { layerManager } from '../../core/LayerManager.js';
import { spatialOperationsPanel } from './SpatialOperationsPanel.js';

function box(x1, y1, x2, y2) {
  return new Feature({
    geometry: new Polygon([[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]])
  });
}

/** 연산 유형을 바꾸고 패널을 갱신한다 */
function selectOperation(value) {
  const select = document.getElementById('spatial-ops-operation');
  select.value = value;
  select.dispatchEvent(new window.Event('change'));
}

const isVisible = id => document.getElementById(id).style.display !== 'none';

beforeEach(() => {
  layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));
  layerManager.addLayer({ name: '구역', features: [box(0, 0, 100, 100)] });
  layerManager.addLayer({ name: '하천', features: [box(50, 50, 150, 150)] });
  spatialOperationsPanel.show();
});

afterEach(() => spatialOperationsPanel.close());

describe('연산별 옵션 표시', () => {
  it('교차는 결과 형태만 보여준다', () => {
    selectOperation('intersect');
    expect(isVisible('spatial-ops-mode-group')).toBe(true);
    expect(isVisible('spatial-ops-union-group')).toBe(false);
  });

  it('합집합은 병합 체크박스만 보여준다', () => {
    selectOperation('union');
    expect(isVisible('spatial-ops-mode-group')).toBe(false);
    expect(isVisible('spatial-ops-union-group')).toBe(true);
  });

  it('차집합은 "제외" 표현으로 바뀐다', () => {
    selectOperation('difference');
    expect(isVisible('spatial-ops-mode-group')).toBe(true);
    expect(document.getElementById('mode-keep-label').textContent).toContain('제외');
  });

  it('교차는 "유지" 표현으로 돌아온다', () => {
    selectOperation('difference');
    selectOperation('clip');
    expect(document.getElementById('mode-keep-label').textContent).toContain('유지');
  });
});

describe('readOptions', () => {
  it('기본값은 자르기', () => {
    selectOperation('intersect');
    expect(spatialOperationsPanel.readOptions('intersect')).toEqual({ keepFeatures: false });
  });

  it('피처 유지를 고르면 keepFeatures가 켜진다', () => {
    selectOperation('intersect');
    document.querySelector('input[name="spatial-ops-mode"][value="keep"]').checked = true;
    expect(spatialOperationsPanel.readOptions('intersect')).toEqual({ keepFeatures: true });
  });

  it('합집합 기본값은 병합', () => {
    selectOperation('union');
    expect(spatialOperationsPanel.readOptions('union')).toEqual({ dissolve: true });
  });

  it('병합 체크를 풀면 피처 유지 모드가 된다', () => {
    selectOperation('union');
    document.getElementById('spatial-ops-dissolve').checked = false;
    expect(spatialOperationsPanel.readOptions('union')).toEqual({ dissolve: false });
  });
});
