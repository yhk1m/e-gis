// © 2026 김용현
/**
 * 글래스 UI 는 documentElement 의 data-surface="glass" 속성 하나로 켜진다.
 * CSS(glass.css)가 그 속성만 보므로 JS 는 속성을 붙이고 떼는 것이 전부다.
 */
import { describe, it, expect } from 'vitest';
import { applyGlass, bindGlass, GLASS_ATTR } from './glass.js';
import { Labs } from './labs.js';

function fakeRoot() {
  const attrs = {};
  return {
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: (k) => { delete attrs[k]; },
    getAttribute: (k) => (k in attrs ? attrs[k] : null)
  };
}

describe('applyGlass', () => {
  it('켜면 data-surface="glass", 끄면 속성 제거', () => {
    const root = fakeRoot();
    applyGlass(true, root);
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');
    applyGlass(false, root);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();
  });
});

describe('bindGlass', () => {
  it('초기 상태를 바로 적용하고, 이후 glass 변경만 따른다', () => {
    const labs = new Labs();
    labs.init({ knownIds: ['glass', 'globe'], search: '?lab=glass' });
    const root = fakeRoot();
    const off = bindGlass(labs, root);
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');

    labs.set('globe', true);                 // 다른 실험은 영향 없음
    expect(root.getAttribute(GLASS_ATTR)).toBe('glass');

    labs.set('glass', false);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();

    off();
    labs.set('glass', true);
    expect(root.getAttribute(GLASS_ATTR)).toBeNull();   // 해제 뒤엔 안 따른다
  });
});
