// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initToolbarGroups, groupOfTool } from './toolbarGroups.js';

function dom() {
  document.body.innerHTML = `
    <div id="toolbar">
      <div class="toolbar-group" data-group="select" data-collapsible>
        <button data-tool="select"></button>
        <button class="toolbar-sub" id="btn-merge-features"></button>
        <button class="toolbar-sub" data-tool="edit-split"></button>
      </div>
      <div class="toolbar-group" data-group="draw" data-collapsible>
        <button data-group-toggle="draw" aria-expanded="false"></button>
        <button class="toolbar-sub" data-tool="draw-point"></button>
      </div>
      <div class="toolbar-group" data-group="measure" data-collapsible>
        <button data-group-toggle="measure" aria-expanded="false"></button>
        <button class="toolbar-sub" data-tool="measure-distance"></button>
      </div>
    </div>`;
}

describe('groupOfTool', () => {
  it('도구를 묶음에 대응시킨다', () => {
    expect(groupOfTool('select')).toBe('select');
    expect(groupOfTool('edit-split')).toBe('select');
    expect(groupOfTool('draw-multipolygon')).toBe('draw');
    expect(groupOfTool('measure-area')).toBe('measure');
    expect(groupOfTool('zoom-in')).toBeNull();
    expect(groupOfTool(null)).toBeNull();
  });
});

describe('toolbarGroups', () => {
  let current, groups, deactivate;
  const q = (s) => document.querySelector(s);
  const open = (name) => q(`.toolbar-group[data-group="${name}"]`).classList.contains('is-open');

  beforeEach(() => {
    dom();
    current = null;
    deactivate = vi.fn(() => { current = null; groups.sync(null); });
    groups = initToolbarGroups({ toolbar: q('#toolbar'), getCurrentTool: () => current, deactivateCurrentTool: deactivate });
  });

  it('처음에는 모든 묶음이 접혀 있다', () => {
    expect(open('select')).toBe(false);
    expect(open('draw')).toBe(false);
    expect(open('measure')).toBe(false);
  });

  it('선택·자르기가 켜지면 선택 묶음이 펼쳐지고 꺼지면 접힌다', () => {
    current = 'select'; groups.sync('select');
    expect(open('select')).toBe(true);
    current = 'edit-split'; groups.sync('edit-split');
    expect(open('select')).toBe(true);
    current = null; groups.sync(null);
    expect(open('select')).toBe(false);
  });

  it('머리 버튼으로 그리기 묶음을 펼치고 접는다', () => {
    q('[data-group-toggle="draw"]').click();
    expect(open('draw')).toBe(true);
    expect(q('[data-group-toggle="draw"]').getAttribute('aria-expanded')).toBe('true');
    q('[data-group-toggle="draw"]').click();
    expect(open('draw')).toBe(false);
    expect(deactivate).not.toHaveBeenCalled();
  });

  it('그리기와 측정은 하나만 펼치고, 접히는 묶음의 도구는 끈다', () => {
    q('[data-group-toggle="draw"]').click();
    current = 'draw-point'; groups.sync('draw-point');
    q('[data-group-toggle="measure"]').click();
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(open('draw')).toBe(false);
    expect(open('measure')).toBe(true);
  });

  it('그리기 도구를 켠 채 묶음을 접으면 도구도 꺼진다', () => {
    q('[data-group-toggle="draw"]').click();
    current = 'draw-point'; groups.sync('draw-point');
    q('[data-group-toggle="draw"]').click();
    expect(deactivate).toHaveBeenCalledTimes(1);
    expect(open('draw')).toBe(false);
  });

  it('도구를 끄기만 하면 그리기 묶음은 펼친 채 남고, 선택 도구를 켜면 접힌다', () => {
    q('[data-group-toggle="draw"]').click();
    current = 'draw-point'; groups.sync('draw-point');
    current = null; groups.sync(null);
    expect(open('draw')).toBe(true);
    current = 'select'; groups.sync('select');
    expect(open('draw')).toBe(false);
    expect(open('select')).toBe(true);
  });
});
