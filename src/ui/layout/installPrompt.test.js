// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initInstallPrompt, detectPlatform } from './installPrompt.js';

/** matchMedia·navigator 를 흉내 낸 가짜 창 */
function fakeWin({ coarse = true, standalone = false, ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/130', platform = 'Linux', touchPoints = 5 } = {}) {
  const listeners = {};
  return {
    matchMedia: (q) => ({ matches: q.includes('pointer: coarse') ? coarse : q.includes('display-mode') ? standalone : false }),
    navigator: { userAgent: ua, platform, maxTouchPoints: touchPoints, standalone: undefined },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    fire: (type, ev) => listeners[type]?.(ev),
  };
}

describe('detectPlatform', () => {
  it('아이폰·아이패드(데스크톱 모드로 Mac 인 척하는 것 포함)는 ios', () => {
    expect(detectPlatform({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 })).toBe('ios');
    expect(detectPlatform({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  });
  it('진짜 Mac 과 안드로이드는 ios 가 아니다', () => {
    expect(detectPlatform({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 })).toBe('other');
    expect(detectPlatform({ userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5 })).toBe('android');
  });
});

describe('initInstallPrompt', () => {
  const btn = () => document.getElementById('install-toggle');
  const drawerBtn = () => document.getElementById('install-drawer');
  const tip = () => document.querySelector('.install-tip');
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="menu-right install-anchor"><button id="install-toggle" class="install-btn" hidden aria-expanded="false"></button></div>
      <div class="drawer-row install-anchor"><button id="install-drawer" class="install-btn" hidden aria-expanded="false"></button></div>`;
  });

  it('태블릿·휴대폰(터치)에서만 버튼이 보인다 — 메뉴바·서랍 두 곳 모두', () => {
    initInstallPrompt(document, fakeWin({ coarse: true }));
    expect(btn().hidden).toBe(false);
    expect(drawerBtn().hidden).toBe(false);
  });

  it('서랍 버튼을 누르면 안내가 서랍 쪽에 붙는다', () => {
    initInstallPrompt(document, fakeWin({ ua: 'iPhone', platform: 'iPhone' }));
    drawerBtn().click();
    expect(tip().parentElement.classList.contains('drawer-row')).toBe(true);
    expect(drawerBtn().getAttribute('aria-expanded')).toBe('true');
  });

  it('데스크톱(마우스)이나 이미 홈 화면 앱으로 열었으면 숨긴다', () => {
    expect(initInstallPrompt(document, fakeWin({ coarse: false }))).toBeNull();
    expect(btn().hidden).toBe(true);
    expect(initInstallPrompt(document, fakeWin({ standalone: true }))).toBeNull();
    expect(btn().hidden).toBe(true);
  });

  it('안드로이드: 설치 이벤트가 오면 누를 때 설치 창을 띄운다', async () => {
    const win = fakeWin();
    initInstallPrompt(document, win);
    const ev = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    win.fire('beforeinstallprompt', ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    btn().click();
    expect(ev.prompt).toHaveBeenCalled();
    expect(tip()).toBeNull();
  });

  it('iPad·아이폰: 누르면 공유 → 홈 화면에 추가 안내가 뜨고, 다시 누르거나 Esc 로 닫힌다', () => {
    initInstallPrompt(document, fakeWin({ ua: 'Macintosh Safari', platform: 'MacIntel' }));
    btn().click();
    expect(tip()).not.toBeNull();
    expect(tip().textContent).toContain('홈 화면에 추가');
    expect(tip().textContent).toContain('공유');
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    btn().click();
    expect(tip()).toBeNull();
    btn().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tip()).toBeNull();
  });

  it('안드로이드인데 설치 이벤트가 없으면 브라우저 메뉴 안내', () => {
    initInstallPrompt(document, fakeWin());
    btn().click();
    expect(tip().textContent).toContain('메뉴');
  });

  it('설치가 끝나면 버튼을 숨긴다', () => {
    const win = fakeWin();
    initInstallPrompt(document, win);
    win.fire('appinstalled');
    expect(btn().hidden).toBe(true);
    expect(drawerBtn().hidden).toBe(true);
  });
});
