// © 2026 김용현
/**
 * SwipeTool 은 대상 레이어의 prerender/postrender 에 클립을 붙였다 뗀다.
 * OL 공식 layer-swipe 예제와 같은 방식: 네 모서리를 getRenderPixel 로 캔버스 픽셀로 바꿔 clip.
 * 여기서는 가짜 레이어·지도·렌더 이벤트로 등록·해제와 클립 좌표만 본다. 실제 그림은 하네스.
 */
import { describe, it, expect, vi } from 'vitest';
import { SwipeTool } from './SwipeTool.js';

function fakeLayer() {
  const handlers = {};
  return {
    handlers,
    on: vi.fn((type, fn) => { handlers[type] = fn; }),
    un: vi.fn((type) => { delete handlers[type]; })
  };
}

function fakeMap(size = [800, 600]) {
  return { getSize: () => size, render: vi.fn() };
}

function fakeCtx() {
  return {
    calls: [],
    save() { this.calls.push(['save']); },
    beginPath() { this.calls.push(['beginPath']); },
    moveTo(x, y) { this.calls.push(['moveTo', x, y]); },
    lineTo(x, y) { this.calls.push(['lineTo', x, y]); },
    closePath() { this.calls.push(['closePath']); },
    clip() { this.calls.push(['clip']); },
    restore() { this.calls.push(['restore']); }
  };
}

// inversePixelTransform: CSS 픽셀 → 캔버스 픽셀. 픽셀비 2 이면 [2,0,0,2,0,0].
const renderEvent = (ctx, scale = 1) => ({ context: ctx, inversePixelTransform: [scale, 0, 0, scale, 0, 0] });

describe('SwipeTool', () => {
  it('attach 는 prerender·postrender 를 걸고 지도를 다시 그린다', () => {
    const map = fakeMap();
    const layer = fakeLayer();
    const tool = new SwipeTool({ map });
    tool.attach(layer, { orientation: 'vertical', ratio: 0.5 });
    expect(layer.on).toHaveBeenCalledWith('prerender', expect.any(Function));
    expect(layer.on).toHaveBeenCalledWith('postrender', expect.any(Function));
    expect(map.render).toHaveBeenCalledTimes(1);
    expect(tool.isActive()).toBe(true);
    expect(tool.target).toBe(layer);
  });

  it('prerender 는 CSS 모서리를 캔버스 픽셀로 바꿔 clip 하고 postrender 는 restore 한다', () => {
    const map = fakeMap([800, 600]);
    const layer = fakeLayer();
    const tool = new SwipeTool({ map });
    tool.attach(layer, { orientation: 'vertical', ratio: 0.25 });

    const ctx = fakeCtx();
    layer.handlers.prerender(renderEvent(ctx, 2));
    expect(ctx.calls).toEqual([
      ['save'], ['beginPath'],
      ['moveTo', 0, 0], ['lineTo', 400, 0], ['lineTo', 400, 1200], ['lineTo', 0, 1200],
      ['closePath'], ['clip']
    ]);
    layer.handlers.postrender(renderEvent(ctx, 2));
    expect(ctx.calls.at(-1)).toEqual(['restore']);
  });

  it('setRatio·setOrientation 은 값을 바꾸고 다시 그린다', () => {
    const map = fakeMap([800, 600]);
    const layer = fakeLayer();
    const tool = new SwipeTool({ map });
    tool.attach(layer);
    map.render.mockClear();

    tool.setRatio(1.5);
    expect(tool.ratio).toBe(1);
    tool.setOrientation('horizontal');
    expect(tool.orientation).toBe('horizontal');
    expect(map.render).toHaveBeenCalledTimes(2);

    const ctx = fakeCtx();
    layer.handlers.prerender(renderEvent(ctx));
    expect(ctx.calls[3]).toEqual(['lineTo', 800, 0]);
    expect(ctx.calls[4]).toEqual(['lineTo', 800, 600]);
  });

  it('모르는 방향은 무시한다', () => {
    const tool = new SwipeTool({ map: fakeMap() });
    tool.setOrientation('diagonal');
    expect(tool.orientation).toBe('vertical');
  });

  it('detach 는 두 핸들러를 떼고 다시 그리며, 두 번 불러도 안전하다', () => {
    const map = fakeMap();
    const layer = fakeLayer();
    const tool = new SwipeTool({ map });
    tool.attach(layer);
    map.render.mockClear();

    tool.detach();
    expect(layer.un).toHaveBeenCalledWith('prerender', expect.any(Function));
    expect(layer.un).toHaveBeenCalledWith('postrender', expect.any(Function));
    expect(layer.handlers).toEqual({});
    expect(map.render).toHaveBeenCalledTimes(1);
    expect(tool.isActive()).toBe(false);
    expect(tool.target).toBeNull();

    expect(() => tool.detach()).not.toThrow();
    expect(map.render).toHaveBeenCalledTimes(1);
  });

  it('다른 레이어에 attach 하면 앞 레이어는 먼저 뗀다', () => {
    const map = fakeMap();
    const a = fakeLayer();
    const b = fakeLayer();
    const tool = new SwipeTool({ map });
    tool.attach(a);
    tool.attach(b);
    expect(a.handlers).toEqual({});
    expect(Object.keys(b.handlers).sort()).toEqual(['postrender', 'prerender']);
  });

  it('지도 크기가 없으면 prerender 가 빈 사각형으로 클립한다', () => {
    const map = { getSize: () => undefined, render: vi.fn() };
    const layer = fakeLayer();
    const tool = new SwipeTool({ map });
    tool.attach(layer);
    const ctx = fakeCtx();
    layer.handlers.prerender(renderEvent(ctx));
    expect(ctx.calls.filter((c) => c[0] === 'lineTo')).toEqual([['lineTo', 0, 0], ['lineTo', 0, 0], ['lineTo', 0, 0]]);
    expect(ctx.calls.at(-1)).toEqual(['clip']);
  });
});
