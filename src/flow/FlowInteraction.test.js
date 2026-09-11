// © 2026 김용현
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { FlowInteraction, formatFlowTip } from './FlowInteraction.js';

function fakeMap({ size = [800, 600] } = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const listeners = {};
  const viewportListeners = {};
  const viewport = {
    addEventListener: vi.fn((type, fn) => { (viewportListeners[type] ||= []).push(fn); }),
    removeEventListener: vi.fn((type, fn) => {
      viewportListeners[type] = (viewportListeners[type] || []).filter((f) => f !== fn);
    })
  };
  return {
    target,
    listeners,
    viewportListeners,
    getTargetElement: () => target,
    getViewport: () => viewport,
    getSize: () => size,
    on: vi.fn((type, fn) => { (listeners[type] ||= []).push(fn); }),
    un: vi.fn((type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); }),
    fire: (type, evt) => (listeners[type] || []).forEach((fn) => fn(evt)),
    fireViewport: (type, evt) => (viewportListeners[type] || []).forEach((fn) => fn(evt))
  };
}

function fakeRenderer(hits = {}) {
  return {
    dataset: { meta: { unit: '명' } },
    hitTest: vi.fn((pixel) => hits[pixel.join(',')] || null),
    setHover: vi.fn(),
    setHighlight: vi.fn(),
    getLocation: (id) => ({ a: { id: 'a', name: '서울<b>' }, b: { id: 'b', name: '부산' } }[id] || null)
  };
}

const locHit = { type: 'location', key: 'l:0', location: { id: 'a', name: '서울<b>' }, totals: { inflow: 1234.4, outflow: 10, net: 1224.4 } };
const flowHit = { type: 'flow', key: 'f:0', flow: { origin: 'a', dest: 'b', count: 99.6 } };

describe('formatFlowTip', () => {
  it('escapes names, groups numbers ko-KR, signs net, appends unit', () => {
    const r = fakeRenderer();
    expect(formatFlowTip(locHit, r, '명')).toBe(
      '<b>서울&lt;b&gt;</b>  유입 1,234 · 유출 10 · 순이동 +1,224명'
    );
    expect(formatFlowTip(flowHit, r, '명')).toBe('<b>서울&lt;b&gt; → 부산</b>  100명');
    expect(formatFlowTip({ ...locHit, totals: { inflow: 0, outflow: 5, net: -5 } }, r)).toContain('순이동 -5');
  });
});

describe('FlowInteraction — hover', () => {
  it('shows tooltip at evt.pixel; topmost renderer wins and short-circuits lower hitTest; cursor tracks hover transitions', () => {
    const map = fakeMap();
    const below = fakeRenderer({ '10,20': flowHit });
    const top = fakeRenderer({ '10,20': locHit });
    const fi = new FlowInteraction({ map, getRenderers: () => [below, top] });
    fi.attach();
    const tip = map.target.querySelector('.flow-tooltip');
    expect(tip.hidden).toBe(true);

    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    expect(tip.hidden).toBe(false);
    expect(tip.style.left).toBe('10px');
    expect(tip.style.top).toBe('20px');
    expect(tip.innerHTML).toContain('서울');
    expect(top.setHover).toHaveBeenCalledWith('l:0');
    expect(below.setHover).toHaveBeenCalledWith(null);
    expect(below.hitTest).not.toHaveBeenCalled(); // 위에서부터 찾다가 top 에서 멈춘다
    expect(map.target.style.cursor).toBe('pointer');

    map.fire('pointermove', { pixel: [10, 20], dragging: false }); // 계속 같은 자리
    expect(map.target.style.cursor).toBe('pointer');

    map.fire('pointermove', { pixel: [0, 0], dragging: false }); // 빗나감
    expect(tip.hidden).toBe(true);
    expect(map.target.style.cursor).toBe('');

    map.fire('pointermove', { pixel: [0, 0], dragging: false }); // 계속 빗나감
    expect(map.target.style.cursor).toBe('');
  });

  it('hides the tooltip while dragging without touching hover state', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const fi = new FlowInteraction({ map, getRenderers: () => [r] });
    fi.attach();
    const tip = map.target.querySelector('.flow-tooltip');
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    expect(tip.hidden).toBe(false);
    map.fire('pointermove', { pixel: [10, 20], dragging: true });
    expect(tip.hidden).toBe(true);
  });

  it('calls getRenderers exactly once per pointermove/click event', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const getRenderers = vi.fn(() => [r]);
    const fi = new FlowInteraction({ map, getRenderers });
    fi.attach();
    getRenderers.mockClear();
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    expect(getRenderers).toHaveBeenCalledTimes(1);
    getRenderers.mockClear();
    map.fire('click', { pixel: [10, 20] });
    expect(getRenderers).toHaveBeenCalledTimes(1);
  });
});

