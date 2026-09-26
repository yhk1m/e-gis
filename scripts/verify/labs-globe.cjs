// © 2026 김용현
/**
 * 실험실 2단계(지구본) 화면 검증 — 사용자처럼 버튼을 누르고 끌어 본다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-globe.cjs
 *   (Electron 은 eStoryMap/node_modules 에 있다 — .claude/skills/verify/SKILL.md)
 * 결과: scripts/verify/out/globe-*.png 와 콘솔 판정
 *
 * 자료: 내장 「서울 자치구」 + 심은 값으로 5구간 단계구분도(blues), zoomToLayer.
 * 픽셀 검사는 지구본 캔버스(getImageData — 타일을 안 그려 오염되지 않는다)에서 한다.
 *   - 반전 검사(폴리곤 감기 방향): 서울이 가운데인 정사영에서 오른쪽 0.4R(태평양)은 바다색,
 *     왼쪽 0.4R(중국)은 육지색이어야 한다. 폴리곤이 뒤집히면 구 전체가 구간색이 된다.
 *   - 최대 확대에서 가운데(서울)는 구간색(바다·육지와 다른 파랑)이어야 한다.
 * 끌기·휠·더블클릭은 CDP Input.dispatchMouseEvent 로 한다 — webContents.sendInputEvent 의
 * 포인터는 pointerType 이 '' 이고 setPointerCapture 가 잡히지 않는다(labs-swipe.cjs 참고).
 */
const { app, BrowserWindow, session } = require('electron');
app.disableHardwareAcceleration(); // 이 PC 는 GPU 드라이버 블루스크린 이력이 있다
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 300000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(win) {
  let img = null;
  for (let i = 0; i < 5 && (!img || img.isEmpty()); i++) {
    win.focus();
    await sleep(1500);
    img = await win.capturePage();
  }
  return img;
}

async function capture(win, name) {
  const img = await grab(win);
  const png = img ? img.toPNG() : Buffer.alloc(0);
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
  return img;
}

function check(name, ok) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) process.exitCode = 1;
}

function skip(name, reason) {
  console.log('SKIP', name, '—', reason);
}

/** 상태줄(조회수·안내 문구가 바뀔 수 있다)을 뺀 나머지가 픽셀 단위로 같은가 (labs-shell.cjs 와 같은 허용치) */
function sameAboveStatusbar(a, b, statusbarPx = 26) {
  const sa = a.getSize(), sb = b.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) return { same: false, bad: -1 };
  const scale = a.toBitmap().length / (sa.width * sa.height * 4); // DPR^2
  const cut = Math.ceil(statusbarPx * Math.sqrt(scale)) + 2;
  const rect = { x: 0, y: 0, width: sa.width, height: sa.height - cut };
  const ba = a.crop(rect).toBitmap(), bb = b.crop(rect).toBitmap();
  if (ba.length !== bb.length) return { same: false, bad: -1 };
  let bad = 0;
  for (let i = 0; i < ba.length; i++) { if (Math.abs(ba[i] - bb[i]) > 12) bad++; }
  return { same: bad < ba.length * 0.001, bad, total: ba.length };
}

const near = (px, rgb, tol) => !!px && Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol;

