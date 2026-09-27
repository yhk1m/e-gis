// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initInstallPrompt, detectPlatform, detectBrowser, tipHtml } from './installPrompt.js';

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
    expect(detectPlatform({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 })).toBe('mac');
    expect(detectPlatform({ userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5 })).toBe('android');
  });
});

describe('detectBrowser·tipHtml', () => {
  it('엣지·크롬 UA 에 Safari 가 섞여 있어도 가린다', () => {
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 Edg/130' })).toBe('edge');
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36' })).toBe('chrome');
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 (Macintosh) Version/18 Safari/605' })).toBe('safari');
    expect(detectBrowser({ userAgent: 'Mozilla/5.0 Firefox/130' })).toBe('firefox');
  });
  it('데스크톱은 바탕화면, 브라우저별 방법', () => {
    expect(tipHtml('other', 'chrome', false)).toContain('바탕화면');
    expect(tipHtml('other', 'chrome', false)).toContain('바로가기 만들기');
    expect(tipHtml('other', 'edge', false)).toContain('앱으로 설치');
    expect(tipHtml('mac', 'safari', false)).toContain('Dock');
    expect(tipHtml('ios', 'safari', true)).toContain('홈 화면');
  });
});

describe('initInstallPrompt', () => {
  const btn = () => document.getElementById('install-app');
  const tip = () => document.querySelector('.install-tip');
  let menuClicks;
  beforeEach(() => {
    document.body.innerHTML = `<div class="dropdown-menu" id="menu-about"><button id="install-app" class="dropdown-item install-btn" hidden><span class="install-label">홈 화면에 추가</span></button></div>`;
    menuClicks = 0;
    document.getElementById('menu-about').addEventListener('click', () => { menuClicks++; });
  });

  it('터치 기기는 "홈 화면에 추가"로 보인다', () => {
    initInstallPrompt(document, fakeWin({ coarse: true }));
    expect(btn().hidden).toBe(false);
    expect(btn().textContent).toContain('홈 화면에 추가');
  });

  it('데스크톱도 보이고 "바탕화면에 추가"라고 부른다', () => {
    initInstallPrompt(document, fakeWin({ coarse: false, ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36', platform: 'Win32', touchPoints: 0 }));
    expect(btn().hidden).toBe(false);
    expect(btn().textContent).toContain('바탕화면에 추가');
    btn().click();
    expect(tip().textContent).toContain('바로가기 만들기');
  });

  it('이미 추가한 아이콘(앱)으로 열었으면 숨긴다', () => {
    expect(initInstallPrompt(document, fakeWin({ standalone: true }))).toBeNull();
    expect(btn().hidden).toBe(true);
  });

  it('안드로이드: 설치 이벤트가 오면 누를 때 설치 창을 띄운다', () => {
    const win = fakeWin();
    initInstallPrompt(document, win);
    const ev = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) };
    win.fire('beforeinstallprompt', ev);
    expect(ev.preventDefault).toHaveBeenCalled();
    btn().click();
    expect(ev.prompt).toHaveBeenCalled();
    expect(tip()).toBeNull();
  });

  it('iPad·아이폰: 누르면 공유 → 홈 화면에 추가 안내 카드가 body 에 뜨고, 확인·Esc 로 닫힌다', () => {
    initInstallPrompt(document, fakeWin({ ua: 'Macintosh Safari', platform: 'MacIntel' }));
    btn().click();
    expect(tip()).not.toBeNull();
    expect(tip().parentElement).toBe(document.body);
    expect(tip().textContent).toContain('홈 화면에 추가');
    expect(tip().textContent).toContain('공유');
    tip().querySelector('.install-tip-close').click();
    expect(tip()).toBeNull();
    btn().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tip()).toBeNull();
  });

  it('메뉴 클릭 전파를 막지 않는다 — 메뉴·서랍이 평소처럼 닫혀야 한다', () => {
    initInstallPrompt(document, fakeWin({ ua: 'iPhone', platform: 'iPhone' }));
    btn().click();
    expect(menuClicks).toBe(1);
  });

  it('안드로이드인데 설치 이벤트가 없으면 브라우저 메뉴 안내', () => {
    initInstallPrompt(document, fakeWin());
    btn().click();
    expect(tip().textContent).toContain('메뉴');
  });

  it('설치가 끝나면 항목을 숨긴다', () => {
    const win = fakeWin();
    initInstallPrompt(document, win);
    win.fire('appinstalled');
    expect(btn().hidden).toBe(true);
  });
});