describe('FlowInteraction — tooltip edge flip', () => {
  it('flips left near the right edge and up near the bottom edge (and both in a corner)', () => {
    const map = fakeMap({ size: [200, 150] });
    const r = fakeRenderer({
      '190,10': locHit,
      '10,140': locHit,
      '190,140': locHit,
      '10,10': locHit
    });
    const fi = new FlowInteraction({ map, getRenderers: () => [r] });
    fi.attach();
    const tip = map.target.querySelector('.flow-tooltip');
    Object.defineProperty(tip, 'offsetWidth', { configurable: true, value: 60 });
    Object.defineProperty(tip, 'offsetHeight', { configurable: true, value: 20 });

    map.fire('pointermove', { pixel: [190, 10], dragging: false }); // 오른쪽 가장자리 근처
    expect(tip.classList.contains('flow-tooltip--left')).toBe(true);
    expect(tip.classList.contains('flow-tooltip--up')).toBe(false);

    map.fire('pointermove', { pixel: [10, 140], dragging: false }); // 아래쪽 가장자리 근처
    expect(tip.classList.contains('flow-tooltip--left')).toBe(false);
    expect(tip.classList.contains('flow-tooltip--up')).toBe(true);

    map.fire('pointermove', { pixel: [190, 140], dragging: false }); // 모서리 — 둘 다
    expect(tip.classList.contains('flow-tooltip--left')).toBe(true);
    expect(tip.classList.contains('flow-tooltip--up')).toBe(true);

    map.fire('pointermove', { pixel: [10, 10], dragging: false }); // 가장자리에서 멀어지면 클래스가 빠진다
    expect(tip.classList.contains('flow-tooltip--left')).toBe(false);
    expect(tip.classList.contains('flow-tooltip--up')).toBe(false);
  });
});

describe('FlowInteraction — isBlocked (다른 도구 활성)', () => {
  it('clears hover/tooltip on move but never clobbers a cursor it never set itself', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const fi = new FlowInteraction({ map, getRenderers: () => [r], isBlocked: () => true });
    fi.attach();
    map.target.style.cursor = 'crosshair'; // 다른 도구가 이미 지정해 둔 커서

    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    expect(r.setHover).toHaveBeenCalledWith(null);
    expect(map.target.querySelector('.flow-tooltip').hidden).toBe(true);
    expect(map.target.style.cursor).toBe('crosshair'); // 보존됨 — 리뷰 이전 버그였던 부분
  });

  it('resets a cursor it did set for itself once blocking begins mid-hover', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    let blocked = false;
    const fi = new FlowInteraction({ map, getRenderers: () => [r], isBlocked: () => blocked });
    fi.attach();
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    expect(map.target.style.cursor).toBe('pointer');

    blocked = true;
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    expect(map.target.style.cursor).toBe('');
    expect(r.setHover).toHaveBeenCalledWith(null);
  });

  it('ignores clicks entirely while blocked', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const onSel = vi.fn();
    const fi = new FlowInteraction({ map, getRenderers: () => [r], onSelectionChange: onSel, isBlocked: () => true });
    fi.attach();
    map.fire('click', { pixel: [10, 20] });
    expect(r.setHighlight).not.toHaveBeenCalled();
    expect(onSel).not.toHaveBeenCalled();
  });
});

