// © 2026 김용현
import { describe, it, expect, vi } from 'vitest';
import View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { CameraAnimator } from './CameraAnimator.js';

function setup() {
  const view = new View({ center: [0, 0], zoom: 2 });
  const animate = vi.spyOn(view, 'animate').mockImplementation(() => {});
  const cancel = vi.spyOn(view, 'cancelAnimations');
  return { animate, cancel, animator: new CameraAnimator(view) };
}

describe('CameraAnimator.flyTo', () => {
  it('이전 비행을 취소하고 center(3857 변환)+zoom을 한 번에 애니메이트한다', () => {
    const { animate, cancel, animator } = setup();
    animator.flyTo({ center: [129.05, 35.15], zoom: 11 });
    expect(cancel).toHaveBeenCalled();
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(animate.mock.invocationCallOrder[0]);
    const args = animate.mock.calls[0][0];
    expect(args.center).toEqual(fromLonLat([129.05, 35.15]));
    expect(args.zoom).toBe(11);
    expect(args.duration).toBe(800);
    expect(typeof args.easing).toBe('function');
  });

  it('duration 옵션이 반영된다', () => {
    const { animate, animator } = setup();
    animator.flyTo({ center: [127, 37], zoom: 9 }, { duration: 300 });
    expect(animate.mock.calls[0][0].duration).toBe(300);
  });

  it('camera가 null이면 아무것도 하지 않는다', () => {
    const { animate, cancel, animator } = setup();
    animator.flyTo(null);
    expect(animate).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('center가 배열이 아니면 무시한다(손상 카메라 가드)', () => {
    const { animate, animator } = setup();
    animator.flyTo({ center: 'busan', zoom: 9 });
    expect(animate).not.toHaveBeenCalled();
  });
});
