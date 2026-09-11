// © 2026 김용현
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { fromLonLat } from 'ol/proj';
import { apply as applyTransform } from 'ol/transform';

let path2dCount = 0;
class FakePath2D { constructor() { path2dCount++; } moveTo() {} lineTo() {} closePath() {} }
class FakeCtx {
  constructor() { this.pixel = [0, 0, 0, 0]; this.lastGetImageData = null; }
  setTransform() {} clearRect() {} fill() {} stroke() {} beginPath() {} arc() {} save() {} restore() {}
  setLineDash() {} fillText() {} strokeText() {} measureText() { return { width: 10 }; }
  isPointInStroke() { return true; }
  getImageData(x, y, w, h) { this.lastGetImageData = [x, y, w, h]; return { data: Uint8ClampedArray.from(this.pixel) }; }
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

// origin/dest 중 하나가 locations 에 없는 불일치 데이터(위치 매칭 실패 등을 흉내)
const datasetWithDangling = {
  locations: dataset.locations,
  flows: [...dataset.flows, { origin: 'a', dest: 'z', count: 99 }],
  meta: { unit: '명' }
};

// 중심 (0,0)·해상도 1000 → 지도좌표 x/1000+400, -y/1000+300
function frameState({ center = [0, 0], resolution = 1000, pixelRatio = 1 } = {}) {
  return {
    size: [800, 600], pixelRatio,
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
    const fs = frameState();
    r.render(fs);
    const hitCtx = r.hitCanvas.getContext('2d');
    hitCtx.pixel = [0, 0, 0, 0];
    expect(r.hitTest([10, 10])).toBeNull();
    hitCtx.pixel = [0, 0, 1, 255];               // id 1 → 첫 흐름 (작은 것부터 정렬: b→a 4)
    expect(r.hitTest([10, 10])).toMatchObject({ type: 'flow', flow: { origin: 'b', dest: 'a', count: 4 } });
    hitCtx.pixel = [0, 0, 3, 255];               // 흐름 2개 다음 → 첫 위치
    // 위치 판정은 실제 거리로 재확인하므로, 위치 a 가 실제로 투영되는 픽셀을 써야 한다
    const locPixel = applyTransform(fs.coordinateToPixelTransform, fromLonLat([dataset.locations[0].lon, dataset.locations[0].lat]));
    expect(r.hitTest(locPixel)).toMatchObject({ type: 'location', location: { id: 'a' } });
    hitCtx.pixel = [0, 0, 1, 128];               // 반투명(테두리 혼색)은 무시
    expect(r.hitTest([10, 10])).toBeNull();
  });

