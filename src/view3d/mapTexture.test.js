// © 2026 김용현
import { describe, it, expect } from 'vitest';
import { planComposition, opaqueRatio } from './mapTexture.js';

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
    const plan = planComposition([fakeCanvas(2400, 1800)], [800, 600], { maxSize: 2048 });
    expect(plan.width).toBe(800);
    expect(plan.height).toBe(600);
    expect(plan.scale).toBe(1);
  });

  it('상한을 넘으면 긴 변이 상한에 맞게 줄인다', () => {
    const plan = planComposition([fakeCanvas(4096, 2048)], [4096, 2048], { maxSize: 2048 });
    expect(plan.scale).toBeCloseTo(0.5, 5);
    expect(plan.width).toBe(2048);
    expect(plan.height).toBe(1024);
  });

  it('transform 행렬에 배율을 곱해 돌려준다', () => {
    const plan = planComposition(
      [fakeCanvas(4096, 4096, 'matrix(1, 0, 0, 1, 10, 20)')], [4096, 4096], { maxSize: 2048 }
    );
    expect(plan.layers[0].matrix).toEqual([0.5, 0, 0, 0.5, 5, 10]);
  });

  it('transform이 없으면 캔버스를 출력 크기에 맞추는 행렬을 만든다', () => {
    const plan = planComposition([fakeCanvas(1600, 1200)], [800, 600], { maxSize: 2048 });
    expect(plan.layers[0].matrix).toEqual([0.5, 0, 0, 0.5, 0, 0]);
  });

  it('기기 픽셀비만큼 크게 뽑는다 — OL이 이미 그린 해상도를 버리지 않는다', () => {
    // 실측값: OL 캔버스 1683px, transform 0.6667, 뷰포트 1122 CSS픽셀, 픽셀비 1.5
    const plan = planComposition(
      [fakeCanvas(1683, 1109, 'matrix(0.666667, 0, 0, 0.666667, 0, 0)')],
      [1122, 739], { pixelRatio: 1.5, maxSize: 2048 }
    );
    expect(plan.width).toBe(1683);
    expect(plan.layers[0].matrix[0]).toBeCloseTo(1, 5);   // 1:1로 그린다
  });

  it('픽셀비를 곱한 크기가 상한을 넘으면 줄인다', () => {
    const plan = planComposition([fakeCanvas(3200, 2400)], [1600, 1200], { pixelRatio: 2, maxSize: 2048 });
    expect(plan.width).toBe(2048);
    expect(plan.scale).toBeCloseTo(0.64, 5);
  });

  it('부모의 투명도를 반영한다', () => {
    const plan = planComposition([fakeCanvas(800, 600, '', '0.4')], [800, 600], { maxSize: 2048 });
    expect(plan.layers[0].alpha).toBeCloseTo(0.4, 5);
  });

  it('크기가 0인 캔버스는 뺀다', () => {
    const plan = planComposition([fakeCanvas(0, 0), fakeCanvas(800, 600)], [800, 600], { maxSize: 2048 });
    expect(plan.layers).toHaveLength(1);
    expect(plan.width).toBe(800);
  });

  it('그릴 캔버스가 하나도 없으면 null이다', () => {
    expect(planComposition([], [800, 600], { maxSize: 2048 })).toBe(null);
  });

  it('지도 크기를 모르면 null이다', () => {
    expect(planComposition([fakeCanvas(800, 600)], undefined, { maxSize: 2048 })).toBe(null);
    expect(planComposition([fakeCanvas(800, 600)], [0, 600], { maxSize: 2048 })).toBe(null);
  });
});

describe('opaqueRatio', () => {
  const rgba = (list) => Uint8ClampedArray.from(list.flat());

  it('전부 불투명하면 1이다', () => {
    expect(opaqueRatio(rgba([[0, 0, 0, 255], [1, 2, 3, 255]]))).toBe(1);
  });

  it('전부 투명하면 0이다 — 타일이 안 온 순간이 이 모습이다', () => {
    expect(opaqueRatio(rgba([[0, 0, 0, 0], [0, 0, 0, 0]]))).toBe(0);
  });

  it('절반이면 0.5다', () => {
    expect(opaqueRatio(rgba([[0, 0, 0, 255], [0, 0, 0, 0]]))).toBe(0.5);
  });

  it('거의 투명한 픽셀은 안 친다', () => {
    expect(opaqueRatio(rgba([[0, 0, 0, 5], [0, 0, 0, 5]]))).toBe(0);
  });

  it('빈 배열은 0이다', () => {
    expect(opaqueRatio(new Uint8ClampedArray(0))).toBe(0);
    expect(opaqueRatio(null)).toBe(0);
  });
});
