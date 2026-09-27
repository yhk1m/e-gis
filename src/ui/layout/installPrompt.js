// © 2026 김용현
/**
 * 홈 화면(바탕화면)에 추가 — About e-GIS 메뉴 항목. 모든 기기에서 보인다(이미 앱으로 열었을 때만 숨김).
 * 추가한 아이콘으로 열면 주소창 없이 앱처럼 열린다(public/manifest.webmanifest 의 display: standalone).
 *
 * - 크롬·엣지(안드로이드·데스크톱): beforeinstallprompt 를 붙잡아 두었다가 누르면 설치 창을 띄운다.
 * - 그 밖(iPad·iPhone, Mac Safari, 설치 창이 안 오는 경우): 브라우저별 방법을 떠 있는 카드로 안내한다.
 * - 터치 기기는 "홈 화면에 추가", 데스크톱은 "바탕화면에 추가"라고 부른다.
 * 메뉴·서랍은 항목을 누르면 닫히므로, 안내 카드는 body 에 붙는다.
 */

/** 'ios' | 'android' | 'mac' | 'other' — iPadOS 는 기본이 데스크톱 모드라 Mac 인 척하므로 터치 여부로 가린다 */
export function detectPlatform(nav = navigator) {
  const ua = nav.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Mac OS X/.test(ua) || nav.platform === 'MacIntel') return 'mac';
  return 'other';
}

/** 'edge' | 'chrome' | 'firefox' | 'safari' | 'other' (순서 중요: 엣지·크롬 UA 에도 Safari 가 들어 있다) */
export function detectBrowser(nav = navigator) {
  const ua = nav.userAgent || '';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

const SHARE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';

/** 기기·브라우저별 안내. touch 면 "홈 화면", 아니면 "바탕화면" */
export function tipHtml(platform, browser, touch) {
  const where = touch ? '홈 화면' : '바탕화면';
  const head = `<strong>${where}에 추가하면 앱처럼 주소창 없이 열립니다</strong>`;
  let steps;
  if (platform === 'ios') {
    steps = [`주소창 옆 공유 버튼 <span class="install-tip-icon">${SHARE_ICON}</span> 을 누릅니다.`, '목록에서 <b>홈 화면에 추가</b>를 고릅니다.'];
  } else if (platform === 'android') {
    steps = ['브라우저 메뉴(⋮)를 엽니다.', '<b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 고릅니다.'];
  } else if (browser === 'edge') {
    steps = ['오른쪽 위 메뉴(…)를 엽니다.', '<b>앱</b> → <b>이 사이트를 앱으로 설치</b>를 고릅니다.', '설치 뒤 나오는 창에서 <b>바탕 화면에 고정</b>을 켭니다.'];
  } else if (browser === 'chrome') {
    steps = ['오른쪽 위 메뉴(⋮)를 엽니다.', '<b>전송, 저장, 공유</b> → <b>바로가기 만들기</b>를 고릅니다.', '<b>창으로 열기</b>를 켜고 <b>만들기</b>를 누릅니다.'];
  } else if (browser === 'safari') {
    steps = ['메뉴 막대의 <b>파일</b> → <b>Dock에 추가</b>를 고릅니다.'];
  } else {
    steps = ['이 브라우저는 앱 설치를 지원하지 않습니다.', '주소창 왼쪽 자물쇠 아이콘을 바탕화면으로 끌어다 놓으면 바로가기가 생깁니다.'];
  }
  return `${head}<ol>${steps.map((t) => `<li>${t}</li>`).join('')}</ol>`;
}

export function initInstallPrompt(root = document, win = window) {
  const btns = [...root.querySelectorAll('.install-btn')];
  if (!btns.length) return null;
  const standalone = win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true;
  if (standalone) return null; // 이미 추가한 아이콘으로 열었다

  const platform = detectPlatform(win.navigator);
  const browser = detectBrowser(win.navigator);
  const touch = win.matchMedia('(pointer: coarse)').matches;
  const label = touch ? '홈 화면에 추가' : '바탕화면에 추가';
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
    tip.setAttribute('aria-label', `${label}하는 방법`);
    tip.innerHTML = `${tipHtml(platform, browser, touch)}<button type="button" class="install-tip-close">확인</button>`;
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
    const text = btn.querySelector('.install-label');
    if (text) text.textContent = label;
    btn.title = `${label} — 앱처럼 주소창 없이 열기`;
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

  return { platform, browser, label, closeTip };
}
