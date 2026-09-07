// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { sampleElevation, buildTerrainGeometry } from './terrainMesh.js';

/** 2×2 DEM — 왼쪽 위 0m, 오른쪽 위 10m, 왼쪽 아래 20m, 오른쪽 아래 30m */
function tinyDem(overrides = {}) {
  return {
    data: Float32Array.from([0, 10, 20, 30]),
    width: 2,
    height: 2,
    extent: [0, 0, 100, 100],
    minVal: 0,
    maxVal: 30,
    noDataValue: null,
    ...overrides
  };
}

describe('sampleElevation', () => {
  it('행 0이 북쪽이라는 규칙대로 고도를 읽는다', () => {
    const dem = tinyDem();
    expect(sampleElevation(dem, 10, 90)).toBe(0);   // 왼쪽 위
    expect(sampleElevation(dem, 90, 90)).toBe(10);  // 오른쪽 위
    expect(sampleElevation(dem, 10, 10)).toBe(20);  // 왼쪽 아래
    expect(sampleElevation(dem, 90, 10)).toBe(30);  // 오른쪽 아래
  });

  it('DEM 범위 밖은 null을 돌려준다', () => {
    expect(sampleElevation(tinyDem(), -1, 50)).toBe(null);
    expect(sampleElevation(tinyDem(), 50, 101)).toBe(null);
  });

  it('noDataValue와 같은 값은 null로 본다', () => {
    const dem = tinyDem({ data: Float32Array.from([0, 10, 20, -9999]), noDataValue: -9999 });
    expect(sampleElevation(dem, 90, 10)).toBe(null);
  });
});

describe('buildTerrainGeometry', () => {
  it('고도에 과장을 곱해 높이로 쓴다', () => {
    const geo = buildTerrainGeometry({
      demData: tinyDem(), extent: [0, 0, 100, 100], maxGrid: 2, exaggeration: 2, latitude: 0
    });
    // 정점 3 = (i=1, j=1) = 오른쪽 아래 = 30m → 30 × 1 × 2 = 60
    expect(geo.positions[3 * 3 + 1]).toBeCloseTo(60, 5);
  });

  it('위도가 높을수록 고도를 더 키운다 (웹 메르카토르 보정)', () => {
    const geo = buildTerrainGeometry({
      demData: tinyDem(), extent: [0, 0, 100, 100], maxGrid: 2, exaggeration: 1, latitude: 60
    });
    // cos 60° = 0.5 → 1/cos = 2 → 30m × 2 × 1 = 60
    expect(geo.positions[3 * 3 + 1]).toBeCloseTo(60, 5);
  });

  it('화면 범위 중심을 원점으로 삼는다', () => {
    const geo = buildTerrainGeometry({
      demData: tinyDem(), extent: [0, 0, 50, 50], maxGrid: 2, exaggeration: 1, latitude: 0
    });
    // 첫 정점 = 왼쪽 위 = (0, 50) → 중심 (25,25) 기준 x=-25, z=-25
    expect(geo.positions[0]).toBeCloseTo(-25, 5);
    expect(geo.positions[2]).toBeCloseTo(-25, 5);
  });

  it('maxGrid를 넘는 DEM은 솎아낸다', () => {
    const dem = {
      data: new Float32Array(1000 * 1000),
      width: 1000, height: 1000, extent: [0, 0, 1000, 1000],
      minVal: 0, maxVal: 0, noDataValue: null
    };
    const geo = buildTerrainGeometry({
      demData: dem, extent: [0, 0, 1000, 1000], maxGrid: 64, exaggeration: 1, latitude: 0
    });
    expect(geo.gridWidth).toBe(64);
    expect(geo.gridHeight).toBe(64);
    expect(geo.positions.length / 3).toBe(64 * 64);
  });

  it('고도가 없는 정점에 닿는 삼각형을 뺀다', () => {
    const dem = tinyDem({ data: Float32Array.from([0, 10, 20, -9999]), noDataValue: -9999 });
    const geo = buildTerrainGeometry({
      demData: dem, extent: [0, 0, 100, 100], maxGrid: 2, exaggeration: 1, latitude: 0
    });
    // 2×2 격자 = 삼각형 2개. 오른쪽 아래 정점을 쓰는 삼각형 1개만 빠진다
    expect(geo.indices.length).toBe(3);
    expect(geo.holes).toBe(1);
  });

  it('UV는 텍스처 위쪽이 북쪽이 되게 뒤집는다', () => {
    const geo = buildTerrainGeometry({
      demData: tinyDem(), extent: [0, 0, 100, 100], maxGrid: 2, exaggeration: 1, latitude: 0
    });
    expect(geo.uvs[0]).toBeCloseTo(0, 5);  // 첫 정점(북서) u
    expect(geo.uvs[1]).toBeCloseTo(1, 5);  // 첫 정점(북서) v — 텍스처 위쪽
  });
});
