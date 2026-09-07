// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { planComposition } from './mapTexture.js';

/** OL 레이어 캔버스 대역 */
function fakeCanvas(width, height, transform = '', opacity = '') {
  return {
    width,
    height,
    style: { transform, opacity: '' },
    parentNode: { style: { opacity } }
  };
}

describe('planComposition', () => {
  it('출력 크기는 레이어 캔버스가 아니라 지도 뷰포트 크기다', () => {
    // OL은 뷰포트보다 큰 캔버스를 잡아 두고 transform으로 위치를 맞춘다.
    // 캔버스 크기를 쓰면 텍스처에 빈 여백이 생겨 지형에 검은 띠가 나타난다.
    const plan = planComposition([fakeCanvas(2400, 1800)], [800, 600], 2048);
    expect(plan.width).toBe(800);
    expect(plan.height).toBe(600);
    expect(plan.scale).toBe(1);
  });

  it('상한을 넘으면 긴 변이 상한에 맞게 줄인다', () => {
    const plan = planComposition([fakeCanvas(4096, 2048)], [4096, 2048], 2048);
    expect(plan.scale).toBeCloseTo(0.5, 5);
    expect(plan.width).toBe(2048);
    expect(plan.height).toBe(1024);
  });

  it('transform 행렬에 배율을 곱해 돌려준다', () => {
    const plan = planComposition(
      [fakeCanvas(4096, 4096, 'matrix(1, 0, 0, 1, 10, 20)')], [4096, 4096], 2048
    );
    expect(plan.layers[0].matrix).toEqual([0.5, 0, 0, 0.5, 5, 10]);
  });

  it('transform이 없으면 캔버스를 뷰포트 크기에 맞춰 줄이는 행렬을 만든다', () => {
    // 고해상도 화면에서 캔버스는 뷰포트의 2배로 잡힌다
    const plan = planComposition([fakeCanvas(1600, 1200)], [800, 600], 2048);
    expect(plan.layers[0].matrix).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it('부모의 투명도를 반영한다', () => {
    const plan = planComposition([fakeCanvas(800, 600, '', '0.4')], [800, 600], 2048);
    expect(plan.layers[0].alpha).toBeCloseTo(0.4, 5);
  });

  it('크기가 0인 캔버스는 뺀다', () => {
    const plan = planComposition([fakeCanvas(0, 0), fakeCanvas(800, 600)], [800, 600], 2048);
    expect(plan.layers).toHaveLength(1);
    expect(plan.width).toBe(800);
  });

  it('그릴 캔버스가 하나도 없으면 null이다', () => {
    expect(planComposition([], [800, 600], 2048)).toBe(null);
  });

  it('지도 크기를 모르면 null이다', () => {
    expect(planComposition([fakeCanvas(800, 600)], undefined, 2048)).toBe(null);
    expect(planComposition([fakeCanvas(800, 600)], [0, 600], 2048)).toBe(null);
  });
});
