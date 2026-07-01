// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { parseEgisDoc } from './egisParse.js';

const SAMPLE = {
  version: '1.0',
  name: '부산 인구',
  view: { center: [129.0, 35.1], zoom: 8.5 },
  displayCRS: 'EPSG:3857',
  layers: [
    {
      id: 'L_a', name: '인구', type: 'vector', geometryType: 'Polygon',
      visible: true, color: '#ef4444', opacity: 1,
      features: { type: 'FeatureCollection', features: [] },
    },
  ],
};

describe('parseEgisDoc', () => {
  it('유효한 .egis를 정규화한다', () => {
    const doc = parseEgisDoc(SAMPLE);
    expect(doc.name).toBe('부산 인구');
    expect(doc.view.center).toEqual([129.0, 35.1]); // EPSG:4326 경위도 그대로
    expect(doc.view.zoom).toBe(8.5);
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0].id).toBe('L_a');
    expect(doc.layers[0].type).toBe('vector');
  });

  it('version이 없으면 에러', () => {
    expect(() => parseEgisDoc({ name: 'x' })).toThrow(/version/);
  });

  it('객체가 아니면 에러', () => {
    expect(() => parseEgisDoc(null)).toThrow();
  });

  it('view가 없으면 한국 중심 기본값(4326)', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [] });
    expect(doc.view.center).toEqual([127.5, 36.5]);
    expect(doc.view.zoom).toBe(7);
  });

  it('레이어 id/visible 누락 시 채운다', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'vector' }] });
    expect(doc.layers[0].id).toBe('L_0');
    expect(doc.layers[0].visible).toBe(true);
    expect(doc.layers[0].color).toBe('#3b82f6');
  });

  it('알 수 없는 type은 vector로 정규화', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'weird' }] });
    expect(doc.layers[0].type).toBe('vector');
  });

  it('opacity 0은 0으로 보존된다', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'vector', opacity: 0 }] });
    expect(doc.layers[0].opacity).toBe(0);
  });

  it('visible: false는 false로 보존된다', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'vector', visible: false }] });
    expect(doc.layers[0].visible).toBe(false);
  });

  it('view.zoom 0은 0으로 보존된다', () => {
    const doc = parseEgisDoc({ version: '1.0', view: { center: [0, 0], zoom: 0 }, layers: [] });
    expect(doc.view.zoom).toBe(0);
  });

  it('반환된 center는 입력 배열과 다른 참조(복사본)다', () => {
    const raw = { version: '1.0', view: { center: [1, 2], zoom: 5 }, layers: [] };
    const doc = parseEgisDoc(raw);
    expect(doc.view.center).toEqual([1, 2]);
    expect(doc.view.center).not.toBe(raw.view.center);
  });
});
