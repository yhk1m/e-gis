// © 2026 김용현
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHistory } from './History.js';

function setup() {
  const state = { v: 0 };
  const h = createHistory({
    snapshot: () => ({ ...state }),
    restore: (s) => { state.v = s.v; },
    groupMs: 100,
  });
  h.reset();
  const change = (v) => { state.v = v; h.record(); };
  return { state, h, change };
}

describe('createHistory', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('바꾼 뒤 되돌리면 앞 상태, 다시 하면 바꾼 상태', () => {
    const { state, h, change } = setup();
    change(1);
    vi.advanceTimersByTime(200);
    change(2);
    expect(h.undo()).toBe(true);
    expect(state.v).toBe(1);
    expect(h.undo()).toBe(true);
    expect(state.v).toBe(0);
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(true);
    expect(state.v).toBe(1);
    expect(h.redo()).toBe(true);
    expect(state.v).toBe(2);
    expect(h.canRedo()).toBe(false);
  });

  it('잇단 변경은 한 번에 되돌린다', () => {
    const { state, h, change } = setup();
    change(1); vi.advanceTimersByTime(50);
    change(2); vi.advanceTimersByTime(50);
    change(3);
    h.undo();
    expect(state.v).toBe(0);
  });

  it('되돌린 뒤 새로 바꾸면 다시 하기 기록이 사라진다', () => {
    const { state, h, change } = setup();
    change(1); vi.advanceTimersByTime(200);
    h.undo();
    change(5);
    expect(h.canRedo()).toBe(false);
    h.undo();
    expect(state.v).toBe(0);
  });

  it('reset 전에는 기록하지 않고, reset하면 기록을 비운다', () => {
    const h = createHistory({ snapshot: () => 1, restore: () => {} });
    h.record();
    expect(h.canUndo()).toBe(false);
    h.reset();
    h.record();
    expect(h.canUndo()).toBe(true);
    h.reset();
    expect(h.canUndo()).toBe(false);
  });
});
