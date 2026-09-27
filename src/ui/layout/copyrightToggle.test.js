// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach } from 'vitest';
import { initCopyrightToggle } from './copyrightToggle.js';

describe('copyrightToggle', () => {
  let t;
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="toolbar"><div class="toolbar-copyright-wrap">
        <button id="toolbar-copyright-btn" aria-expanded="false"></button>
        <span class="toolbar-copyright">ⓒ 2025</span>
      </div></div><div id="map"></div>`;
    t = initCopyrightToggle(document);
  });
  const wrap = () => document.querySelector('.toolbar-copyright-wrap');
  const btn = () => document.getElementById('toolbar-copyright-btn');

  it('ⓒ 를 누르면 열리고 다시 누르면 닫힌다', () => {
    btn().click();
    expect(wrap().classList.contains('is-open')).toBe(true);
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    btn().click();
    expect(wrap().classList.contains('is-open')).toBe(false);
    expect(btn().getAttribute('aria-expanded')).toBe('false');
  });

  it('바깥을 누르면 닫히고, 말풍선 글자를 눌러도 닫히지 않는다', () => {
    btn().click();
    document.querySelector('.toolbar-copyright').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(t.isOpen()).toBe(true);
    document.getElementById('map').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(t.isOpen()).toBe(false);
  });

  it('Esc 로 닫힌다', () => {
    btn().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(t.isOpen()).toBe(false);
  });

  it('버튼이 없으면 null', () => {
    document.body.innerHTML = '';
    expect(initCopyrightToggle(document)).toBeNull();
  });
});
