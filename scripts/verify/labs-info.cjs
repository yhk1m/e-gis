// © 2026 김용현
/**
 * 실험실 사용 안내 창(i) 화면 검증 — 데스크톱 1600×900, 휴대폰 390×844.
 * 실행: & "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/node_modules/.bin/electron.cmd" scripts/verify/labs-info.cjs
 *   (vite preview 가 http://localhost:4173 에 떠 있어야 한다. EGIS_URL 로 바꿀 수 있다)
 * 결과: scripts/verify/out/labs-info-*.png 와 PASS/FAIL, 끝에 SUMMARY.
 */
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); app.exit(2); }, 150000);
process.on('unhandledRejection', (e) => console.error('UNHANDLED', e && e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
function check(name, ok, detail) {
  console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : `— ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  if (ok) passed++; else failed++;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 900, useContentSize: true, show: true });
  const wc = win.webContents;
  wc.on('will-prevent-unload', (e) => e.preventDefault());
  const js = (c) => wc.executeJavaScript(c);
  const dbg = wc.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');

  const capture = async (name) => {
    let png = Buffer.alloc(0);
    for (let i = 0; i < 5 && png.length === 0; i++) { win.focus(); await sleep(900); png = (await win.capturePage()).toPNG(); }
    fs.writeFileSync(path.join(OUT, `${name}.png`), png);
    console.log('captured', name, png.length);
  };
  const load = async (device) => {
    await wc.loadURL(`${BASE}/`);
    if (device) {
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await dbg.sendCommand('Emulation.setDeviceMetricsOverride', device);
    }
    await sleep(3500);
    if (await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`)) await sleep(800);
  };
  const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click(); 0`).then(() => sleep(500));

  await wc.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`);

  // ── 데스크톱 ──
  await load(null);
  await click('#labs-toggle');
  const heads = await js(`({ cardInfo: document.querySelectorAll('.labs-card .labs-info, .labs-card .labs-guide-btn').length, headerInfo: document.querySelectorAll('.labs-modal .modal-header #labs-guide-open').length })`);
  check('카드에는 i 가 없고 제목 옆에만 하나', heads.cardInfo === 0 && heads.headerInfo === 1, heads);
  await capture('labs-info-1-labs');

  await click('#labs-guide-open');
  const g = await js(`(() => { const c = document.querySelector('.labs-guide-content').getBoundingClientRect();
    return { open: !!document.querySelector('.labs-guide-modal'), tabs: [...document.querySelectorAll('.labs-guide-tab')].map(t => t.textContent.trim()),
      title: document.querySelector('.labs-guide-title').textContent, w: c.width, h: c.height, fits: c.bottom <= innerHeight + 1 && c.top >= -1,
      onTop: getComputedStyle(document.querySelector('.labs-guide-modal')).zIndex >= getComputedStyle(document.querySelector('.labs-modal')).zIndex }; })()`);
  check('i 를 누르면 안내 창이 뜨고 실험실이란? 부터 보인다', g.open && g.title === '실험실이란?' && g.tabs.length === 6, g);
  check('안내 창은 넓고 화면 높이를 넘지 않는다', g.w >= 800 && g.fits, g);
  await capture('labs-info-2-overview');

  await click('.labs-guide-tab[data-id="time-series"]');
  const ts = await js(`(() => { const b = document.querySelector('.labs-guide-body'); const c = document.querySelector('.labs-guide-content').getBoundingClientRect();
    return { title: b.querySelector('.labs-guide-title').textContent, heads: [...b.querySelectorAll('h4')].map(h => h.textContent), sameH: Math.round(c.height),
      scrolls: b.scrollHeight > b.clientHeight, pageNoScroll: document.documentElement.scrollHeight <= innerHeight }; })()`);
  check('시계열을 고르면 그 안내만 보이고 창 크기는 그대로', ts.title === '시계열 단계구분도' && ts.heads.join() === '소개,사용 방법,알아 두기' && ts.sameH === Math.round(g.h), ts);
  await capture('labs-info-3-time-series');

  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 0`);
  await sleep(300);
  const esc = await js(`({ guide: !!document.querySelector('.labs-guide-modal'), labs: !!document.querySelector('.labs-modal') })`);
  check('Esc 는 안내 창만 닫고 실험실 창은 남는다', !esc.guide && esc.labs, esc);

  await click('#labs-guide-open');
  await js(`document.documentElement.setAttribute('data-theme', 'dark'); 0`);
  await click('.labs-guide-tab[data-id="globe"]');
  await capture('labs-info-4-dark');
  await js(`document.documentElement.setAttribute('data-theme', 'light'); 0`);

  // ── 휴대폰 ──
  win.setContentSize(390, 844);
  await load({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js(`document.getElementById('labs-toggle').click(); 0`);
  await sleep(500);
  await click('#labs-guide-open');
  await click('.labs-guide-tab[data-id="swipe"]');
  const ph = await js(`(() => { const c = document.querySelector('.labs-guide-content').getBoundingClientRect(); const nav = document.querySelector('.labs-guide-nav').getBoundingClientRect();
    return { fits: c.right <= innerWidth + 1 && c.left >= -1 && c.bottom <= innerHeight + 1, noHScroll: document.documentElement.scrollWidth <= innerWidth,
      navOnTop: nav.width > nav.height, title: document.querySelector('.labs-guide-title').textContent }; })()`);
  check('휴대폰: 안내 창이 화면 안, 목록은 위쪽 가로 줄', ph.fits && ph.noHScroll && ph.navOnTop && ph.title === '스와이프 비교', ph);
  await capture('labs-info-5-phone');

  console.log(`SUMMARY ${passed} passed, ${failed} failed`);
  app.exit(failed ? 1 : 0);
}).catch((e) => { console.error('ERROR', e && e.stack || e); app.exit(1); });
