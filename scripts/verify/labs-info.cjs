// © 2026 김용현
/**
 * 실험실 창 자세히 보기(i) 화면 검증 — 데스크톱 1600×900, 휴대폰 390×844.
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
  const n = await js(`document.querySelectorAll('.labs-modal .labs-info').length`);
  check('카드 다섯 장 모두 i 버튼', n === 5, n);
  await capture('labs-info-1-closed');

  await click('.labs-info[data-id="time-series"]');
  const st = await js(`(() => {
    const d = document.getElementById('labs-detail-time-series');
    const r = d.getBoundingClientRect();
    const content = document.querySelector('.labs-content').getBoundingClientRect();
    return { shown: !d.hidden, heads: [...d.querySelectorAll('h4')].map(h => h.textContent), steps: d.querySelectorAll('ol li').length,
      visibleTop: r.top < innerHeight && r.bottom > 0, contentFits: content.bottom <= innerHeight + 1 && content.top >= -1,
      switchOff: document.querySelector('.labs-switch[data-id="time-series"]').getAttribute('aria-checked') === 'false' };
  })()`);
  check('시계열 안내가 펼쳐진다(소개·사용 방법·알아 두기)', st.shown && st.heads.join() === '소개,사용 방법,알아 두기' && st.steps === 6, st);
  check('펼친 안내가 화면 안에 보이고 창이 화면을 넘지 않는다', st.visibleTop && st.contentFits, st);
  check('i 를 눌러도 실험은 꺼진 그대로', st.switchOff, st);
  await capture('labs-info-2-time-series');

  await click('.labs-info[data-id="glass"]');
  const one = await js(`[...document.querySelectorAll('.labs-card-detail')].filter(d => !d.hidden).map(d => d.id)`);
  check('한 번에 하나만 펼쳐진다', one.length === 1 && one[0] === 'labs-detail-glass', one);
  await js(`document.querySelector('.labs-modal .modal-body').scrollTop = 0; 0`);
  await capture('labs-info-3-glass');

  // 다크 테마
  await js(`document.documentElement.setAttribute('data-theme', 'dark'); 0`);
  await capture('labs-info-4-dark');
  await js(`document.documentElement.setAttribute('data-theme', 'light'); 0`);

  // ── 휴대폰 ──
  win.setContentSize(390, 844);
  await load({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js(`document.getElementById('labs-toggle').click(); 0`);
  await sleep(500);
  await click('.labs-info[data-id="globe"]');
  const ph = await js(`(() => { const c = document.querySelector('.labs-content').getBoundingClientRect(); const b = document.querySelector('.labs-info[data-id="globe"]').getBoundingClientRect();
    return { w: c.width, fits: c.right <= innerWidth + 1 && c.left >= -1, noHScroll: document.documentElement.scrollWidth <= innerWidth, btn: b.width }; })()`);
  check('휴대폰에서 창이 화면 폭 안에 들어간다', ph.fits && ph.noHScroll, ph);
  check('휴대폰에서 i 버튼이 손가락 크기(36px)', ph.btn >= 36, ph);
  await capture('labs-info-5-phone');

  console.log(`SUMMARY ${passed} passed, ${failed} failed`);
  app.exit(failed ? 1 : 0);
}).catch((e) => { console.error('ERROR', e && e.stack || e); app.exit(1); });
