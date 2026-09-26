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

let ops;

/** 메서드 이름만 ops 에 적는 가짜 2D 컨텍스트 */
function fakeCtx() {
  return new Proxy({}, {
    get(target, key) { return key in target ? target[key] : () => { ops.push(key); }; },
    set(target, key, value) { target[key] = value; return true; }
  });
}

beforeEach(() => {
  frames = [];
  ops = [];
  delete document.documentElement.dataset.surface;
  window.matchMedia = undefined;
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

describe('캔버스 위 조작이 브라우저 기본 동작으로 새지 않는다', () => {
  it('끌 수 없는 캔버스이고 dragstart 는 막는다', () => {
    const { controller } = makeController();
    controller.enter();
    expect(controller.canvas.draggable).toBe(false);
    const e = new Event('dragstart', { cancelable: true });
    controller.canvas.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    controller.exit();
  });

  it('더블클릭은 처음 자세로 돌리고 생긴 글자 선택을 지운다', () => {
    const removeAllRanges = vi.fn();
    const spy = vi.spyOn(window, 'getSelection').mockReturnValue({ removeAllRanges });
    const { controller } = makeController();
    controller.enter();
    controller.scale = controller.fit * 3;
    const e = new Event('dblclick', { cancelable: true });
    controller.canvas.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(removeAllRanges).toHaveBeenCalled();
    expect(controller.scale).toBe(controller.fit);
    controller.exit();
    spy.mockRestore();
  });

  it('마우스 pointerdown 의 기본 동작(선택 시작)을 막는다', () => {
    const { controller } = makeController();
    controller.enter();
    const e = new Event('pointerdown', { cancelable: true });
    Object.assign(e, { pointerId: 1, clientX: 0, clientY: 0, pointerType: 'mouse', button: 0 });
    controller.canvas.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    controller.exit();
  });
});

describe('2D 와의 경계', () => {
  it('켜 있는 동안 컨테이너에 globe-active 를 둔다(축척바 숨김)', () => {
    const { controller } = makeController();
    controller.enter();
    expect(controller.container.classList.contains('globe-active')).toBe(true);
    controller.exit();
    expect(controller.container.classList.contains('globe-active')).toBe(false);
  });

  it('PNG 는 구 밖이 투명하고, 화면은 다시 불투명 배경으로 그린다', () => {
    const { controller } = makeController();
    controller.enter();
    let opsAtCapture = null;
    controller.canvas.toDataURL = () => { opsAtCapture = ops.slice(); return 'data:image/png;base64,AA'; };
    ops = [];
    expect(controller.toDataURL()).toBe('data:image/png;base64,AA');
    expect(opsAtCapture.includes('fillRect')).toBe(false);
    expect(ops.slice(opsAtCapture.length).includes('fillRect')).toBe(true);
    controller.exit();
  });

  it('글래스 데스크톱이면 막대·패널 오프셋만큼 뺀 상자에 맞춘다', () => {
    document.documentElement.dataset.surface = 'glass';
    window.matchMedia = (q) => ({ matches: q === '(min-width: 1025px) and (pointer: fine)' });
    const { controller } = makeController();
    controller.container.style.setProperty('--glass-top-offset', '100px');
    controller.container.style.setProperty('--glass-bottom-offset', '20px');
    controller.container.style.setProperty('--glass-panel-offset', '300px');
    controller.enter();
    expect(controller.inset).toEqual({ top: 100, right: 0, bottom: 20, left: 300 });
    expect(controller.fit).toBeCloseTo((600 - 120 - 40) / 2, 6);
    controller.exit();
  });

  it('글래스가 아니면 오프셋 변수가 남아 있어도 전체에 맞춘다', () => {
    const { controller } = makeController();
    controller.container.style.setProperty('--glass-top-offset', '100px');
    controller.enter();
    expect(controller.inset).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(controller.fit).toBeCloseTo(280, 6);
    controller.exit();
  });
});
