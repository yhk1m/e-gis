// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { listDemLayers, pickDemLayers, FLAT, ALL } from './terrainSource.js';

/** layerManager.layers 대역 */
function layerMap(entries) {
  return new Map(entries);
}

const demA = { name: '가평 DEM', demData: { id: 'A' }, olLayer: { getVisible: () => true } };
const demB = { name: '과천 DEM', demData: { id: 'B' }, olLayer: { getVisible: () => false } };
const vector = { name: '시군구', olLayer: { getVisible: () => true } };

describe('listDemLayers', () => {
  it('DEM 레이어만 골라 이름과 함께 준다', () => {
    expect(listDemLayers(layerMap([['a', demA], ['v', vector], ['b', demB]])))
      .toEqual([{ id: 'a', name: '가평 DEM' }, { id: 'b', name: '과천 DEM' }]);
  });

  it('꺼 둔 DEM도 목록에 넣는다 — 고도 원본은 가시성과 무관하다', () => {
    expect(listDemLayers(layerMap([['b', demB]]))).toEqual([{ id: 'b', name: '과천 DEM' }]);
  });

  it('DEM이 없으면 빈 목록이다', () => {
    expect(listDemLayers(layerMap([['v', vector]]))).toEqual([]);
  });
});

describe('pickDemLayers', () => {
  it('기본은 전체 — 위에 있는 것이 앞에 온다', () => {
    expect(pickDemLayers(layerMap([['a', demA], ['b', demB]])))
      .toEqual([{ id: 'b', demData: { id: 'B' } }, { id: 'a', demData: { id: 'A' } }]);
  });

  it('꺼 둔 DEM도 고도 원본으로 쓴다', () => {
    expect(pickDemLayers(layerMap([['b', demB]])))
      .toEqual([{ id: 'b', demData: { id: 'B' } }]);
  });

  it('하나를 고르면 그것만 쓴다', () => {
    expect(pickDemLayers(layerMap([['a', demA], ['b', demB]]), 'a'))
      .toEqual([{ id: 'a', demData: { id: 'A' } }]);
  });

  it('평면을 고르면 빈 배열이다', () => {
    expect(pickDemLayers(layerMap([['a', demA]]), FLAT)).toEqual([]);
  });

  it('ALL을 명시해도 전체다', () => {
    expect(pickDemLayers(layerMap([['a', demA]]), ALL))
      .toEqual([{ id: 'a', demData: { id: 'A' } }]);
  });

  it('고른 레이어가 사라졌으면 전체로 돌아간다', () => {
    expect(pickDemLayers(layerMap([['a', demA]]), '없는id'))
      .toEqual([{ id: 'a', demData: { id: 'A' } }]);
  });

  it('DEM이 하나도 없으면 빈 배열이다', () => {
    expect(pickDemLayers(layerMap([['v', vector]]))).toEqual([]);
  });
});
