// @vitest-environment jsdom
// © 2026 김용현
/**
 * 계획(ops) → 캔버스 호출. jsdom 에는 2D 컨텍스트가 없으므로
 * - renderFillCanvas 는 주입한 가짜 캔버스로 "어떤 호출을 하는지"를 검증하고
 * - fillFor 는 컨텍스트가 없을 때 기준색 문자열로 물러서는지를 검증한다.
 * 실제 패턴 픽셀은 Electron 하네스(scripts/verify/labs-class-fill.cjs)가 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderFillCanvas, fillFor, tileDataUrl, onFillAssetsReady, clearFillCache, imageIdOf } from './classFillCanvas.js';
import { planFill } from './classFill.js';

function fakeCanvas(w, h) {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_, prop) {
      if (prop === 'calls') return calls;
      return (...args) => { calls.push([prop, ...args]); };
    },
    set(_, prop, value) { calls.push(['set', prop, value]); return true; }
  });
  return { width: w, height: h, calls, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,FAKE' };
}

beforeEach(() => { clearFillCache(); });

describe('renderFillCanvas', () => {
  it('배경을 깔고 ops 를 순서대로 그리며 마지막 alpha 는 destination-in', () => {
    const plan = planFill({ kind: 'dots', spacing: 10, radius: 2 }, '#112233', 0.5);
    const made = [];
    const canvas = renderFillCanvas(plan, { createCanvas: (w, h) => { const c = fakeCanvas(w, h); made.push(c); return c; } });
    expect(canvas).toBe(made[0]);
    expect(canvas.width).toBe(10);
    const calls = canvas.calls;
    expect(calls).toContainEqual(['set', 'fillStyle', '#112233']);
    expect(calls).toContainEqual(['fillRect', 0, 0, 10, 10]);
    expect(calls).toContainEqual(['arc', 5, 5, 2, 0, Math.PI * 2]);
    const alphaIdx = calls.findIndex((c) => c[0] === 'set' && c[1] === 'globalCompositeOperation' && c[2] === 'destination-in');
    expect(alphaIdx).toBeGreaterThan(0);
    expect(calls.slice(alphaIdx)).toContainEqual(['set', 'fillStyle', 'rgba(0,0,0,0.5)']);
  });

  it('alpha 1 이면 destination-in 을 하지 않는다', () => {
    const plan = planFill({ kind: 'cross' }, '#112233', 1);
    const canvas = renderFillCanvas(plan, { createCanvas: fakeCanvas });
    expect(canvas.calls.some((c) => c[2] === 'destination-in')).toBe(false);
  });

  it('이미지가 아직 없으면 image op 을 건너뛴다', () => {
    const plan = planFill({ kind: 'image', dataUrl: 'data:image/png;base64,AA==', width: 10, height: 10 }, '#112233', 1);
    const canvas = renderFillCanvas(plan, { createCanvas: fakeCanvas, getImage: () => null });
    expect(canvas.calls.some((c) => c[0] === 'drawImage')).toBe(false);
    const img = { naturalWidth: 10 };
    const canvas2 = renderFillCanvas(plan, { createCanvas: fakeCanvas, getImage: () => img });
    expect(canvas2.calls).toContainEqual(['drawImage', img, 0, 0, 10, 10]);
  });

  it('틴트는 multiply 로 타일 전체를 칠한다', () => {
    const plan = planFill({ kind: 'texture', name: 'paper' }, '#3366cc', 1);
    const canvas = renderFillCanvas(plan, { createCanvas: fakeCanvas });
    const i = canvas.calls.findIndex((c) => c[0] === 'set' && c[1] === 'globalCompositeOperation' && c[2] === 'multiply');
    expect(i).toBeGreaterThan(0);
    expect(canvas.calls.slice(i, i + 6)).toContainEqual(['set', 'fillStyle', '#3366cc']);
  });

  it('컨텍스트가 없으면 null', () => {
    const plan = planFill({ kind: 'cross' }, '#112233', 1);
    expect(renderFillCanvas(plan, { createCanvas: () => ({ width: 8, height: 8, getContext: () => null }) })).toBeNull();
  });
});

describe('fillFor', () => {
  beforeEach(() => {
    // jsdom 은 getContext 를 "Not implemented" 로 죽인다 — 조용히 null 로
    HTMLCanvasElement.prototype.getContext = () => null;
  });

  it('단색은 rgba 문자열', () => {
    expect(fillFor(undefined, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
    expect(fillFor({ kind: 'solid' }, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
  });

  it('컨텍스트가 없으면 패턴 대신 fallback 문자열, 예외 없음', () => {
    expect(fillFor({ kind: 'hatch' }, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
    expect(fillFor({ kind: 'hatch', background: 'none' }, '#ff0000', 0.7)).toBe('rgba(0, 0, 0, 0)');
    expect(fillFor({ kind: 'texture' }, '#ff0000', 0.7)).toBe('rgba(255, 0, 0, 0.7)');
  });

  it('이미지는 읽기를 시작하고 그동안 기준색을 준다', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    const spy = vi.fn();
    const off = onFillAssetsReady(spy);
    expect(fillFor({ kind: 'image', dataUrl: src, width: 4, height: 4 }, '#00ff00', 1)).toBe('rgba(0, 255, 0, 1)');
    expect(imageIdOf(src)).toBe(imageIdOf(src));
    expect(imageIdOf(src)).not.toBe(imageIdOf(src + 'x'));
    off();
  });
});

describe('tileDataUrl', () => {
  it('컨텍스트가 없으면 null', () => {
    HTMLCanvasElement.prototype.getContext = () => null;
    expect(tileDataUrl({ kind: 'hatch' }, '#ff0000')).toBeNull();
  });
});
