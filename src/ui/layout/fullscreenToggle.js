// © 2026 김용현
/**
 * 전체화면 버튼 — 페이지 전체(documentElement)를 전체화면으로.
 * iPad Safari·Android Chrome·데스크톱은 되고, iPhone 은 요소 전체화면을 막아 두어 버튼을 숨긴다.
 * 옛 iPad Safari(16.4 전)는 webkit 접두사만 있어 둘 다 본다.
 * 아이콘 모양은 CSS 가 .is-fullscreen 으로 바꾼다.
 */
export function fullscreenApi(doc = document) {
  const el = doc.documentElement || {};
  if (doc.fullscreenEnabled && el.requestFullscreen) {
    return {
      enabled: true,
      changeEvent: 'fullscreenchange',
      isActive: () => !!doc.fullscreenElement,
      request: () => el.requestFullscreen(),
      exit: () => doc.exitFullscreen(),
    };
  }
  if (doc.webkitFullscreenEnabled && el.webkitRequestFullscreen) {
    return {
      enabled: true,
      changeEvent: 'webkitfullscreenchange',
      isActive: () => !!doc.webkitFullscreenElement,
      request: () => el.webkitRequestFullscreen(),
      exit: () => doc.webkitExitFullscreen(),
    };
  }
  return { enabled: false };
}

export function initFullscreenToggle(root = document, doc = document) {
  const btn = root.getElementById ? root.getElementById('fullscreen-toggle') : root.querySelector('#fullscreen-toggle');
  if (!btn) return null;
  const api = fullscreenApi(doc);
  if (!api.enabled) return null;

  const sync = () => {
    const on = api.isActive();
    btn.classList.toggle('is-fullscreen', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? '전체화면 끝내기' : '전체화면';
  };

  btn.hidden = false;
  btn.addEventListener('click', () => {
    // 요청은 약속(Promise)을 돌려주거나(표준) 아무것도 안 돌려준다(webkit) — 거절은 조용히 넘긴다
    Promise.resolve(api.isActive() ? api.exit() : api.request()).catch(() => {}).finally(sync);
  });
  doc.addEventListener?.(api.changeEvent, sync);
  sync();

  return { sync };
}
