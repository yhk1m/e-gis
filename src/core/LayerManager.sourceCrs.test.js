// © 2026 김용현
/**
 * 레이어가 원본 좌표계를 기억하는지 검증.
 *
 * 피처는 3857로 변환돼 저장되므로, 나중에 좌표계를 다시 지정하려면
 * 어디서 왔는지 알아야 한다. 지금은 기록만 한다.
 */
import { describe, it, expect } from 'vitest';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { layerManager } from './LayerManager.js';

function pointFeature() {
  return new Feature({ geometry: new Point([14135000, 4518000]) });
}

describe('레이어의 sourceCrs', () => {
  it('넘긴 원본 좌표계를 기억한다', () => {
    const id = layerManager.addLayer({
      name: '학교',
      features: [pointFeature()],
      sourceCrs: 'EPSG:5186'
    });
    expect(layerManager.getLayer(id).sourceCrs).toBe('EPSG:5186');
    layerManager.removeLayer(id);
  });

  it('안 넘기면 null이다 (그리기 도구로 만든 레이어 등)', () => {
    const id = layerManager.addLayer({ name: '그린 것', features: [pointFeature()] });
    expect(layerManager.getLayer(id).sourceCrs).toBeNull();
    layerManager.removeLayer(id);
  });
});
