// © 2026 김용현
/**
 * 글래스 축척바 화면 검증 — 유리 배경과 드래그 이동 범위(왼쪽 패널·툴바·상태줄 밑으로 못 들어감).
 * 실행: & "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/node_modules/.bin/electron.cmd" scripts/verify/scale-bar-glass.cjs
 *   (vite preview 가 http://localhost:4173 에 떠 있어야 한다. EGIS_URL 로 바꿀 수 있다)
 * 결과: scripts/verify/out/scalebar-*.png 와 PASS/FAIL, 끝에 SUMMARY.
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
  const rect = (sel) => js(`document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().toJSON()`);
  const mouse = (type, x, y) => dbg.sendCommand('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  /** 축척바를 잡아 (tx, ty) 까지 끈다 — setPointerCapture 가 없어 CDP 마우스로 충분 */
  const dragTo = async (tx, ty) => {
    const r = await rect('.map-scale-bar');
    const sx = r.x + r.width / 2, sy = r.y + r.height / 2;
    await dbg.sendCommand('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx, y: sy });
    await mouse('mousePressed', sx, sy);
    for (let i = 1; i <= 8; i++) await mouse('mouseMoved', sx + (tx - sx) * i / 8, sy + (ty - sy) * i / 8);
    await mouse('mouseReleased', tx, ty);
    await sleep(200);
    return rect('.map-scale-bar');
  };

  await wc.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.setItem('eGIS_labs', JSON.stringify({ glass: true }))`);
  await wc.loadURL(`${BASE}/`);
  await sleep(4000);
  if (await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`)) await sleep(800);

  check('글래스가 켜졌다', await js(`document.documentElement.dataset.surface === 'glass'`));
  const style = await js(`(() => { const s = getComputedStyle(document.querySelector('.map-scale-bar'));
    return { bg: s.backgroundColor, blur: s.backdropFilter, fill: getComputedStyle(document.querySelector('.map-scale-bar-fill')).backgroundColor, color: s.color }; })()`);
  const alpha = (() => { const m = style.bg.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(',').map(Number) : []; return p.length === 4 ? p[3] : 1; })();
  check('축척바 배경이 반투명 유리', alpha <= 0.6 && /blur/.test(style.blur), style);
  check('눈금 막대는 글자색', style.fill === style.color, style);
  await capture('scalebar-1-glass-light');

  const panel = await rect('#left-panel');
  const toolbar = await rect('#toolbar');
  const status = await rect('#statusbar');

  let r = await dragTo(5, 5);
  check('왼쪽 위로 끌어도 왼쪽 패널·툴바 밑으로 안 들어간다', r.x >= panel.right - 1 && r.y >= toolbar.bottom - 1, { r: [r.x, r.y], panelRight: panel.right, toolbarBottom: toolbar.bottom });
  await capture('scalebar-2-dragged-topleft');
  r = await dragTo(5, 895);
  check('왼쪽 아래로 끌어도 상태줄 밑으로 안 들어간다', r.x >= panel.right - 1 && r.bottom <= status.top + 1, { r: [r.x, r.bottom], statusTop: status.top });
  r = await dragTo(1595, 895);
  check('오른쪽 아래 끝까지는 간다', r.right >= 1590 && r.bottom <= status.top + 1, { right: r.right, bottom: r.bottom });
  r = await dragTo(900, 450);
  check('가운데로 자유롭게 옮겨진다', Math.abs(r.x + r.width / 2 - 900) < 3 && Math.abs(r.y + r.height / 2 - 450) < 3, [r.x, r.y]);

  // 다크 테마 유리
  await js(`document.documentElement.setAttribute('data-theme', 'dark'); 0`);
  await sleep(300);
  const dark = await js(`getComputedStyle(document.querySelector('.map-scale-bar-fill')).backgroundColor`);
  check('다크 유리에선 눈금이 흰색', dark === 'rgb(255, 255, 255)', dark);
  await capture('scalebar-3-glass-dark');
  await js(`document.documentElement.setAttribute('data-theme', 'light'); 0`);

  // 글래스를 끄면 예전처럼 지도 칸 안에서만 움직이고 흰 배경
  await js(`localStorage.setItem('eGIS_labs', JSON.stringify({}))`);
  await wc.loadURL(`${BASE}/`);
  await sleep(4000);
  if (await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`)) await sleep(800);
  const plainBg = await js(`getComputedStyle(document.querySelector('.map-scale-bar')).backgroundColor`);
  check('글래스 꺼지면 원래 흰 배경', plainBg === 'rgba(255, 255, 255, 0.85)', plainBg);
  const map = await rect('#map');
  r = await dragTo(5, 5);
  check('글래스 꺼지면 지도 칸 왼쪽 위 모서리까지', Math.abs(r.x - map.x) < 2 && Math.abs(r.y - map.y) < 2, { r: [r.x, r.y], map: [map.x, map.y] });

  console.log(`SUMMARY ${passed} passed, ${failed} failed`);
  app.exit(failed ? 1 : 0);
}).catch((e) => { console.error('ERROR', e && e.stack || e); app.exit(1); });
