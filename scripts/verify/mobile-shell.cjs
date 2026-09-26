// © 2026 김용현
/**
 * 휴대폰 셸 화면 검증 — 390×844 터치 기기로 에뮬레이션하고 사용자처럼 탭한다.
 * 실행: & "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/node_modules/.bin/electron.cmd" scripts/verify/mobile-shell.cjs
 *   (vite preview 가 http://localhost:4173 에 떠 있어야 한다. EGIS_URL 로 바꿀 수 있다)
 * 결과: scripts/verify/out/mobile-*.png, desktop-11-regression.png 와 PASS/FAIL, 끝에 SUMMARY.
 *
 * 기기 에뮬레이션은 webContents.debugger(CDP)로 한다. 내비게이션하면 풀리므로 load 할 때마다 다시 보낸다.
 * 탭은 Input.dispatchTouchEvent 로 요소 한가운데를 누른다(요소가 가려져 있으면 가린 쪽이 눌린다 — 그것도 검사다).
 */
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration(); // 이 PC 는 GPU 드라이버 블루스크린 이력이 있다
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); app.exit(2); }, 200000);
process.on('unhandledRejection', (e) => console.error('UNHANDLED', e && e.message));

const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
function check(name, ok, detail) {
  console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : `— ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  if (ok) passed++; else failed++;
}

async function capture(win, name) {
  let png = Buffer.alloc(0);
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await sleep(900);
    png = (await win.capturePage()).toPNG();
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
}

/** 요소 사각형(보이지 않으면 null) — DOMRect 는 IPC 로 안 넘어오므로 toJSON */
const RECT = `(sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width || r.height ? r.toJSON() : null; }`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: PHONE.width, height: PHONE.height, useContentSize: true, show: true });
  const wc = win.webContents;
  wc.on('will-prevent-unload', (e) => e.preventDefault());
  const js = (c) => wc.executeJavaScript(c);
  const dbg = wc.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');

  const emulate = async () => {
    await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', PHONE);
  };
  const unemulate = async () => {
    await dbg.sendCommand('Emulation.clearDeviceMetricsOverride');
    await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
  };
  const rect = (sel) => js(`(${RECT})(${JSON.stringify(sel)})`);

  /** 사용자처럼 요소 한가운데를 손가락으로 누른다 */
  const tap = async (sel) => {
    await js(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'nearest' }); 0`);
    const r = await rect(sel);
    if (!r) { console.log('  (tap target missing/invisible)', sel); return false; }
    const pt = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await dbg.sendCommand('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(450);
    return true;
  };

  /** 앱을 (다시) 연다 — 에뮬레이션 재전송, "이전 작업 복원" 창 치우기 */
  const load = async (url, phone = true) => {
    await wc.loadURL(url);
    if (phone) await emulate();
    await sleep(3500);
    const dismissed = await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`);
    if (dismissed) await sleep(800);
  };

  // 조회수 카운터를 건드리지 않게 같은 출처의 정적 파일에서 오늘(KST) 방문한 것으로 표시해 둔다
  await wc.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`);
  await js(`indexedDB.databases().then(ds => Promise.all(ds.map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }))))`);

  const sheetHidden = `document.getElementById('left-panel').classList.contains('hidden') || !document.getElementById('left-panel').getBoundingClientRect().height`;

  // ── 1. plain: 헤더 한 줄, 툴바는 서랍 안, 거친 포인터 ──────────────────────────
  await load(`${BASE}/`);
  const plain = await js(`({
    menuH: document.getElementById('menubar').getBoundingClientRect().height,
    toolbarOnApp: !!document.querySelector('#app > #toolbar'),
    toolbarInDrawer: !!document.querySelector('#mobile-drawer-tools #toolbar'),
    coarse: matchMedia('(pointer: coarse)').matches,
    phoneShell: document.body.classList.contains('phone-shell'),
    isPhone: __egisDebug.mobileShell?.isPhone()
  })`);
  check('1 menubar height <= 56', plain.menuH <= 56, `${plain.menuH}px`);
  check('1 toolbar not on #app (moved into drawer)', !plain.toolbarOnApp && plain.toolbarInDrawer);
  check('1 pointer coarse', plain.coarse === true);
  check('1 body.phone-shell + mobileShell.isPhone()', plain.phoneShell && plain.isPhone === true);
  // 상태줄: 경위도 좌표가 찍힌 상태에서도 한 줄에 다 들어가고, 가로 스크롤 막대가 보이지 않는다
  const sb = await js(`(() => {
    const bar = document.getElementById('statusbar');
    const cv = document.querySelector('#status-coords .coord-value');
    const before = cv.textContent; cv.textContent = '126.97800, 37.56650';
    const out = { scrollW: bar.scrollWidth, clientW: bar.clientWidth, barGap: bar.offsetHeight - bar.clientHeight - parseFloat(getComputedStyle(bar).borderTopWidth) - parseFloat(getComputedStyle(bar).borderBottomWidth),
      items: [...bar.children].filter(c => c.getBoundingClientRect().width > 0).map(c => (c.id || c.className) + ':' + Math.round(c.getBoundingClientRect().width)) };
    cv.textContent = before; return out;
  })()`);
  check('1 statusbar fits one line with coords (no overflow)', sb.scrollW <= sb.clientW, sb);
  check('1 statusbar shows no horizontal scrollbar', sb.barGap <= 0.5, `${sb.barGap}px`);
  await capture(win, 'mobile-01-home');

  // ── 2. 서랍: 도구 격자·메뉴, 메뉴 펼침, 도구 누르면 닫힘 ─────────────────────────
  await tap('#mobile-menu-btn');
  const drawer = await js(`({
    hidden: document.getElementById('mobile-drawer').hidden,
    expanded: document.getElementById('mobile-menu-btn').getAttribute('aria-expanded'),
    tools: [...document.querySelectorAll('#mobile-drawer [data-tool]')].filter(b => b.getBoundingClientRect().width > 0).length,
    toolsAll: document.querySelectorAll('#mobile-drawer [data-tool]').length,
    menus: document.querySelectorAll('#mobile-drawer .menu-item').length
  })`);
  check('2 drawer visible after hamburger tap', drawer.hidden === false && drawer.expanded === 'true');
  // 19 개 중 2 개는 설계상 휴대폰에서 숨긴다(접기 버튼 등) → 보이는 것 ≥ 17
  check('2 drawer visible [data-tool] >= 17', drawer.tools >= 17, `${drawer.tools} visible / ${drawer.toolsAll} total`);
  check('2 drawer .menu-item == 11', drawer.menus === 11, `${drawer.menus}`);
  await capture(win, 'mobile-02-drawer');

  await tap('#mobile-drawer .menu-item[data-menu="thematic-map"] .menu-button');
  const acc = await js(`({ open: document.querySelectorAll('#mobile-drawer .menu-item.dropdown.open').length,
    which: document.querySelector('#mobile-drawer .menu-item.dropdown.open')?.dataset.menu,
    itemsShown: [...(document.querySelector('#mobile-drawer .menu-item.dropdown.open')?.querySelectorAll('.dropdown-item') || [])].filter(i => i.getBoundingClientRect().height > 0).length })`);
  check('2 thematic-map accordion opens (exactly one open, items shown)', acc.open === 1 && acc.which === 'thematic-map' && acc.itemsShown > 0, acc);
  await capture(win, 'mobile-03-drawer-menu');

  const z0 = await js(`__egisDebug.mapManager.getMap().getView().getZoom()`);
  await tap('#mobile-drawer [data-tool="zoom-in"]');
  await sleep(500); // 줌 애니메이션 250ms
  const z1 = await js(`__egisDebug.mapManager.getMap().getView().getZoom()`);
  check('2 zoom-in tap closes drawer', await js(`document.getElementById('mobile-drawer').hidden === true && !document.body.classList.contains('drawer-open')`));
  check('2 zoom-in tap zooms +1', Math.abs(z1 - z0 - 1) < 0.01, `${z0} -> ${z1}`);

  // ── 3. 검색 줄 ───────────────────────────────────────────────────────────
  await tap('#mobile-search-btn');
  const search = await js(`({ hidden: document.getElementById('mobile-search-row').hidden, focus: document.activeElement?.id,
    inputInRow: !!document.querySelector('#mobile-search-row #location-search-input') })`);
  check('3 search row visible, input inside', search.hidden === false && search.inputInRow);
  check('3 search input focused', search.focus === 'location-search-input', search.focus);
  const sr = await rect('#mobile-search-row'), mb = await rect('#menubar');
  check('3 search row sits below header', !!sr && !!mb && sr.top >= mb.bottom - 1, { rowTop: sr?.top, menuBottom: mb?.bottom });
  await capture(win, 'mobile-04-search');
  await tap('#mobile-search-btn');
  check('3 search row hidden on second tap', await js(`document.getElementById('mobile-search-row').hidden === true`));

  // ── 4. 레이어 시트 ────────────────────────────────────────────────────────
  check('4 sheet hidden initially', await js(sheetHidden));
  await tap('#mobile-layers-btn');
  check('4 layers tap opens sheet, aria-pressed=true',
    await js(`!(${sheetHidden}) && document.getElementById('mobile-layers-btn').getAttribute('aria-pressed') === 'true'`));
  await capture(win, 'mobile-05-sheet');
  await tap('#mobile-layers-btn');
  check('4 second tap hides sheet, aria-pressed=false',
    await js(`(${sheetHidden}) && document.getElementById('mobile-layers-btn').getAttribute('aria-pressed') === 'false'`));

  // ── 5. 레이어 추가 → 시트 자동 열림, 배지 1 ────────────────────────────────
  check('5 badge hidden with no layers', await js(`document.getElementById('mobile-layers-count').hidden === true`));
  const added = await js(`(async () => {
    await __egisDebug.builtinDataManager.loadCatalogs(); // 보통은 데이터 불러오기 창이 읽는다
    const r = await __egisDebug.builtinDataManager.loadPracticeDataset('area-data', 'seoul-gu');
    return r && r.layerId;
  })()`);
  await sleep(1200);
  const auto = await js(`({ open: !(${sheetHidden}), pressed: document.getElementById('mobile-layers-btn').getAttribute('aria-pressed'),
    badge: document.getElementById('mobile-layers-count').textContent, badgeHidden: document.getElementById('mobile-layers-count').hidden })`);
  check('5 seoul-gu layer added', !!added, String(added));
  check('5 sheet auto-opened on first layer', auto.open && auto.pressed === 'true', auto);
  check('5 badge text == 1 and visible', auto.badge === '1' && auto.badgeHidden === false, auto);
  await capture(win, 'mobile-06-autoopen');

  // ── 6. 글래스: 블러, 지도는 전면, 컨트롤·시트 겹침 없음, 다크 ─────────────────
  await load(`${BASE}/?lab=glass`);
  const g = await js(`(() => {
    const r = ${RECT};
    const sheet = document.getElementById('left-panel');
    return { surface: document.documentElement.getAttribute('data-surface'),
      bf: getComputedStyle(document.getElementById('menubar')).backdropFilter,
      app: r('#app'), map: r('#map-container'), menubar: r('#menubar'), zoom: r('.ol-zoom'), compass: r('.egis-compass'),
      statusbar: r('#statusbar'), sheetZ: getComputedStyle(sheet).zIndex };
  })()`);
  check('6 glass surface on', g.surface === 'glass');
  check('6 menubar backdrop-filter has blur(', typeof g.bf === 'string' && g.bf.includes('blur('), g.bf);
  const same = (a, b) => !!a && !!b && ['left', 'top', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= 1);
  check('6 #map-container rect == #app rect', same(g.map, g.app), { map: g.map, app: g.app });
  check('6 .ol-zoom top >= menubar bottom', !!g.zoom && g.zoom.top >= g.menubar.bottom, { zoomTop: g.zoom?.top, menuBottom: g.menubar?.bottom });
  check('6 .egis-compass top >= .ol-zoom bottom (no overlap)', !!g.compass && !!g.zoom && g.compass.top >= g.zoom.bottom, { compassTop: g.compass?.top, zoomBottom: g.zoom?.bottom });
  check('6 sheet z-index >= 1200', Number(g.sheetZ) >= 1200, g.sheetZ);
  await capture(win, 'mobile-07-glass-home');

  await tap('#mobile-menu-btn');
  const gd = await js(`({ hidden: document.getElementById('mobile-drawer').hidden,
    bf: getComputedStyle(document.querySelector('.mobile-drawer-sheet')).backdropFilter })`);
  check('6 glass drawer opens', gd.hidden === false, gd.bf);
  await capture(win, 'mobile-08-glass-drawer');
  await tap('#mobile-drawer .mobile-drawer-close');
  check('6 drawer close button closes', await js(`document.getElementById('mobile-drawer').hidden === true`));

  await tap('#mobile-layers-btn');
  const gs = await js(`(() => { const r = ${RECT}; return { open: !(${sheetHidden}), sheet: r('#left-panel'), statusbar: r('#statusbar'), menubar: r('#menubar') }; })()`);
  check('6 glass sheet opens', gs.open);
  check('6 sheet bottom <= statusbar top', !!gs.sheet && !!gs.statusbar && gs.sheet.bottom <= gs.statusbar.top + 0.5, { sheetBottom: gs.sheet?.bottom, statusTop: gs.statusbar?.top });
  check('6 sheet top >= menubar bottom', !!gs.sheet && gs.sheet.top >= gs.menubar.bottom, { sheetTop: gs.sheet?.top, menuBottom: gs.menubar?.bottom });
  await capture(win, 'mobile-09-glass-sheet');
  await tap('#mobile-layers-btn');

  const darkBefore = await js(`document.documentElement.getAttribute('data-theme')`);
  await js(`document.getElementById('theme-toggle').click()`);
  await sleep(400);
  const darkAfter = await js(`document.documentElement.getAttribute('data-theme')`);
  check('6 dark theme toggled', darkAfter !== darkBefore, `${darkBefore} -> ${darkAfter}`);
  await tap('#mobile-layers-btn');
  await capture(win, 'mobile-10-glass-dark');
  await tap('#mobile-layers-btn');
  await js(`document.getElementById('theme-toggle').click()`); // 다음 실행을 위해 되돌린다
  await sleep(300);

  // ── 7. 데스크톱 회귀 1280×800 ────────────────────────────────────────────
  await unemulate();
  win.setContentSize(1280, 800);
  await sleep(500);
  await load(`${BASE}/`, false);
  const d = await js(`({ w: innerWidth, drawerHidden: document.getElementById('mobile-drawer').hidden,
    drawerShown: !!document.getElementById('mobile-drawer').getBoundingClientRect().height,
    toolbar: !!document.querySelector('#app > #toolbar'), menuCenter: !!document.querySelector('#menubar .menu-center'),
    search: !!document.querySelector('#toolbar #toolbar-search'),
    phoneShell: document.body.classList.contains('phone-shell'), coarse: matchMedia('(pointer: coarse)').matches,
    phoneBtns: [...document.querySelectorAll('.mobile-only')].filter(e => e.getBoundingClientRect().width > 0).length })`);
  check('7 desktop viewport 1280', d.w === 1280, `${d.w}`);
  check('7 drawer hidden', d.drawerHidden && !d.drawerShown);
  check('7 #app > #toolbar exists', d.toolbar);
  check('7 #menubar .menu-center exists', d.menuCenter);
  check('7 search back in toolbar', d.search);
  check('7 body.phone-shell absent', !d.phoneShell);
  check('7 no .mobile-only visible', d.phoneBtns === 0, `${d.phoneBtns}`);
  await capture(win, 'desktop-11-regression');

  console.log(`SUMMARY ${passed} passed, ${failed} failed`);
  app.exit(failed ? 1 : 0);
}).catch((e) => { console.error('ERROR', e && e.stack || e); app.exit(1); });