  it('hitTest 는 색이 가리키는 후보를 기하로 재확인해 AA 혼색 오탐을 버린다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setStyle({ animate: false });
    r.setData(dataset);
    r.render(frameState());
    const hitCtx = r.hitCanvas.getContext('2d');

    hitCtx.pixel = [0, 0, 1, 255]; // 색은 흐름 1 을 가리키지만
    hitCtx.isPointInStroke = () => false; // 실제 선 위는 아니다(안티앨리어싱 혼색)
    expect(r.hitTest([10, 10])).toBeNull();
    delete hitCtx.isPointInStroke; // 기본값(true)으로 되돌린다

    hitCtx.pixel = [0, 0, 3, 255]; // 색은 첫 위치(a)를 가리키지만
    expect(r.hitTest([10, 10])).toBeNull(); // (10,10) 은 실제 투영된 a 위치에서 멀다
  });

  it('render 는 데이터가 없으면 null', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    expect(new FlowRenderer({}).render(frameState())).toBeNull();
  });

  it('locations 에 없는 흐름은 걸러내고 render 가 죽지 않는다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setStyle({ animate: false });
    r.setData(datasetWithDangling);
    expect(() => r.render(frameState())).not.toThrow();
    expect(r.getFlowCount()).toBe(2); // a→z(존재하지 않는 위치)는 제외
    const totals = r.getTotals();
    expect(totals.has('z')).toBe(false); // 유령 위치가 집계에 섞이지 않는다
    // a→z(99) 는 outflow 에 더해지지 않는다: a 는 a→b(10) 만, b 는 b→a(4) 만 반영
    expect(totals.get('a')).toMatchObject({ outflow: 10, inflow: 4 });
    expect(totals.get('b')).toMatchObject({ outflow: 4, inflow: 10 });
  });

  it('히트 id 는 24비트 전체를 쓴다 (255 를 넘는 id 도 정확히 복원)', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const locations = [{ id: 'p0', name: 'P0', lon: 120, lat: 35 }];
    const flows = [];
    for (let i = 1; i <= 300; i++) {
      locations.push({ id: 'p' + i, name: 'P' + i, lon: 120 + i * 0.01, lat: 35 + i * 0.01 });
      flows.push({ origin: 'p0', dest: 'p' + i, count: i });
    }
    const bigDataset = { locations, flows, meta: {} };
    const r = new FlowRenderer({});
    r.setStyle({ animate: false });
    r.setData(bigDataset);
    r.render(frameState());
    expect(r.getFlowCount()).toBe(300);
    const hitCtx = r.hitCanvas.getContext('2d');
    hitCtx.pixel = [0, 1, 44, 255]; // (1<<8)|44 = 300
    expect(r.hitTest([10, 10])).toMatchObject({ type: 'flow', key: 'f:299' });
  });

  it('pixelRatio 가 1보다 크면 히트 캔버스를 디바이스 픽셀로 읽는다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setStyle({ animate: false });
    r.setData(dataset);
    r.render(frameState({ pixelRatio: 2 }));
    expect(r.canvas.width).toBe(1600);
    const hitCtx = r.hitCanvas.getContext('2d');
    hitCtx.pixel = [0, 0, 0, 0];
    r.hitTest([10, 20]);
    expect(hitCtx.lastGetImageData).toEqual([20, 40, 1, 1]);
  });
});

describe('FlowRenderer 애니메이션 rAF 수명주기', () => {
  let queue, cancelSpy, origRAF, origCAF, n;

  beforeEach(() => {
    queue = [];
    n = 0;
    origRAF = globalThis.requestAnimationFrame;
    origCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => { queue.push(cb); return ++n; };
    cancelSpy = vi.fn();
    globalThis.cancelAnimationFrame = cancelSpy;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
  });

  it('지도에 붙지 않은 레이어는 animate:true 여도 rAF 를 걸지 않는다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setData(dataset);
    r.setStyle({ animate: true });
    expect(queue.length).toBe(0);
  });

  it('지도에 붙으면 rAF 가 걸리고, visible 을 끄면 멈췄다가 켜면 다시 돈다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setData(dataset);
    r.setStyle({ animate: true });
    expect(queue.length).toBe(0);

    r.setMapInternal({}); // change:map → 지도에 붙음
    expect(queue.length).toBe(1);

    r.setVisible(false);
    expect(cancelSpy).toHaveBeenCalledTimes(1);

    const before = queue.length;
    r.setVisible(true);
    expect(queue.length).toBe(before + 1);
  });

  it('freeze(true) 는 rAF 를 멈추고 freeze(false) 는 다시 건다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setData(dataset);
    r.setStyle({ animate: true });
    r.setMapInternal({});
    expect(queue.length).toBe(1);

    r.freeze(true);
    expect(cancelSpy).toHaveBeenCalledTimes(1);

    r.freeze(false);
    expect(queue.length).toBe(2);
  });

  it('dispose() 는 돌고 있는 rAF 를 취소한다', async () => {
    const { FlowRenderer } = await import('./FlowRenderer.js');
    const r = new FlowRenderer({});
    r.setData(dataset);
    r.setStyle({ animate: true });
    r.setMapInternal({});
    expect(queue.length).toBe(1);

    r.dispose();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
