// © 2026 김용현
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';

let path2dCount = 0;
class FakePath2D { constructor() { path2dCount++; } moveTo() {} lineTo() {} closePath() {} }
class FakeCtx {
  constructor() { this.pixel = [0, 0, 0, 0]; }
  setTransform() {} clearRect() {} fill() {} stroke() {} beginPath() {} arc() {} save() {} restore() {}
  setLineDash() {} fillText() {} strokeText() {} measureText() { return { width: 10 }; }
  getImageData() { return { data: Uint8ClampedArray.from(this.pixel) }; }
}
const ctxByCanvas = new WeakMap();

beforeAll(() => {
  globalThis.Path2D = FakePath2D;
  HTMLCanvasElement.prototype.getContext = function () {
    if (!ctxByCanvas.has(this)) ctxByCanvas.set(this, new FakeCtx());
    return ctxByCanvas.get(this);
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
});

const dataset = {
  locations: [
    { id: 'a', name: 'A', lon: 126.9, lat: 37.5 },
    { id: 'b', name: 'B', lon: 129.0, lat: 35.1 }
  ],
  flows: [{ origin: 'a', dest: 'b', count: 10 }, { origin: 'b', dest: 'a', count: 4 }],
  meta: { unit: '명' }
};

// 중심 (0,0)·해상도 1000 → 지도좌표 x/1000+400, -y/1000+300
function frameState({ center = [0, 0], resolution = 1000 } = {}) {
  return {
    size: [800, 600], pixelRatio: 1,
    viewState: { center, resolution, rotation: 0 },
    coordinateToPixelTransform: [1 / resolution, 0, 0, -1 / resolution, 400 - center[0] / resolution, 300 + center[1] / resolution]
  };
}

describe('FlowRenderer', () => {
  it('뷰가 같으면 Path2D를 다시 만들지 않고, 뷰가 바뀌면 다시 만든다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({ zIndex: 1 });
    r.setStyle({ animate: false });
    r.setData(dataset);
    const fs = frameState();
    const el = r.render(fs);
    expect(el).toBeInstanceOf(HTMLCanvasElement);
    const after1 = path2dCount;
    expect(after1).toBe(4); // 흐름 2개 × (외곽선 + 중심선)
    r.render(frameState());
    expect(path2dCount).toBe(after1);
    r.render(frameState({ center: [1000, 0] }));
    expect(path2dCount).toBe(after1 + 4);
  });

  it('hitTest 는 히트 캔버스의 색을 흐름/위치로 되돌린다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({ zIndex: 1 });
    r.setStyle({ animate: false });
    r.setData(dataset);
    r.render(frameState());
    const hitCtx = r.hitCanvas.getContext('2d');
    hitCtx.pixel = [0, 0, 0, 0];
    expect(r.hitTest([10, 10])).toBeNull();
    hitCtx.pixel = [0, 0, 1, 255];               // id 1 → 첫 흐름 (작은 것부터 정렬: b→a 4)
    expect(r.hitTest([10, 10])).toMatchObject({ type: 'flow', flow: { origin: 'b', dest: 'a', count: 4 } });
    hitCtx.pixel = [0, 0, 3, 255];               // 흐름 2개 다음 → 첫 위치
    expect(r.hitTest([10, 10])).toMatchObject({ type: 'location', location: { id: 'a' } });
    hitCtx.pixel = [0, 0, 1, 128];               // 반투명(테두리 혼색)은 무시
    expect(r.hitTest([10, 10])).toBeNull();
  });

  it('render 는 데이터가 없으면 null', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    expect(new FlowRenderer({}).render(frameState())).toBeNull();
  });
});
