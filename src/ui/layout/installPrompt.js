// © 2026 김용현
/**
 * 홈 화면에 추가 버튼 — 태블릿·휴대폰(터치)에서만 보인다. 홈 화면 앱으로 열면 주소창 없이 꽉 찬 화면이 된다
 * (public/manifest.webmanifest 의 display: standalone).
 *
 * - 안드로이드 크롬 등: beforeinstallprompt 를 붙잡아 두었다가 버튼을 누르면 설치 창을 띄운다.
 * - iPad·iPhone: 애플이 설치 API 를 주지 않아 "공유 → 홈 화면에 추가" 안내 말풍선을 띄운다.
 * - 이미 홈 화면 앱으로 열었으면(display-mode: standalone) 숨긴다.
 * 버튼(.install-btn)은 About e-GIS 메뉴의 항목 — 휴대폰에서는 그 메뉴가 서랍 안에 있다.
 * 메뉴·서랍은 항목을 누르면 닫히므로, 안내는 body 에 붙는 떠 있는 카드로 띄운다.
 */

/** 'ios' | 'android' | 'other' — iPadOS 는 기본이 데스크톱 모드라 Mac 인 척하므로 터치 여부로 가린다 */
export function detectPlatform(nav = navigator) {
  const ua = nav.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

const SHARE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';

function tipHtml(platform) {
  if (platform === 'ios') {
    return `<strong>홈 화면에 추가하면 앱처럼 꽉 찬 화면으로 열립니다</strong>
      <ol>
        <li>주소창 옆 공유 버튼 <span class="install-tip-icon">${SHARE_ICON}</span> 을 누릅니다.</li>
        <li>목록에서 <b>홈 화면에 추가</b>를 고릅니다.</li>
      </ol>`;
  }
  return `<strong>홈 화면에 추가하면 앱처럼 꽉 찬 화면으로 열립니다</strong>
    <ol>
      <li>브라우저 메뉴(⋮)를 엽니다.</li>
      <li><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 고릅니다.</li>
    </ol>`;
}

export function initInstallPrompt(root = document, win = window) {
  const btns = [...root.querySelectorAll('.install-btn')];
  if (!btns.length) return null;
  const standalone = win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true;
  if (standalone || !win.matchMedia('(pointer: coarse)').matches) return null;

  const platform = detectPlatform(win.navigator);
  let deferred = null;
  let tip = null;

  const closeTip = () => {
    tip?.remove();
    tip = null;
  };
  const openTip = () => {
    closeTip();
    tip = document.createElement('div');
    tip.className = 'install-tip';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', '홈 화면에 추가하는 방법');
    tip.innerHTML = `${tipHtml(platform)}<button type="button" class="install-tip-close">확인</button>`;
    tip.querySelector('.install-tip-close').addEventListener('click', closeTip);
    document.body.appendChild(tip);
  };

  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
  });
  win.addEventListener('appinstalled', () => {
    closeTip();
    btns.forEach((b) => { b.hidden = true; });
  });

  btns.forEach((btn) => {
    btn.hidden = false;
    // 전파는 막지 않는다 — 메뉴·서랍이 평소처럼 닫혀야 한다
    btn.addEventListener('click', () => {
      if (deferred) {
        const ev = deferred;
        deferred = null; // 설치 창은 한 번만 띄울 수 있다
        ev.prompt();
        Promise.resolve(ev.userChoice).catch(() => {});
        return;
      }
      openTip();
    });
  });
  document.addEventListener('pointerdown', (e) => {
    if (tip && !tip.contains(e.target)) closeTip();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tip) closeTip();
  });

  return { platform, closeTip };
}