describe('FlowInteraction — click 선택 필터', () => {
  it('toggles a location per renderer and reports via onSelectionChange', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit, '30,30': flowHit });
    const onSel = vi.fn();
    const fi = new FlowInteraction({ map, getRenderers: () => [r], onSelectionChange: onSel });
    fi.attach();

    map.fire('click', { pixel: [10, 20] });
    expect(r.setHighlight).toHaveBeenLastCalledWith(['a']);
    expect(onSel).toHaveBeenLastCalledWith(r, ['a']);

    map.fire('click', { pixel: [10, 20] }); // 다시 누르면 해제
    expect(r.setHighlight).toHaveBeenLastCalledWith([]);
    expect(fi.selected.size).toBe(0);
  });

  it('clicking a flow shows the tooltip (touch tap) but does not toggle any selection', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit, '30,30': flowHit });
    const onSel = vi.fn();
    const fi = new FlowInteraction({ map, getRenderers: () => [r], onSelectionChange: onSel });
    fi.attach();
    const tip = map.target.querySelector('.flow-tooltip');

    map.fire('click', { pixel: [10, 20] }); // 위치 먼저 선택
    expect(r.setHighlight).toHaveBeenCalledTimes(1);
    onSel.mockClear();

    map.fire('click', { pixel: [30, 30] }); // 흐름 탭
    expect(r.setHighlight).toHaveBeenCalledTimes(1); // 선택은 그대로
    expect(onSel).not.toHaveBeenCalled();
    expect(fi.selected.get(r)).toEqual(new Set(['a']));
    expect(tip.hidden).toBe(false);
    expect(tip.innerHTML).toContain('부산');
  });

  it('clicking empty space clears every renderer’s selection and hides the tooltip', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit, '30,30': flowHit });
    const onSel = vi.fn();
    const fi = new FlowInteraction({ map, getRenderers: () => [r], onSelectionChange: onSel });
    fi.attach();
    map.fire('click', { pixel: [10, 20] });
    map.fire('click', { pixel: [30, 30] }); // 툴팁을 띄워 둔 상태
    onSel.mockClear();

    map.fire('click', { pixel: [0, 0] }); // 빈 곳
    expect(onSel).toHaveBeenLastCalledWith(r, []);
    expect(fi.selected.size).toBe(0);
    expect(map.target.querySelector('.flow-tooltip').hidden).toBe(true);
  });
});

describe('FlowInteraction — lifecycle', () => {
  it('detach before attach does not throw', () => {
    const map = fakeMap();
    const r = fakeRenderer();
    const fi = new FlowInteraction({ map, getRenderers: () => [r] });
    expect(() => fi.detach()).not.toThrow();
  });

  it('attaching twice does not leak a second tooltip node', () => {
    const map = fakeMap();
    const fi = new FlowInteraction({ map, getRenderers: () => [] });
    fi.attach();
    fi.attach();
    expect(map.target.querySelectorAll('.flow-tooltip').length).toBe(1);
  });

  it('detach clears hover on every renderer, resets the cursor and removes listeners', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const fi = new FlowInteraction({ map, getRenderers: () => [r] });
    fi.attach();
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    r.setHover.mockClear();

    fi.detach();
    expect(r.setHover).toHaveBeenCalledWith(null);
    expect(map.target.style.cursor).toBe('');
    expect(map.target.querySelector('.flow-tooltip')).toBeNull();
    expect(map.listeners.pointermove.length).toBe(0);
    expect(map.listeners.click.length).toBe(0);
    expect(map.viewportListeners.pointerleave.length).toBe(0);
  });

  it('pointer leaving the map viewport clears hover just like isBlocked', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const fi = new FlowInteraction({ map, getRenderers: () => [r] });
    fi.attach();
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    r.setHover.mockClear();

    map.fireViewport('pointerleave', {});
    expect(r.setHover).toHaveBeenCalledWith(null);
    expect(map.target.querySelector('.flow-tooltip').hidden).toBe(true);
    expect(map.target.style.cursor).toBe('');
  });

  it('clearHover() clears hover/tooltip but leaves selection untouched (used before export capture)', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const fi = new FlowInteraction({ map, getRenderers: () => [r] });
    fi.attach();
    map.fire('click', { pixel: [10, 20] }); // 선택 상태를 만든다
    map.fire('pointermove', { pixel: [10, 20], dragging: false });
    const tip = map.target.querySelector('.flow-tooltip');
    expect(tip.hidden).toBe(false);
    r.setHover.mockClear();

    fi.clearHover();
    expect(r.setHover).toHaveBeenCalledWith(null);
    expect(tip.hidden).toBe(true);
    expect(fi.selected.has(r)).toBe(true); // 선택은 그대로
  });

  it('forget() drops a renderer’s selection so a later empty click no longer reports it', () => {
    const map = fakeMap();
    const r = fakeRenderer({ '10,20': locHit });
    const onSel = vi.fn();
    const fi = new FlowInteraction({ map, getRenderers: () => [r], onSelectionChange: onSel });
    fi.attach();
    map.fire('click', { pixel: [10, 20] });
    expect(fi.selected.has(r)).toBe(true);

    fi.forget(r);
    expect(fi.selected.has(r)).toBe(false);

    map.fire('click', { pixel: [0, 0] }); // 빈 곳 — 잊혀진 렌더러라 콜백이 추가로 나오지 않는다
    expect(onSel).toHaveBeenCalledTimes(1);
  });
});
