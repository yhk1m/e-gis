// © 2026 김용현
// @vitest-environment jsdom
/**
 * 조립부의 상태 규칙만 본다 — 그림은 Task 11 하네스가 본다.
 * - 원통 투영은 φ 를 0 으로 두지만 위도는 기억한다: 나갈 때 2D 중심, 방위 투영으로 돌아올 때 정면.
 * - 세 손가락 중 하나를 떼도 배율이 튀지 않는다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobeController } from './GlobeController.js';

let frames;

function fakeCtx() {
  return new Proxy({}, {
    get(target, key) { return key in target ? target[key] : () => {}; },
    set(target, key, value) { target[key] = value; return true; }
  });
}

beforeEach(() => {
  frames = [];
  globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  HTMLCanvasElement.prototype.getContext = () => fakeCtx();
});

function makeController(center = [127, 37.5]) {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 800 });
  Object.defineProperty(container, 'clientHeight', { value: 600 });
  document.body.appendChild(container);
  const setCenter = vi.fn();
  const controller = new GlobeController({
    mapManager: { getCenter: () => center, setCenter },
    layerManager: { getAllLayers: () => [] },
    container
  });
  return { controller, setCenter };
}

function pointer(canvas, type, pointerId, clientX, clientY) {
  const e = new Event(type);
  Object.assign(e, { pointerId, clientX, clientY, pointerType: 'touch', button: 0 });
  canvas.dispatchEvent(e);
}

describe('원통 투영에서도 위도를 기억한다', () => {
  it('서울에서 들어와 메르카토르로 바꾸고 나가면 2D 중심 위도가 그대로다', () => {
    const { controller, setCenter } = makeController();
    controller.enter();
    controller.setProjection('mercator');
    expect(controller.rotation[1]).toBe(0);
    controller.exit();
    expect(setCenter).toHaveBeenCalledTimes(1);
    const [[lon, lat], animate] = setCenter.mock.calls[0];
    expect(lon).toBeCloseTo(127, 6);
    expect(lat).toBeCloseTo(37.5, 6);
    expect(animate).toBe(false);
  });

  it('메르카토르에서 정사영으로 돌아오면 정면 위도가 되살아난다', () => {
    const { controller } = makeController();
    controller.enter();
    controller.setProjection('mercator');
    controller.setProjection('orthographic');
    expect(controller.rotation[1]).toBeCloseTo(-37.5, 6);
    controller.exit();
  });
});

describe('핀치', () => {
  it('세 손가락 중 하나를 떼도 다음 이동에서 배율이 튀지 않는다', () => {
    const { controller } = makeController();
    controller.enter();
    const c = controller.canvas;
    pointer(c, 'pointerdown', 1, 0, 0);
    pointer(c, 'pointerdown', 2, 100, 0);
    pointer(c, 'pointerdown', 3, 300, 0);
    pointer(c, 'pointerup', 1, 0, 0);          // 남은 두 손가락 간격 200 (핀치 기준은 100 이었다)
    const before = controller.scale;
    pointer(c, 'pointermove', 3, 301, 0);      // 1px 벌림
    expect(controller.scale / before).toBeCloseTo(201 / 200, 6);
    controller.exit();
  });
});
