// © 2026 김용현
// @vitest-environment jsdom
/**
 * 실험 class-fill 의 가드는 여기 한 곳이다.
 * 켜지면 #map 에 labs-class-fill 클래스가 붙고 범례 클릭 훅이 팝오버를 연다.
 * 꺼지면 클래스가 빠지고 열려 있던 팝오버가 닫히며 훅은 아무 일도 하지 않는다.
 * 범례는 끌 수 있으므로(makeDraggable) 색 칸에서 시작한 끌기가 끝나며 생기는 click 은
 * 팝오버를 열지 않아야 한다 — pointerdown·pointerup 사이 3px 넘게 움직였으면 무시.
 * 승격할 때는 labs.isOn 검사를 지우면 된다.
 */
import { describe, it, expect, vi } from 'vitest';
import { bindClassFill, CLASS_FILL_ID, MAP_CLASS, DRAG_THRESHOLD_PX } from './classFillBinding.js';
import { Labs } from './labs.js';

function fakeMap() {
  const set = new Set();
  return { set, classList: { toggle: (c, on) => { if (on) set.add(c); else set.delete(c); }, contains: (c) => set.has(c) } };
}

function make(search = '', mapEl = fakeMap()) {
  const labs = new Labs();
  labs.init({ knownIds: ['glass', CLASS_FILL_ID], search });
  const tool = { onLegendColorClick: null };
  const popover = { open: vi.fn(), close: vi.fn() };
  const off = bindClassFill(labs, { mapEl, tool, popover });
  return { labs, mapEl, tool, popover, off };
}

describe('bindClassFill', () => {
  it('꺼진 채 시작하면 클래스 없음, 훅은 열지 않는다', () => {
    const { mapEl, tool, popover } = make();
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
    expect(typeof tool.onLegendColorClick).toBe('function');
    tool.onLegendColorClick({ layerId: 'L', classIndex: 0, anchor: {} });
    expect(popover.open).not.toHaveBeenCalled();
  });

  it('켜면 클래스가 붙고 훅이 팝오버를 연다', () => {
    const { labs, mapEl, tool, popover } = make();
    labs.set(CLASS_FILL_ID, true);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(true);
    const info = { layerId: 'L', classIndex: 2, anchor: {} };
    tool.onLegendColorClick(info);
    expect(popover.open).toHaveBeenCalledWith(info);
  });

  it('?lab= 으로 켜진 채 시작하면 바로 클래스가 붙는다', () => {
    const { mapEl } = make(`?lab=${CLASS_FILL_ID}`);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(true);
  });

  it('끄면 클래스가 빠지고 팝오버가 닫힌다, 다른 실험은 영향 없음', () => {
    const { labs, mapEl, popover } = make(`?lab=${CLASS_FILL_ID}`);
    labs.set('glass', true);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(true);
    labs.set(CLASS_FILL_ID, false);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
    expect(popover.close).toHaveBeenCalled();
  });

  it('해제하면 훅이 지워지고 클래스도 빠진다', () => {
    const { labs, mapEl, tool, off } = make(`?lab=${CLASS_FILL_ID}`);
    off();
    expect(tool.onLegendColorClick).toBeNull();
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
    labs.set(CLASS_FILL_ID, true);
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
  });

  it('mapEl 이 없어도 예외 없음', () => {
    const labs = new Labs();
    labs.init({ knownIds: [CLASS_FILL_ID] });
    expect(() => bindClassFill(labs, { mapEl: null, tool: {}, popover: { open() {}, close() {} } })).not.toThrow();
  });
});

describe('bindClassFill — 범례 끌기 뒤의 click 은 무시', () => {
  function domMap() {
    const mapEl = document.createElement('div');
    mapEl.id = 'map';
    mapEl.innerHTML = '<div class="choropleth-legend"><div class="choropleth-legend-items"><span class="choropleth-legend-color" data-class="0"></span></div></div>';
    document.body.appendChild(mapEl);
    return mapEl;
  }
  function pointer(type, target, x, y) {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }
  function setup() {
    const mapEl = domMap();
    const ctx = make(`?lab=${CLASS_FILL_ID}`, mapEl);
    const swatch = mapEl.querySelector('.choropleth-legend-color');
    const info = { layerId: 'L', classIndex: 0, anchor: swatch };
    return { ...ctx, swatch, info };
  }

  it('색 칸에서 3px 넘게 끌고 놓으면 열지 않는다', () => {
    const { tool, popover, swatch, info, off } = setup();
    pointer('pointerdown', swatch, 10, 10);
    pointer('pointerup', swatch, 40, 40);
    tool.onLegendColorClick(info);
    expect(popover.open).not.toHaveBeenCalled();
    off();
  });

  it('같은 자리에서 누르고 떼면 연다', () => {
    const { tool, popover, swatch, info, off } = setup();
    pointer('pointerdown', swatch, 10, 10);
    pointer('pointerup', swatch, 10, 10);
    tool.onLegendColorClick(info);
    expect(popover.open).toHaveBeenCalledWith(info);
    off();
  });

  it('문턱 안의 흔들림은 클릭으로 본다', () => {
    const { tool, popover, swatch, info, off } = setup();
    pointer('pointerdown', swatch, 10, 10);
    pointer('pointerup', swatch, 10 + DRAG_THRESHOLD_PX, 10);
    tool.onLegendColorClick(info);
    expect(popover.open).toHaveBeenCalledTimes(1);
    off();
  });

  it('끌기 한 번 무시한 뒤 다음 클릭은 다시 연다', () => {
    const { tool, popover, swatch, info, off } = setup();
    pointer('pointerdown', swatch, 10, 10);
    pointer('pointerup', swatch, 40, 40);
    tool.onLegendColorClick(info);
    pointer('pointerdown', swatch, 40, 40);
    pointer('pointerup', swatch, 40, 40);
    tool.onLegendColorClick(info);
    expect(popover.open).toHaveBeenCalledTimes(1);
    off();
  });

  it('범례 밖(지도)에서 시작한 끌기는 관계없다', () => {
    const { mapEl, tool, popover, swatch, info, off } = setup();
    pointer('pointerdown', mapEl, 10, 10);
    pointer('pointerup', swatch, 40, 40);
    tool.onLegendColorClick(info);
    expect(popover.open).toHaveBeenCalledTimes(1);
    off();
  });

  it('범례 끌기가 버블 단계에서 stopPropagation 해도 캡처로 듣는다', () => {
    const { mapEl, tool, popover, swatch, info, off } = setup();
    swatch.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
    pointer('pointerdown', swatch, 10, 10);
    pointer('pointerup', swatch, 40, 40);
    tool.onLegendColorClick(info);
    expect(popover.open).not.toHaveBeenCalled();
    off();
    // 해제 뒤에는 듣지 않는다 — 끌기를 흉내 내도 훅 자체가 없다
    expect(tool.onLegendColorClick).toBeNull();
    expect(mapEl.classList.contains(MAP_CLASS)).toBe(false);
  });

  it('해제하면 포인터 리스너도 떼어 낸다', () => {
    const { mapEl, off } = setup();
    const removeSpy = vi.spyOn(mapEl, 'removeEventListener');
    off();
    const types = removeSpy.mock.calls.map((c) => [c[0], c[2]]);
    expect(types).toContainEqual(['pointerdown', true]);
    expect(types).toContainEqual(['pointerup', true]);
  });
});
