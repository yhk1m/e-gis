// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initFullscreenToggle, fullscreenApi } from './fullscreenToggle.js';

/** 표준 API 를 흉내 낸 가짜 문서 — jsdom 에는 Fullscreen API 가 없다 */
function fakeStandardDoc() {
  const listeners = {};
  const doc = {
    fullscreenEnabled: true,
    fullscreenElement: null,
    documentElement: { requestFullscreen: vi.fn(() => { doc.fullscreenElement = doc.documentElement; listeners.fullscreenchange?.(); return Promise.resolve(); }) },
    exitFullscreen: vi.fn(() => { doc.fullscreenElement = null; listeners.fullscreenchange?.(); return Promise.resolve(); }),
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  return doc;
}

describe('fullscreenApi', () => {
  it('표준 API 를 쓴다', () => {
    const api = fullscreenApi(fakeStandardDoc());
    expect(api.enabled).toBe(true);
    expect(api.changeEvent).toBe('fullscreenchange');
  });

  it('webkit 접두사만 있는 옛 iPad Safari 도 쓴다', () => {
    const el = { webkitRequestFullscreen: vi.fn() };
    const doc = { webkitFullscreenEnabled: true, webkitFullscreenElement: null, documentElement: el, webkitExitFullscreen: vi.fn() };
    const api = fullscreenApi(doc);
    expect(api.enabled).toBe(true);
    expect(api.changeEvent).toBe('webkitfullscreenchange');
    api.request();
    expect(el.webkitRequestFullscreen).toHaveBeenCalled();
  });

  it('지원하지 않으면(아이폰) enabled 가 false', () => {
    expect(fullscreenApi({ documentElement: {} }).enabled).toBe(false);
  });
});

describe('initFullscreenToggle', () => {
  let doc;
  const btn = () => document.getElementById('fullscreen-toggle');
  beforeEach(() => {
    document.body.innerHTML = `<button id="fullscreen-toggle" hidden aria-pressed="false"></button>`;
    doc = fakeStandardDoc();
  });

  it('지원하면 버튼을 보이고, 누르면 전체화면 → 다시 누르면 해제', () => {
    initFullscreenToggle(document, doc);
    expect(btn().hidden).toBe(false);
    btn().click();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalled();
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    expect(btn().classList.contains('is-fullscreen')).toBe(true);
    btn().click();
    expect(doc.exitFullscreen).toHaveBeenCalled();
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    expect(btn().classList.contains('is-fullscreen')).toBe(false);
  });

  it('지원하지 않으면 버튼을 숨긴 채 둔다', () => {
    expect(initFullscreenToggle(document, { documentElement: {} })).toBeNull();
    expect(btn().hidden).toBe(true);
  });

  it('버튼이 없으면 null', () => {
    document.body.innerHTML = '';
    expect(initFullscreenToggle(document, doc)).toBeNull();
  });
});
