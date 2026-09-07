// © 2026 김용현
import { describe, it, expect } from 'vitest';
import {
  distanceForExtent, resolutionForDistance, sceneToMap, rebaseOffset, combinedExtentCenter
} from './view3dMath.js';

describe('distanceForExtent · resolutionForDistance', () => {
  it('되돌리면 원래 해상도가 나온다', () => {
    // 1000m를 화면 세로 500px에 담으면 해상도는 2m/px다
    const distance = distanceForExtent(1000, 50);
    expect(resolutionForDistance(distance, 50, 500)).toBeCloseTo(2, 6);
  });

  it('거리가 멀수록 해상도가 커진다', () => {
    const near = resolutionForDistance(1000, 50, 500);
    const far = resolutionForDistance(2000, 50, 500);
    expect(far).toBeCloseTo(near * 2, 6);
  });
});

describe('sceneToMap', () => {
  it('씬 좌표를 지도 좌표로 되돌린다 (z는 부호가 뒤집힌다)', () => {
    expect(sceneToMap({ x: 10, z: -20 }, [1000, 2000])).toEqual([1010, 2020]);
  });
});

describe('rebaseOffset', () => {
  it('원점이 옮겨간 만큼 반대로 밀 값을 준다', () => {
    expect(rebaseOffset([0, 0], [100, 50])).toEqual({ dx: -100, dz: 50 });
  });

  it('원점이 그대로면 밀지 않는다', () => {
    expect(rebaseOffset([500, 500], [500, 500])).toEqual({ dx: 0, dz: 0 });
  });
});

describe('combinedExtentCenter', () => {
  it('여러 범위를 합친 가운데를 돌려준다', () => {
    expect(combinedExtentCenter([[0, 0, 100, 100], [100, 100, 300, 300]]))
      .toEqual([150, 150]);
  });

  it('범위가 하나면 그 가운데다', () => {
    expect(combinedExtentCenter([[10, 20, 30, 60]])).toEqual([20, 40]);
  });

  it('비어 있거나 무한대 범위는 무시한다', () => {
    expect(combinedExtentCenter([])).toBe(null);
    expect(combinedExtentCenter([[Infinity, Infinity, -Infinity, -Infinity]])).toBe(null);
    expect(combinedExtentCenter([null, undefined, [0, 0, 10, 10]])).toEqual([5, 5]);
  });

  it('넓이가 0인 범위(점 하나)도 가운데를 준다', () => {
    expect(combinedExtentCenter([[50, 50, 50, 50]])).toEqual([50, 50]);
  });
});
