// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { dedupeSeeds } from './voronoiHelpers.js';

const seed = (x, y, props = {}) => ({ coord: [x, y], properties: props });

describe('dedupeSeeds', () => {
  it('중복이 없으면 그대로 돌려준다', () => {
    const input = [seed(0, 0), seed(100, 100), seed(200, 50)];
    const result = dedupeSeeds(input);
    expect(result.seeds).toHaveLength(3);
    expect(result.duplicates).toBe(0);
  });

  it('정확히 겹친 좌표를 하나로 줄인다', () => {
    const input = [seed(0, 0), seed(100, 100), seed(0, 0)];
    const result = dedupeSeeds(input);
    expect(result.seeds).toHaveLength(2);
    expect(result.duplicates).toBe(1);
  });

  it('중복 중 첫 번째의 속성을 남긴다', () => {
    const input = [seed(0, 0, { name: '첫째' }), seed(0, 0, { name: '둘째' })];
    const result = dedupeSeeds(input);
    expect(result.seeds).toHaveLength(1);
    expect(result.seeds[0].properties.name).toBe('첫째');
  });

  it('전부 같은 좌표면 하나만 남는다', () => {
    const input = [seed(5, 5), seed(5, 5), seed(5, 5)];
    const result = dedupeSeeds(input);
    expect(result.seeds).toHaveLength(1);
    expect(result.duplicates).toBe(2);
  });

  it('같은 격자에 떨어지는 근접 좌표는 같은 점으로 본다', () => {
    // 격자 반올림이라 거리 허용오차가 아니다. 경계를 걸치면 더 가까워도 갈라진다.
    // 우리가 필요한 보장은 "정확히 겹친 좌표는 반드시 합쳐진다" 하나뿐이다.
    const input = [seed(0, 0), seed(0.0002, 0.0002)];
    const result = dedupeSeeds(input);
    expect(result.seeds).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it('1m 차이는 다른 점으로 본다', () => {
    const input = [seed(0, 0), seed(1, 0)];
    const result = dedupeSeeds(input);
    expect(result.seeds).toHaveLength(2);
    expect(result.duplicates).toBe(0);
  });

  it('빈 배열을 처리한다', () => {
    const result = dedupeSeeds([]);
    expect(result.seeds).toEqual([]);
    expect(result.duplicates).toBe(0);
  });
});
