// © 2026 김용현
/**
 * data-lab="<id>" 가 붙은 메뉴 항목은 그 실험이 켜졌을 때만 보인다.
 * 켜고 끄면 바로 반영된다(새로고침 불필요).
 */
import { describe, it, expect } from 'vitest';
import { bindLabMenuItems } from './labMenu.js';
import { Labs } from './labs.js';

function fakeItem(id) {
  return { dataset: { lab: id }, hidden: true };
}

describe('bindLabMenuItems', () => {
  it('초기 상태를 적용하고 변경을 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['time-series', 'globe'], search: '?lab=globe' });
    const ts = fakeItem('time-series');
    const globe = fakeItem('globe');
    const off = bindLabMenuItems(labs, [ts, globe]);
    expect(ts.hidden).toBe(true);
    expect(globe.hidden).toBe(false);

    labs.set('time-series', true);
    expect(ts.hidden).toBe(false);
    labs.set('time-series', false);
    expect(ts.hidden).toBe(true);

    off();
    labs.set('time-series', true);
    expect(ts.hidden).toBe(true);   // 해제 뒤엔 안 따른다
  });

  it('모르는 id 항목은 항상 숨긴다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['globe'] });
    const item = fakeItem('retired');
    bindLabMenuItems(labs, [item]);
    expect(item.hidden).toBe(true);
  });
});
