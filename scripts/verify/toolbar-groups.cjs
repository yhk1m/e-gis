// © 2026 김용현
/**
 * 툴바 묶음 펼치기 화면 검증 — 1024×768 태블릿(터치)·1600 데스크톱·390 휴대폰 서랍.
 * 실행: & "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/node_modules/.bin/electron.cmd" scripts/verify/toolbar-groups.cjs
 *   (vite preview 가 http://localhost:4173 에 떠 있어야 한다. EGIS_URL 로 바꿀 수 있다)
 * 결과: scripts/verify/out/toolbar-*.png 와 PASS/FAIL, 끝에 SUMMARY.
 */
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); app.exit(2); }, 200000);
process.on('unhandledRejection', (e) => console.error('UNHANDLED', e && e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
function check(name, ok, detail) {
  console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : `— ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  if (ok) passed++; else failed++;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1024, height: 768, useContentSize: true, show: true });
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
  // 툴바 부분만 — 아이콘 모양 확인용
  const captureToolbar = async (name) => {
    const r = await js(`document.getElementById('toolbar').getBoundingClientRect().toJSON()`);
    let png = Buffer.alloc(0);
    for (let i = 0; i < 5 && png.length === 0; i++) {
      win.focus(); await sleep(600);
      png = (await win.capturePage({ x: 0, y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) })).toPNG();
    }
    fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  };

  const load = async (device) => {
    await wc.loadURL(`${BASE}/`);
    if (device) {
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await dbg.sendCommand('Emulation.setDeviceMetricsOverride', device);
    } else {
      await dbg.sendCommand('Emulation.clearDeviceMetricsOverride');
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    await sleep(3500);
    const d = await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`);
    if (d) await sleep(800);
  };
  const click = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).click(); 0`).then(() => sleep(300));
  const visible = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
  const overflow = () => js(`(() => { const t = document.getElementById('toolbar'); return { sw: t.scrollWidth, cw: t.clientWidth }; })()`);
  const labsLabel = () => js(`(() => { const s = document.querySelector('#labs-toggle .btn-tool-label'); return s ? s.getBoundingClientRect().width : 0; })()`);
  const noActive = () => js(`!document.querySelector('#toolbar .btn-icon.active')`);

  await wc.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`);

  // ── 태블릿 1024×768 터치 ──────────────────────────────
  const TABLET = { width: 1024, height: 768, deviceScaleFactor: 1, mobile: true };
  await load(TABLET);
  let o = await overflow();
  check('T1 접힌 툴바가 태블릿 폭에 들어간다', o.sw <= o.cw + 1, o);
  check('T1 선택 머리만 보이고 합치기·자르기는 숨음',
    (await visible('[data-tool="select"]')) && !(await visible('#btn-merge-features')) && !(await visible('[data-tool="edit-split"]')));
  check('T1 그리기·측정은 머리만 보임',
    (await visible('[data-group-toggle="draw"]')) && !(await visible('[data-tool="draw-point"]'))
    && (await visible('[data-group-toggle="measure"]')) && !(await visible('[data-tool="measure-distance"]')));
  check('T1 실험실 글자 숨김', (await labsLabel()) === 0);
  await capture('toolbar-tablet-1-collapsed');
  await captureToolbar('toolbar-strip-collapsed');

  await click('[data-tool="select"]');
  check('T2 선택을 켜면 속성 보기·합치기·자르기가 펼쳐진다',
    (await visible('#btn-feature-info')) && (await visible('#btn-merge-features')) && (await visible('[data-tool="edit-split"]')));
  o = await overflow();
  check('T2 펼쳐도 태블릿 폭에 들어간다', o.sw <= o.cw + 1, o);
  await captureToolbar('toolbar-strip-select');
  await click('[data-tool="edit-split"]');
  check('T3 자르기로 넘어가도 선택 묶음은 펼친 채', await visible('#btn-merge-features'));
  await click('[data-tool="edit-split"]');
  check('T3 자르기를 끄면 접힌다', !(await visible('#btn-merge-features')));

  await click('[data-group-toggle="draw"]');
  const drawAll = await js(`['draw-point','draw-line','draw-polygon','draw-multipoint','draw-multiline','draw-multipolygon'].every(t => document.querySelector('[data-tool="'+t+'"]').getBoundingClientRect().width > 0)`);
  check('T4 그리기 머리를 누르면 점·선·면·멀티 여섯이 펼쳐진다', drawAll);
  o = await overflow();
  check('T4 펼쳐도 태블릿 폭에 들어간다', o.sw <= o.cw + 1, o);
  await capture('toolbar-tablet-2-draw');
  await captureToolbar('toolbar-strip-draw');
  await click('[data-tool="draw-polygon"]');
  check('T5 면 그리기가 켜진다', await js(`document.querySelector('[data-tool="draw-polygon"]').classList.contains('active')`));

  await click('[data-group-toggle="measure"]');
  check('T6 측정 머리를 누르면 그리기는 접히고 그리던 도구는 꺼진다',
    (await visible('[data-tool="measure-distance"]')) && !(await visible('[data-tool="draw-point"]')) && (await noActive()));
  await captureToolbar('toolbar-strip-measure');
  await click('[data-tool="measure-distance"]');
  await click('[data-group-toggle="measure"]');
  check('T7 측정 머리를 다시 누르면 접히고 측정 도구도 꺼진다', !(await visible('[data-tool="measure-area"]')) && (await noActive()));

  // ── 데스크톱 1600 ─────────────────────────────────────
  win.setContentSize(1600, 900);
  await load(null);
  check('D1 데스크톱도 접힌 상태로 시작', !(await visible('[data-tool="draw-point"]')) && (await visible('[data-group-toggle="draw"]')));
  check('D1 실험실 글자 숨김', (await labsLabel()) === 0);
  await click('[data-group-toggle="draw"]');
  await captureToolbar('toolbar-strip-desktop-draw');

  // ── 휴대폰 서랍 390 ───────────────────────────────────
  win.setContentSize(390, 844);
  await load({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await click('#mobile-menu-btn');
  await sleep(400);
  const drawer = await js(`(() => {
    const vis = (s) => { const e = document.querySelector('#mobile-drawer ' + s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return { draw: vis('[data-tool="draw-point"]'), measure: vis('[data-tool="measure-area"]'), merge: vis('#btn-merge-features'),
      head: vis('[data-group-toggle="draw"]'), labsLabel: vis('#labs-toggle .btn-tool-label') };
  })()`);
  check('M1 서랍에서는 묶음 없이 도구가 전부 보인다', drawer.draw && drawer.measure && drawer.merge, drawer);
  check('M1 서랍에서는 머리 버튼이 숨는다', !drawer.head, drawer);
  check('M1 서랍 실험실 타일에는 글자가 남는다', drawer.labsLabel, drawer);
  await capture('toolbar-phone-drawer');

  console.log(`SUMMARY ${passed} passed, ${failed} failed`);
  app.exit(failed ? 1 : 0);
}).catch((e) => { console.error('ERROR', e && e.stack || e); app.exit(1); });
