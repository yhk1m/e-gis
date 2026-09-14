// © 2026 김용현
// @vitest-environment jsdom
/**
 * setBasemap 의 오버레이 규칙.
 * 라벨이 있는 항목이면 referenceLayer 를 그 라벨 소스로 켜고, 없으면 끈다.
 * 모르는 키는 아무것도 바꾸지 않는다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import TileLayer from 'ol/layer/Tile';
import { MapManager } from './MapManager.js';

let mm;

beforeEach(() => {
  // init() 없이 레이어만 꽂는다 — setBasemap 은 지도 객체를 쓰지 않는다
  mm = new MapManager();
  mm.baseLayer = new TileLayer();
  mm.referenceLayer = new TileLayer({ visible: false });
  mm.currentBasemap = 'OSM';
});

describe('MapManager.setBasemap', () => {
  it('라벨 없는 항목: 베이스 소스만 바뀌고 라벨 레이어는 꺼진다', () => {
    mm.setBasemap('OPENTOPO');
    expect(mm.getBasemap()).toBe('OPENTOPO');
    expect(mm.baseLayer.getVisible()).toBe(true);
    expect(mm.baseLayer.getSource().getUrls()[0]).toContain('opentopomap.org');
    expect(mm.referenceLayer.getVisible()).toBe(false);
  });

  it('라벨 있는 항목: 라벨 레이어에 라벨 소스가 들어가고 켜진다', () => {
    mm.setBasemap('SATELLITE_LABELS');
    expect(mm.referenceLayer.getVisible()).toBe(true);
    expect(mm.referenceLayer.getSource().getUrls()[0]).toContain('voyager_only_labels');
    expect(mm.baseLayer.getSource().getUrls()[0]).toContain('World_Imagery');
  });

  it('라벨 있는 항목에서 없는 항목으로 돌아오면 라벨 레이어가 꺼진다', () => {
    mm.setBasemap('SATELLITE_LABELS');
    mm.setBasemap('ESRI_DARK');
    expect(mm.referenceLayer.getVisible()).toBe(false);
  });

  it('NONE: 베이스가 숨고 라벨도 꺼진다', () => {
    mm.setBasemap('SATELLITE_LABELS');
    mm.setBasemap('NONE');
    expect(mm.baseLayer.getVisible()).toBe(false);
    expect(mm.referenceLayer.getVisible()).toBe(false);
    expect(mm.getBasemap()).toBe('NONE');
  });

  it('모르는 키는 무시된다', () => {
    mm.setBasemap('OPENTOPO');
    mm.setBasemap('NOPE');
    expect(mm.getBasemap()).toBe('OPENTOPO');
  });
});