/** 페이지에 심는 지구본 캔버스 도우미 — 좌표는 캔버스 기준 CSS px */
const PAGE_HELPERS = `(() => {
  const canvas = () => document.querySelector('#map-container canvas.globe-canvas');
  window.__gpx = (x, y) => {
    const c = canvas(); if (!c) return null;
    const pr = __egisDebug.globePanel.controller.pixelRatio;
    const d = c.getContext('2d').getImageData(Math.round(x * pr), Math.round(y * pr), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  };
  /** (x, y) 둘레 ±half CSS px 창의 픽셀들 */
  window.__gwin = (x, y, half) => {
    const c = canvas(); if (!c) return null;
    const pr = __egisDebug.globePanel.controller.pixelRatio;
    const x0 = Math.round((x - half) * pr), y0 = Math.round((y - half) * pr), n = Math.round(2 * half * pr) + 1;
    const d = c.getContext('2d').getImageData(x0, y0, n, n).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
    return out;
  };
  /** 캔버스 전체 스냅샷을 이름으로 보관 */
  window.__gsnaps = {};
  window.__gsnap = (name) => { const c = canvas(); window.__gsnaps[name] = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; return c.width * c.height; };
  window.__gdiff = (a, b) => {
    const A = window.__gsnaps[a], B = window.__gsnaps[b];
    if (!A || !B || A.length !== B.length) return -1;
    let n = 0;
    for (let i = 0; i < A.length; i += 4) {
      if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n++;
    }
    return n;
  };
  window.__hex = (name) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : v;
  };
  return 0;
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);
  const wc = win.webContents;
  wc.on('will-prevent-unload', (e) => e.preventDefault());
  wc.debugger.attach('1.3');
  const cdpMouse = (type, x, y, buttons, clickCount) => wc.debugger.sendCommand('Input.dispatchMouseEvent',
    { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: clickCount ?? (type === 'mouseMoved' ? 0 : 1) });
  /** 사용자처럼 (x0,y0) 을 누르고 10걸음에 (x1,y1) 로 끌어 놓는다 (창 CSS 좌표) */
  const drag = async (x0, y0, x1, y1) => {
    await cdpMouse('mouseMoved', x0, y0, 0);
    await cdpMouse('mousePressed', x0, y0, 1);
    await sleep(100);
    for (let i = 1; i <= 10; i++) {
      await cdpMouse('mouseMoved', x0 + (x1 - x0) * (i / 10), y0 + (y1 - y0) * (i / 10), 1);
      await sleep(40);
    }
    await cdpMouse('mouseReleased', x1, y1, 0);
    await sleep(800);
  };
  const wheel = async (x, y, deltaY) => {
    await wc.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY });
    await sleep(250);
  };
  const dblclick = async (x, y) => {
    await cdpMouse('mouseMoved', x, y, 0);
    await cdpMouse('mousePressed', x, y, 1, 1);
    await cdpMouse('mouseReleased', x, y, 0, 1);
    await cdpMouse('mousePressed', x, y, 1, 2);
    await cdpMouse('mouseReleased', x, y, 0, 2);
    await sleep(600);
  };
  const errors = [];
  wc.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });

  // PNG 저장 가로채기 — 창을 띄우지 않고 out/ 에 받는다
  let download = null;
  session.defaultSession.on('will-download', (_e, item) => {
    const savePath = path.join(OUT, 'globe-saved.png');
    item.setSavePath(savePath);
    download = { filename: item.getFilename(), state: 'progressing', savePath };
    item.once('done', (_ev, state) => { download.state = state; });
  });

  // 조회수 카운터를 건드리지 않게, 앱을 띄우기 전에 같은 출처의 정적 파일에서 오늘(KST) 방문으로 표시
  await win.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`); // 이전 실행 잔재 제거
  await js(`indexedDB.databases().then(ds => Promise.all(ds.map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }))))`);

  await win.loadURL(`${BASE}/`);
  await sleep(3000);
  for (let i = 0; i < 10; i++) {
    const clicked = await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`);
    if (clicked) { await sleep(800); break; }
    await sleep(500);
  }
  await js(`window.alert = (m) => console.log('ALERT', m); window.confirm = () => false; 0`);
  await js(`window.__globeErrors = []; window.addEventListener('error', (e) => window.__globeErrors.push(String(e.message))); window.addEventListener('unhandledrejection', (e) => window.__globeErrors.push('rejection: ' + String(e.reason && e.reason.message || e.reason))); 0`);
  await js(PAGE_HELPERS);

  const pageErrors = () => js(`window.__globeErrors.slice()`);
  const ctl = (expr) => js(`(() => { const c = __egisDebug.globePanel.controller; return c ? ${expr} : null; })()`);
  const isOn = () => js(`__egisDebug.globePanel.isActive()`);
  const toggleVisible = (id) => js(`(() => { const b = document.getElementById('${id}'); return b.hidden === false && getComputedStyle(b).display !== 'none'; })()`);
  const setSelect = (id, value) => js(`(() => { const s = document.getElementById('${id}'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  const clickEl = (id) => js(`document.getElementById('${id}').click(); 0`);
  const center2d = () => js(`__egisDebug.mapManager.getCenter()`);
  const canvasRect = () => js(`(() => { const c = document.querySelector('#map-container canvas.globe-canvas'); return c ? c.getBoundingClientRect().toJSON() : null; })()`);

  // 0. 실험이 꺼져 있으면 토글이 안 보인다
  check('globe toggle hidden when lab off', await js(`(() => { const b = document.getElementById('globe-toggle'); return b.hidden === true && getComputedStyle(b).display === 'none'; })()`));

  // 1. 단계구분도 — 서울 자치구 + 심은 값, 5구간, 화면에 채운다
  const layerId = await js(`(async () => {
    await __egisDebug.builtinDataManager.loadCatalogs();
    const { layerId } = await __egisDebug.builtinDataManager.loadPracticeDataset('area-data', 'seoul-gu');
    const info = __egisDebug.layerManager.getLayer(layerId);
    info.source.getFeatures().forEach((f, i) => f.set('val', (i * 37) % 100));
    const r = __egisDebug.choroplethTool.apply(layerId, 'val', 'blues', 'quantile', 5);
    return r.layerId;
  })()`);
  await sleep(500);
  await js(`__egisDebug.layerManager.zoomToLayer('${layerId}')`);
  await sleep(3500);
  check('choropleth layer with 5 classes', await js(`(() => { const l = __egisDebug.layerManager.getLayer('${layerId}'); return l.type === 'choropleth' && l._choroplethConfig.breaks.length === 6; })()`));
  const img2d = await capture(win, 'globe-00-2d');
  const home2d = await center2d();
  console.log('  2D centre', JSON.stringify(home2d));

  // 2. 실험 켜기 → 토글 보임, 순서 실험실·지구본·스와이프
  await js(`__egisDebug.labs.set('globe', true)`);
  await sleep(300);
  check('globe toggle visible when lab on', await toggleVisible('globe-toggle'));
  check('toolbar order labs · globe · swipe', await js(`(() => {
    const ids = [...document.querySelector('.toolbar-group[data-group="labs"]').querySelectorAll('button[data-tool]')].map((b) => b.id);
    return ids.join(',') === 'labs-toggle,globe-toggle,swipe-toggle';
  })()`));

  // 3. 토글 클릭 → 캔버스가 지도 칸을 덮고 컨트롤 박스, 정면 = 2D 중심
  await clickEl('globe-toggle');
  for (let i = 0; i < 20 && !(await isOn()); i++) await sleep(250);
  await sleep(2500);   // 육지 받기·그리기
  check('globe active', await isOn());
  const geom = await js(`(() => {
    const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    return { canvas: r(document.querySelector('#map-container canvas.globe-canvas')), container: r(document.getElementById('map-container')),
      box: r(document.getElementById('globe-controls')), text: document.getElementById('globe-controls').textContent };
  })()`);
  check('globe canvas mounted in #map-container', !!geom.canvas);
  check('canvas covers #map-container', !!geom.canvas && ['left', 'top', 'width', 'height'].every((k) => Math.abs(geom.canvas[k] - geom.container[k]) <= 1));
  check('controls visible', await js(`!document.getElementById('globe-controls').hidden && getComputedStyle(document.getElementById('globe-controls')).display !== 'none'`));
  check('toggle pressed', await js(`document.getElementById('globe-toggle').getAttribute('aria-pressed') === 'true' && document.getElementById('globe-toggle').classList.contains('active')`));
  check('projection options = 6, default orthographic', await js(`document.querySelectorAll('#globe-projection option').length === 6 && document.getElementById('globe-projection').value === 'orthographic'`));
  check('controls box has no emoji', !/\p{Extended_Pictographic}/u.test(geom.text));
  const rot0 = await ctl('c.rotation.slice()');
  const expectRot = [-home2d[0], -home2d[1], 0];
  console.log('  rotation', JSON.stringify(rot0), 'expected', JSON.stringify(expectRot));
  check('rotation == rotationFromCenter(2D centre)', Array.isArray(rot0) && rot0.every((v, i) => Math.abs(v - expectRot[i]) < 1e-9));
  check('land loaded (no land error)', await ctl('!!c.land && !c.landFailed') && await js(`document.getElementById('globe-land-error').hidden === true`));
  check('skipped summary hidden with vector layers only', await js(`document.getElementById('globe-skipped').hidden === true`));
  const img01 = await capture(win, 'globe-01-ortho');

  // 4. 픽셀: 폴리곤이 뒤집히지 않았다
  const W = geom.canvas.width, H = geom.canvas.height;
  const cx = W / 2, cy = H / 2;                       // 캔버스 기준
  const cxAbs = geom.canvas.left + cx, cyAbs = geom.canvas.top + cy;   // 창 기준
  const ocean = await js(`__hex('--globe-ocean')`);
  const land = await js(`__hex('--globe-land')`);
  const fitR = await ctl('c.fit');   // 정사영의 d3 scale = 구 반지름(px)
  const east = await js(`__gpx(${cx + 0.4 * fitR}, ${cy})`);
  const west = await js(`__gpx(${cx - 0.4 * fitR}, ${cy})`);
  const outside = await js(`__gpx(${cx}, 5)`);
  console.log('  colours', JSON.stringify({ ocean, land, fitR, east, west, outside }));
  check('east of Korea (0.4R, Pacific) is ocean colour — polygons not inverted', near(east, ocean, 10));
  check('west of Korea (0.4R, China) is land colour — polygons not inverted', near(west, land, 10));
  // 구 바깥: 스펙은 캔버스가 3D 처럼 #map-container 를 덮는 오버레이다(배경은 배경지도 타일이 아니다).
  // 지도 칸 왼쪽 위 100×100 CSS px(구 바깥)가 지구본 전 2D 캡처와 같으면 2D 지도가 비쳐 보이는 것이다.
  const innerW = await js(`window.innerWidth`);
  const k = img01.getSize().width / innerW;
  const rect = { x: Math.round((geom.container.left + 20) * k), y: Math.round((geom.container.top + 20) * k), width: Math.round(100 * k), height: Math.round(100 * k) };
  const ra = img2d.crop(rect).toBitmap(), rb = img01.crop(rect).toBitmap();
  let changed = 0;
  for (let i = 0; i < ra.length; i += 4) { if (Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]) > 30) changed++; }
  console.log('  outside-sphere region vs 2D', JSON.stringify({ canvasAlpha: outside && outside[3], changed, of: ra.length / 4 }));
  check('2D map hidden outside the sphere (overlay covers #map-container)', changed > ra.length / 4 * 0.5);
  check('lite frame flag off at rest', await ctl('c.lite === false'));

  // 5. 다크 테마 — 바다색이 바뀌고 다시 그린다
  await clickEl('theme-toggle');
  await sleep(800);
  const oceanDark = await js(`__hex('--globe-ocean')`);
  const eastDark = await js(`__gpx(${cx + 0.4 * fitR}, ${cy})`);
  console.log('  dark', JSON.stringify({ oceanDark, eastDark }));
  check('dark theme redraws with dark ocean', near(eastDark, oceanDark, 10) && !near(eastDark, ocean, 30));
  await capture(win, 'globe-03-dark');
  await clickEl('theme-toggle');
  await sleep(800);
  check('light theme restored', near(await js(`__gpx(${cx + 0.4 * fitR}, ${cy})`), ocean, 10));

  // 6. 투영법 6종 — 오류 없이 바뀌고, 원통 투영은 φ 0
  const keys = await js(`[...document.querySelectorAll('#globe-projection option')].map((o) => o.value)`);
  check('projection keys', JSON.stringify(keys) === JSON.stringify(['orthographic', 'mercator', 'equalEarth', 'naturalEarth', 'azimuthalEqualArea', 'equirectangular']));
  for (const key of keys.slice(1)) {
    await setSelect('globe-projection', key);
    await sleep(700);
    const st = await ctl(`({ key: c.projectionKey, rot: c.rotation.slice(), scale: c.scale, fit: c.fit })`);
    const cyl = ['mercator', 'equalEarth', 'naturalEarth', 'equirectangular'].includes(key);
    check(`projection ${key} applied${cyl ? ' (phi 0, lambda kept)' : ' (phi kept)'}`, st.key === key && Math.abs(st.rot[0] - rot0[0]) < 1e-9 &&
      (cyl ? st.rot[1] === 0 : Math.abs(st.rot[1] - rot0[1]) < 1e-9) && Math.abs(st.scale - st.fit) < 1e-6);
    check(`no page errors after ${key}`, (await pageErrors()).length === 0);
    await capture(win, `globe-02-${key}`);
  }
  await setSelect('globe-projection', 'orthographic');
  await sleep(600);
  check('back to orthographic restores phi', Math.abs((await ctl('c.rotation[1]')) - rot0[1]) < 1e-9);

  // 7. 끌기 (+150px 오른쪽) → λ 증가, φ 그대로
  let before = await ctl('c.rotation.slice()');
  let scale = await ctl('c.scale');
  await drag(cxAbs, cyAbs, cxAbs + 150, cyAbs);
  let after = await ctl('c.rotation.slice()');
  const expectDl = 150 * 75 / scale;
  console.log('  drag ortho', JSON.stringify({ before, after, expectDl }));
  check('drag right rotates lambda (+150px)', after[0] > before[0] && Math.abs((after[0] - before[0]) - expectDl) < 1.5);
  check('horizontal drag keeps phi', Math.abs(after[1] - before[1]) < 1e-9);
  check('drag state cleared after release', await ctl('c.dragging === false && c.pointers.size === 0'));
  await capture(win, 'globe-04-dragged');
  // 아래로도 끌면 φ 도 바뀐다 (정사영)
  before = after;
  await drag(cxAbs, cyAbs, cxAbs, cyAbs + 60);
  after = await ctl('c.rotation.slice()');
  check('drag down in orthographic lowers phi', after[1] < before[1]);

  // 메르카토르: 대각선으로 끌어도 φ 는 0 그대로(λ 만)
  await setSelect('globe-projection', 'mercator');
  await sleep(600);
  before = await ctl('c.rotation.slice()');
  await drag(cxAbs, cyAbs, cxAbs + 150, cyAbs + 80);
  after = await ctl('c.rotation.slice()');
  console.log('  drag mercator', JSON.stringify({ before, after }));
  check('mercator drag changes lambda only', after[0] !== before[0] && after[1] === 0 && before[1] === 0);
  await setSelect('globe-projection', 'orthographic');
  await sleep(600);

  // 8. 휠 → 확대, 범위 [0.5×fit, 8×fit]; 더블클릭 → 처음 자세
  const fit = await ctl('c.fit');
  scale = await ctl('c.scale');
  await wheel(cxAbs, cyAbs, -240);
  const s1 = await ctl('c.scale');
  console.log('  wheel', JSON.stringify({ fit, scale, s1 }));
  check('wheel up zooms in', s1 > scale && s1 <= 8 * fit + 1e-6);
  for (let i = 0; i < 15; i++) await wheel(cxAbs, cyAbs, -400);
  const sMax = await ctl('c.scale');
  check('zoom clamps at 8x fit', Math.abs(sMax - 8 * fit) < 1e-6);
  await dblclick(cxAbs, cyAbs);
  const reset = await ctl(`({ rot: c.rotation.slice(), scale: c.scale, home: c.homeRotation.slice() })`);
  console.log('  after dblclick', JSON.stringify(reset));
  check('double-click resets to home rotation and fit scale', reset.rot.every((v, i) => Math.abs(v - rot0[i]) < 1e-9) && Math.abs(reset.scale - fit) < 1e-6);
  // 더블클릭 뒤에도 바로 끌어 돌릴 수 있어야 한다. 더블클릭이 문서 글자 선택(Range)을 남기면
  // 다음 끌기가 캔버스의 기본 끌어 놓기(dragstart)가 되어 첫 걸음 뒤 pointercancel 로 끊긴다.
  const selAfterDbl = await js(`getSelection().type`);
  check(`double-click leaves no text selection (selection ${selAfterDbl})`, selAfterDbl !== 'Range');
  await js(`window.__dragLog = []; ['dragstart', 'pointercancel'].forEach((n) => document.querySelector('#map-container canvas.globe-canvas').addEventListener(n, () => window.__dragLog.push(n), { once: true })); 0`);
  before = await ctl('c.rotation.slice()');
  await drag(cxAbs, cyAbs, cxAbs + 150, cyAbs);
  after = await ctl('c.rotation.slice()');
  const dragLog = await js(`window.__dragLog`);
  console.log('  drag after dblclick', JSON.stringify({ dl: after[0] - before[0], expectDl, events: dragLog }));
  check('drag right after a double-click rotates the full +150px', Math.abs((after[0] - before[0]) - expectDl) < 1.5 && dragLog.length === 0);
  await js(`getSelection().removeAllRanges(); 0`);   // 위 결함이 뒤 단계로 번지지 않게
  await dblclick(cxAbs, cyAbs);
  for (let i = 0; i < 15; i++) await wheel(cxAbs, cyAbs, 400);
  check('zoom clamps at 0.5x fit', Math.abs((await ctl('c.scale')) - 0.5 * fit) < 1e-6);
  await dblclick(cxAbs, cyAbs);
  // 서울이 가운데인 채 최대 확대 → 가운데는 구간색(바다·육지와 다른 파랑)
  for (let i = 0; i < 15; i++) await wheel(cxAbs, cyAbs, -400);
  await sleep(500);
  const win9 = await js(`__gwin(${cx}, ${cy}, 5)`);
  const classLike = win9.filter((p) => !near(p, ocean, 25) && !near(p, land, 25) && p[2] > p[0] + 15).length;
  console.log('  seoul window', classLike, '/', win9.length, 'sample', JSON.stringify(win9[Math.floor(win9.length / 2)]));
  check('Seoul (centre, max zoom) filled with class colour', classLike >= win9.length * 0.5);
  const eastZoomed = await js(`__gpx(${cx + 0.4 * fitR}, ${cy})`);   // 8배에서 0.4R 동쪽 ≈ 동해·일본 쪽 1.4°
  console.log('  east at max zoom', JSON.stringify(eastZoomed));
  await capture(win, 'globe-05-zoomed');
  await dblclick(cxAbs, cyAbs);

  // 9. 경위선·육지 끄기 → 그림이 달라진다
  await sleep(400);
  await js(`__gsnap('on')`);
  await clickEl('globe-graticule');
  await sleep(500);
  await js(`__gsnap('noGrat')`);
  const dGrat = await js(`__gdiff('on', 'noGrat')`);
  check(`graticule off changes pixels (${dGrat})`, dGrat > 0 && await ctl('c.showGraticule === false'));
  await clickEl('globe-land');
  await sleep(500);
  await js(`__gsnap('noLand')`);
  const dLand = await js(`__gdiff('noGrat', 'noLand')`);
  check(`land off changes pixels (${dLand})`, dLand > 0 && await ctl('c.showLand === false'));
  check('with land off, west sample is ocean', near(await js(`__gpx(${cx - 0.4 * fitR}, ${cy})`), ocean, 10));
  await capture(win, 'globe-06-no-graticule-land');
  await clickEl('globe-graticule');
  await clickEl('globe-land');
  await sleep(500);
  await js(`__gsnap('back')`);
  check('graticule/land back on restores the image', await js(`__gdiff('on', 'back')`) === 0);

  // 10. 미표시 안내 — 히트맵 흉내(벡터로 만든 뒤 type 만 바꾼다)
  await js(`(() => {
    const lm = __egisDebug.layerManager;
    const src = lm.getLayer('${layerId}').source;
    const id = lm.addLayer({ name: '열지도 흉내', features: src.getFeatures().slice(0, 3).map((f) => f.clone()) });
    lm.getLayer(id).type = 'heatmap';
    window.__heatId = id;
    lm.updateLayerStyle(id);
  })()`);
  await sleep(800);
  const skippedText = await js(`document.getElementById('globe-skipped').textContent`);
  console.log('  skipped', JSON.stringify(skippedText));
  check('skipped summary shown for heatmap', await js(`!document.getElementById('globe-skipped').hidden`) && skippedText.includes('지구본에 표시되지 않음') && skippedText.includes('열지도 흉내') && skippedText.includes('히트맵'));
  await capture(win, 'globe-07-skipped');
  await js(`__egisDebug.layerManager.removeLayer(window.__heatId)`);
  await sleep(800);
  check('skipped summary hidden after removal', await js(`document.getElementById('globe-skipped').hidden === true`));
  skip('land failure message', 'land GeoJSON is cached per module after the first load; forcing a fetch failure needs a fresh page with a blocked URL');

  // 11. PNG 저장
  await clickEl('globe-save');
  for (let i = 0; i < 20 && (!download || download.state === 'progressing'); i++) await sleep(250);
  const savedSize = download && fs.existsSync(download.savePath) ? fs.statSync(download.savePath).size : 0;
  console.log('  download', JSON.stringify(download), savedSize);
  check('PNG saved as 지구본.png', !!download && download.filename === '지구본.png' && download.state === 'completed');
  check('PNG larger than 10 KB', savedSize > 10 * 1024);

  // 12. 닫기(끌기 없이 더블클릭으로 제자리) → 2D 중심이 들어오기 전 그대로
  await clickEl('globe-close');
  await sleep(800);
  check('close removes canvas', await js(`!document.querySelector('#map-container canvas.globe-canvas')`));
  check('close hides controls and unpresses toggle', await js(`document.getElementById('globe-controls').hidden && document.getElementById('globe-toggle').getAttribute('aria-pressed') === 'false' && !document.getElementById('globe-toggle').classList.contains('active')`));
  check('globePanel inactive', !(await isOn()));
  let c2 = await center2d();
  console.log('  centre after close', JSON.stringify(c2));
  check('2D centre unchanged after globe without drag', Math.abs(c2[0] - home2d[0]) < 1e-6 && Math.abs(c2[1] - home2d[1]) < 1e-6);

  // 끌고 나가면 2D 중심이 따라 움직인다 (오른쪽으로 끌면 서쪽이 가운데 → 경도 감소)
  await clickEl('globe-toggle');
  for (let i = 0; i < 20 && !(await isOn()); i++) await sleep(250);
  await sleep(800);
  const sc = await ctl('c.scale');
  await js(`getSelection().removeAllRanges(); 0`);   // 앞 단계 더블클릭이 남긴 선택(결함, 8단계 참고)을 걷는다
  await drag(cxAbs, cyAbs, cxAbs + 150, cyAbs);
  const facing = await ctl('c.currentCenter()');
  await clickEl('globe-toggle');
  await sleep(800);
  c2 = await center2d();
  const expectLon = home2d[0] - 150 * 75 / sc;
  console.log('  after drag+exit', JSON.stringify({ facing, c2, expectLon }));
  check('2D centre follows the facing point after drag (lon moved west)', Math.abs(c2[0] - facing[0]) < 1e-6 && Math.abs(c2[1] - facing[1]) < 1e-6 && Math.abs(c2[0] - expectLon) < 1.5 && Math.abs(c2[1] - home2d[1]) < 1e-6);
  await js(`__egisDebug.layerManager.zoomToLayer('${layerId}')`);
  await sleep(1500);

  // 13. 3D 배타 — 지구본 켠 채 3D → 지구본 닫힘. 3D 켠 채 지구본 → 3D 닫힘
  await clickEl('globe-toggle');
  for (let i = 0; i < 20 && !(await isOn()); i++) await sleep(250);
  await sleep(800);
  await clickEl('view3d-toggle');
  await sleep(5000);
  check('3D toggle closes globe', !(await isOn()) && await js(`!document.querySelector('#map-container canvas.globe-canvas') && document.getElementById('globe-controls').hidden`));
  const on3d = await js(`!!__egisDebug.view3dPanel.controller`);
  if (on3d) {
    check('3D active after globe closed', true);
    await clickEl('globe-toggle');
    for (let i = 0; i < 20 && !(await isOn()); i++) await sleep(250);
    await sleep(1500);
    check('globe toggle closes 3D and opens globe', await isOn() && await js(`!__egisDebug.view3dPanel.controller && document.getElementById('view3d-toggle').getAttribute('aria-pressed') !== 'true'`));
    await capture(win, 'globe-08-after-3d');
    await clickEl('globe-toggle');
    await sleep(800);
  } else {
    skip('3D exclusivity (3D side)', '3D view did not become active in this Electron (software rendering)');
  }
  check('no page errors after 3D exclusivity', (await pageErrors()).length === 0);

  // 14. 스와이프 배타
  await js(`__egisDebug.labs.set('swipe', true)`);
  await sleep(300);
  await clickEl('swipe-toggle');
  await sleep(600);
  check('swipe open before globe', await js(`__egisDebug.swipePanel.isActive()`));
  await clickEl('globe-toggle');
  for (let i = 0; i < 20 && !(await isOn()); i++) await sleep(250);
  await sleep(800);
  check('globe toggle closes swipe and opens globe', await isOn() && await js(`!__egisDebug.swipePanel.isActive() && document.getElementById('swipe-controls').hidden`));
  await clickEl('swipe-toggle');
  await sleep(500);
  check('swipe refuses to open while globe is on', await js(`!__egisDebug.swipePanel.isActive() && document.getElementById('swipe-controls').hidden`) && await isOn());

  // 15. 글래스 — 컨트롤 박스가 위 오프셋 아래로
  await js(`__egisDebug.labs.set('glass', true)`);
  await sleep(1500);
  const glass = await js(`(() => {
    const cs = getComputedStyle(document.getElementById('map-container'));
    const b = getComputedStyle(document.getElementById('globe-controls'));
    return { attr: document.documentElement.getAttribute('data-surface'), desktop: matchMedia('(min-width: 1025px) and (pointer: fine)').matches,
      offTop: parseFloat(cs.getPropertyValue('--glass-top-offset')) || 0, boxTop: parseFloat(b.top) };
  })()`);
  console.log('  glass', JSON.stringify(glass));
  if (glass.attr === 'glass' && glass.desktop && glass.offTop > 0) {
    check('glass: globe box top == --glass-top-offset + 12', Math.abs(glass.boxTop - (glass.offTop + 12)) < 0.5);
    await capture(win, 'globe-10-glass');
  } else {
    skip('glass interplay', `glass not active on desktop (attr=${glass.attr}, desktop=${glass.desktop}, offTop=${glass.offTop})`);
  }
  check('globe still active across glass toggle', await isOn());
  await js(`__egisDebug.labs.set('glass', false)`);
  await sleep(1000);
  check('glass off: box top back to 12px', await js(`parseFloat(getComputedStyle(document.getElementById('globe-controls')).top) === 12`));
  await js(`__egisDebug.labs.set('swipe', false)`);
  await sleep(300);

  // 16. 실험 끄기(지구본 켠 채) → 지구본 닫힘, 토글 숨김, 화면이 지구본 전 2D 와 같다
  await clickEl('globe-toggle');   // 닫고
  await sleep(600);
  await js(`__egisDebug.layerManager.zoomToLayer('${layerId}')`);
  await sleep(1500);
  await clickEl('globe-toggle');   // 들어오기 전 중심을 맞춘 뒤 다시 연다
  for (let i = 0; i < 20 && !(await isOn()); i++) await sleep(250);
  await sleep(1000);
  await js(`__egisDebug.labs.set('globe', false)`);
  await sleep(3000);   // 타일
  check('lab off closes globe and hides toggle', !(await isOn()) && await js(`!document.querySelector('#map-container canvas.globe-canvas') && document.getElementById('globe-controls').hidden && document.getElementById('globe-toggle').hidden === true`));
  const imgOff = await capture(win, 'globe-09-off');
  const cmp = sameAboveStatusbar(img2d, imgOff);
  console.log('  compare', JSON.stringify(cmp));
  check('globe-09-off matches globe-00-2d (above statusbar, tolerance)', cmp.same);

  const errs = await pageErrors();
  check('no page errors overall', errs.length === 0);
  console.log('  console errors', JSON.stringify(errors.filter((m) => !/indexeddb|quota|cache|favicon/i.test(m)).slice(0, 10)));
  console.log('  page errors', JSON.stringify(errs));
  app.exit(process.exitCode || 0); // app.quit() 은 process.exitCode 를 무시한다
});
