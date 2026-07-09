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

  it('view가 없으면 null(저장된 카메라 없음 — 기본 카메라는 MapView 소관)', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [] });
    expect(doc.view).toBeNull();
  });

  it('center가 유한수 2개가 아니면 view는 null', () => {
    const base = { version: '1.0', layers: [] };
    expect(parseEgisDoc({ ...base, view: { center: ['a', 'b'], zoom: 5 } }).view).toBeNull();
    expect(parseEgisDoc({ ...base, view: { center: [127.5], zoom: 5 } }).view).toBeNull();
    expect(parseEgisDoc({ ...base, view: { center: [Infinity, 36.5], zoom: 5 } }).view).toBeNull();
    expect(parseEgisDoc({ ...base, view: { center: 'seoul', zoom: 5 } }).view).toBeNull();
  });

  it('center가 유효하고 zoom이 숫자가 아니면 zoom만 7로 대체', () => {
    const doc = parseEgisDoc({ version: '1.0', view: { center: [127.5, 36.5], zoom: 'abc' }, layers: [] });
    expect(doc.view.center).toEqual([127.5, 36.5]);
    expect(doc.view.zoom).toBe(7);
  });

  it('zoom이 null이어도 7로 대체(Number(null)=0 함정)', () => {
    const doc = parseEgisDoc({ version: '1.0', view: { center: [127.5, 36.5], zoom: null }, layers: [] });
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

  it('세부 스타일 필드(채우기/테두리/파선 등)를 통과시킨다', () => {
    const doc = parseEgisDoc({
      version: '1.0',
      layers: [{
        type: 'vector', color: '#ff0000',
        strokeColor: '#0000ff', fillColor: '#00ff00',
        fillOpacity: 0.5, strokeOpacity: 0.8, strokeWidth: 4,
        strokeDash: 'dashed', pointRadius: 10,
      }],
    });
    const l = doc.layers[0];
    expect(l.strokeColor).toBe('#0000ff');
    expect(l.fillColor).toBe('#00ff00');
    expect(l.fillOpacity).toBe(0.5);
    expect(l.strokeOpacity).toBe(0.8);
    expect(l.strokeWidth).toBe(4);
    expect(l.strokeDash).toBe('dashed');
    expect(l.pointRadius).toBe(10);
  });

  it('세부 스타일 필드가 없으면(구버전 .egis) null', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'vector' }] });
    const l = doc.layers[0];
    expect(l.strokeColor).toBeNull();
    expect(l.fillColor).toBeNull();
    expect(l.fillOpacity).toBeNull();
    expect(l.strokeWidth).toBeNull();
    expect(l.strokeDash).toBeNull();
    expect(l.pointRadius).toBeNull();
  });

  it('fillOpacity 0은 0으로 보존된다(투명 채우기)', () => {
    const doc = parseEgisDoc({ version: '1.0', layers: [{ type: 'vector', fillOpacity: 0 }] });
    expect(doc.layers[0].fillOpacity).toBe(0);
  });

  it('반환된 center는 입력 배열과 다른 참조(복사본)다', () => {
    const raw = { version: '1.0', view: { center: [1, 2], zoom: 5 }, layers: [] };
    const doc = parseEgisDoc(raw);
    expect(doc.view.center).toEqual([1, 2]);
    expect(doc.view.center).not.toBe(raw.view.center);
  });
});
