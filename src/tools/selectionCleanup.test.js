// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { pickOrphanFeatures } from './selectionCleanup.js';

// 벡터 레이어 대역 — hasFeature 만 있으면 된다
function layerWith(...features) {
  return { source: { hasFeature: (f) => features.includes(f) } };
}

describe('pickOrphanFeatures', () => {
  it('남아 있는 레이어의 피처는 골라내지 않는다', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    expect(pickOrphanFeatures([a, b], [layerWith(a, b)])).toEqual([]);
  });

  it('지워진 레이어의 피처만 골라낸다', () => {
    const stays = { id: 'stays' };
    const gone = { id: 'gone' };
    // gone 이 있던 레이어는 이미 목록에서 빠진 상태다
    expect(pickOrphanFeatures([stays, gone], [layerWith(stays)])).toEqual([gone]);
  });

  it('레이어가 하나도 안 남으면 전부 골라낸다', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    expect(pickOrphanFeatures([a, b], [])).toEqual([a, b]);
  });

  it('여러 레이어 중 어느 하나에만 있어도 남긴다', () => {
    const a = { id: 'a' };
    expect(pickOrphanFeatures([a], [layerWith(), layerWith(a)])).toEqual([]);
  });

  it('벡터 소스가 없는 레이어(래스터 등)는 건너뛴다', () => {
    const a = { id: 'a' };
    const raster = { source: {} };
    expect(pickOrphanFeatures([a], [raster, layerWith(a)])).toEqual([]);
    expect(pickOrphanFeatures([a], [raster, null, undefined])).toEqual([a]);
  });

  it('빈 입력에도 안전하다', () => {
    expect(pickOrphanFeatures([], [])).toEqual([]);
    expect(pickOrphanFeatures(null, null)).toEqual([]);
  });
});
