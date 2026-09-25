// © 2026 김용현
/**
 * 툴바 실험실 버튼의 배지 = 켜진 실험 수. 0이면 숨긴다.
 * 버튼 title 에도 수를 적어 마우스를 올리면 알 수 있게 한다.
 */
import { describe, it, expect } from 'vitest';
import { bindLabsButton, renderLabsBadge } from './labsButton.js';
import { Labs } from './labs.js';

function fakeButton() {
  const badge = { textContent: '', hidden: true };
  return {
    badge,
    title: '',
    querySelector: (sel) => (sel === '.labs-badge' ? badge : null)
  };
}

describe('renderLabsBadge', () => {
  it('0이면 숨기고 아니면 수를 보인다', () => {
    const btn = fakeButton();
    renderLabsBadge(btn, 0);
    expect(btn.badge.hidden).toBe(true);
    expect(btn.title).toBe('실험실 — 검증 중인 기능');
    renderLabsBadge(btn, 2);
    expect(btn.badge.hidden).toBe(false);
    expect(btn.badge.textContent).toBe('2');
    expect(btn.title).toBe('실험실 — 검증 중인 기능 (2개 켜짐)');
  });
});

describe('bindLabsButton', () => {
  it('초기 수를 그리고 변경을 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass', 'globe'], search: '?lab=glass' });
    const btn = fakeButton();
    const off = bindLabsButton(labs, btn);
    expect(btn.badge.textContent).toBe('1');
    labs.set('globe', true);
    expect(btn.badge.textContent).toBe('2');
    off();
    labs.set('globe', false);
    expect(btn.badge.textContent).toBe('2');
  });

  it('버튼이 없으면 아무 일도 하지 않는다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass'] });
    expect(() => bindLabsButton(labs, null)()).not.toThrow();
  });
});
