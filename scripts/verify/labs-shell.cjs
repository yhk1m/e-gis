// © 2026 김용현
/**
 * 실험실 0단계 화면 검증 — 사용자처럼 버튼을 눌러 본다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-shell.cjs
 *   (Electron 은 eStoryMap/node_modules 에 있다 — .claude/skills/verify/SKILL.md)
 * 결과: scripts/verify/out/labs-*.png 와 콘솔 판정
 *
 * 글래스 v2: 지도가 창(#app) 전체에 깔리고 메뉴바·툴바·상태줄·패널 카드가 그 위에 뜬다.
 * 부유 요소는 #map-container 의 세 오프셋(--glass-panel/top/bottom-offset)만큼 밀려야 한다.
 */
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration(); // 이 PC 는 GPU 드라이버 블루스크린 이력이 있다
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 150000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(win, name) {
  let png = Buffer.alloc(0);
  let image = null;
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await sleep(1500);
    image = await win.capturePage();
    png = image.toPNG();
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
  return image;
}

/** 상태줄(조회수 카운터가 로드마다 다를 수 있다)을 뺀 나머지가 픽셀 단위로 같은가 */
function sameAboveStatusbar(a, b, statusbarPx = 26) {
  const sa = a.getSize(), sb = b.getSize();
  if (sa.width !== sb.width || sa.height !== sb.height) return false;
  const scale = a.toBitmap().length / (sa.width * sa.height * 4); // DPR^2
  const cut = Math.ceil(statusbarPx * Math.sqrt(scale)) + 2;
  const rect = { x: 0, y: 0, width: sa.width, height: sa.height - cut };
  const ba = a.crop(rect).toBitmap(), bb = b.crop(rect).toBitmap();
  if (ba.length !== bb.length) return false;
  // 지도 타일 글자 안티앨리어싱 정도의 차이(채널 차 ≤ 12, 전체의 0.1% 미만)는 같은 화면으로 본다
  let bad = 0;
  for (let i = 0; i < ba.length; i++) { if (Math.abs(ba[i] - bb[i]) > 12) bad++; }
  return bad < ba.length * 0.001;
}

function check(name, ok) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) process.exitCode = 1;
}

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const px = (s) => parseFloat(s) || 0;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);

  // 조회수 카운터를 건드리지 않게, 앱을 띄우기 전에 같은 출처의 정적 파일에서
  // 오늘(KST) 방문한 것으로 표시해 둔다 → 첫 로드부터 action=read
  await win.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`); // 이전 실행 잔재 제거
  // 자동 저장분이 남아 있으면 "이전 작업 복원" 창이 캡처를 가린다
  await js(`indexedDB.databases().then(ds => Promise.all(ds.map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }))))`);

  // 앱을 (다시) 연다. 3c 에서 불러온 레이어가 자동 저장되어 있으면 "이전 작업 복원" 창이 뜨므로
  // "새로 시작" 을 눌러 치운다(저장분도 지워진다) — 캡처를 가리지 않게.
  const load = async (url) => {
    await win.loadURL(url);
    await sleep(3000);
    const dismissed = await js(`(() => { const b = document.getElementById('restore-no'); if (!b) return false; b.click(); return true; })()`);
    if (dismissed) await sleep(800);
  };

  await load(`${BASE}/`);

  // 1. 버튼이 3D 묶음 바로 뒤에 있고 배지는 숨겨져 있다
  check('labs button after view3d group', await js(`(() => {
    const g = document.querySelector('.toolbar-group[data-group="labs"]');
    return !!g && g.previousElementSibling?.dataset.group === 'view3d'
      && !!g.querySelector('#labs-toggle') && g.querySelector('.labs-badge').hidden === true;
  })()`));
  const img01 = await capture(win, 'labs-01-toolbar');

  // 2. 버튼 클릭 → 창이 뜨고 glass 카드가 있다
  await js(`document.getElementById('labs-toggle').click()`);
  await sleep(400);
  check('panel opened with glass card', await js(`!!document.querySelector('.labs-modal .labs-card[data-id="glass"]')`));
  await capture(win, 'labs-02-panel');

  // 3. 스위치 → 글래스 켜짐, 배지 1
  await js(`document.querySelector('.labs-switch[data-id="glass"]').click()`);
  await sleep(300);
  check('glass attr on', await js(`document.documentElement.getAttribute('data-surface') === 'glass'`));
  check('badge shows 1', await js(`document.querySelector('.labs-badge').textContent === '1' && !document.querySelector('.labs-badge').hidden`));
  check('stored', await js(`JSON.parse(localStorage.getItem('eGIS_labs')).glass === true`));
  await js(`document.getElementById('labs-close').click()`);
  await sleep(300);
  await capture(win, 'labs-03-glass-light');

  // 3b. 데스크톱: 지도가 창 전체에 깔리고, 부유 요소는 막대·패널만큼 밀린다
  const rects = `(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().toJSON() : null; }; // DOMRect 는 IPC 로 안 넘어온다
    const rz = document.getElementById('panel-resizer');
    const cs = getComputedStyle(document.getElementById('map-container'));
    return { app: r('#app'), main: r('#main-container'), map: r('#map-container'), panel: r('#left-panel'),
      toggle: r('.sidebar-toggle'), scale: r('.map-scale-bar'), zoom: r('.ol-zoom'), menubar: r('#menubar'), statusbar: r('#statusbar'),
      resizerW: rz && rz.style.display !== 'none' ? rz.getBoundingClientRect().width : 0,
      mapPosition: cs.position,
      panelOffset: cs.getPropertyValue('--glass-panel-offset').trim(),
      topOffset: cs.getPropertyValue('--glass-top-offset').trim(),
      bottomOffset: cs.getPropertyValue('--glass-bottom-offset').trim() };
  })()`;
  check('desktop media branch (pointer: fine)', await js(`matchMedia('(min-width: 1025px) and (pointer: fine)').matches`));
  let g = await js(rects);
  check('map fills #app (left/top 0, full size)', near(g.map.left, g.app.left) && near(g.map.top, g.app.top)
    && near(g.map.width, g.app.width) && near(g.map.height, g.app.height));
  check('menubar sits over the map (map.top < menubar.bottom)', g.map.top < g.menubar.bottom);
  check('--glass-top-offset == main.top', near(px(g.topOffset), g.main.top - g.app.top));
  check('--glass-bottom-offset == app.bottom - main.bottom', near(px(g.bottomOffset), g.app.bottom - g.main.bottom));
  check('panel card has 4px left margin', near(g.panel.left, g.app.left + 4));
  check('--glass-panel-offset == panel.right + resizer', near(px(g.panelOffset), g.panel.right - g.app.left + g.resizerW));
  check('sidebar toggle at panel edge', near(g.toggle.left, g.panel.right + g.resizerW, 2));
  check('sidebar toggle centred on visible strip', near(g.toggle.top + g.toggle.height / 2, (g.main.top + g.main.bottom) / 2, 2));
  check('zoom control below the bars (zoom.top >= main.top)', !!g.zoom && g.zoom.top >= g.main.top - 0.5);
  check('scale bar above the statusbar (scale.bottom <= main.bottom)', !!g.scale && g.scale.bottom <= g.main.bottom + 0.5);
  check('scale bar not under panel (scale.left >= panel.right)', !!g.scale && g.scale.left >= g.panel.right);

  // 툴바 접기 → 위 오프셋이 줄고 줌 컨트롤이 올라간다 → 다시 펴기
  const zoomTopBefore = g.zoom.top;
  const topBefore = px(g.topOffset);
  await js(`document.getElementById('toolbar-collapse').click()`);
  await sleep(400);
  g = await js(rects);
  check('toolbar collapsed → top offset shrinks', px(g.topOffset) < topBefore && near(px(g.topOffset), g.main.top - g.app.top));
  check('toolbar collapsed → zoom control moves up', g.zoom.top < zoomTopBefore && g.zoom.top >= g.main.top - 0.5);
  await js(`document.getElementById('toolbar-collapse').click()`);
  await sleep(400);
  g = await js(rects);
  check('toolbar restored → top offset back', near(px(g.topOffset), topBefore) && near(g.zoom.top, zoomTopBefore));

  // 패널 숨김 왕복
  await js(`document.getElementById('sidebar-toggle').click()`);
  await sleep(400);
  g = await js(rects);
  check('panel hidden → offset 0px', g.panelOffset === '0px');
  check('panel hidden → toggle at app.left', near(g.toggle.left, g.app.left));
  await js(`document.getElementById('sidebar-toggle').click()`);
  await sleep(400);
  g = await js(rects);
  check('panel restored → offset back', g.panelOffset !== '0px' && near(g.toggle.left, g.panel.right + g.resizerW, 2));

  // 메뉴바 드롭다운이 패널·지도 위에 보인다
  const menuOk = await js(`(() => {
    const btn = [...document.querySelectorAll('#menubar .menu-button')].find(b => b.title === '프로젝트');
    if (!btn) return { err: 'no menu button' };
    btn.click();
    const dd = document.querySelector('#menubar .menu-item.dropdown.open .dropdown-menu');
    if (!dd) return { err: 'dropdown not open' };
    const r = dd.getBoundingClientRect();
    const probe = document.elementFromPoint(r.left + 8, r.top + 8);
    return { rect: r.toJSON(), visible: r.width > 0 && r.height > 0, onTop: !!probe && dd.contains(probe),
      panelTop: document.getElementById('left-panel').getBoundingClientRect().top };
  })()`);
  check('menubar dropdown opens (' + (menuOk.err || 'ok') + ')', !menuOk.err && menuOk.visible);
  check('dropdown stacks above panel and map (elementFromPoint inside dropdown)', !menuOk.err && menuOk.onTop && menuOk.rect.bottom > menuOk.panelTop);
  await capture(win, 'labs-03c-glass-menu');
  await js(`document.body.click(); document.querySelectorAll('#menubar .menu-item.dropdown.open').forEach(m => m.classList.remove('open')); 0`);
  await sleep(200);

  // 3c. 단계구분도 범례가 패널·상태줄에 가리지 않는다 — 데이터 불러오기 → 서울 자치구 → 주제도 ▸ 단계구분도
  await js(`window.alert = (m) => console.log('ALERT', m); 0`); // 하네스가 멈추지 않게
  try {
    await js(`document.querySelector('[data-action="builtin-data"]').click()`);
    await sleep(800);
    const cardOk = await js(`(() => {
      const c = document.querySelector('.builtin-dataset-card[data-id="seoul-gu"]');
      if (!c) return false;
      const cat = c.closest('.builtin-category'); if (cat) cat.classList.add('open');
      c.click(); return true;
    })()`);
    if (!cardOk) throw new Error('seoul-gu card not found');
    let layerId = null;
    for (let i = 0; i < 20 && !layerId; i++) {
      await sleep(500);
      layerId = await js(`(() => { const ls = __egisDebug.layerManager.getAllLayers?.() || __egisDebug.layerManager.layers || []; const arr = Array.isArray(ls) ? ls : [...ls.values?.() || []]; const v = arr.filter(l => l.source?.getFeatures?.().length > 0); return v.length ? v[v.length-1].id : null; })()`);
    }
    if (!layerId) throw new Error('layer not loaded');
    await sleep(1000);
    await js(`document.getElementById('builtin-data-close')?.click()`);
    await js(`document.querySelector('[data-action="analysis-choropleth"]').click()`);
    await sleep(500);
    const applied = await js(`(() => {
      const sel = document.getElementById('choropleth-layer'); if (!sel) return 'no panel';
      sel.value = ${JSON.stringify(layerId)}; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const attr = document.getElementById('choropleth-attr');
      if (!attr || attr.disabled || !attr.value) return 'no numeric attr';
      document.getElementById('choropleth-ok').click();
      return 'ok';
    })()`);
    if (applied !== 'ok') throw new Error(applied);
    await sleep(800);
    const lg = await js(`(() => { const l = document.querySelector('.choropleth-legend'); if (!l) return null;
      return { legend: l.getBoundingClientRect().toJSON(), panel: document.getElementById('left-panel').getBoundingClientRect().toJSON(),
        main: document.getElementById('main-container').getBoundingClientRect().toJSON() }; })()`);
    check('choropleth legend on map', !!lg);
    check('legend not under panel (legend.left >= panel.right)', !!lg && lg.legend.left >= lg.panel.right);
    check('legend above statusbar (legend.bottom <= main.bottom)', !!lg && lg.legend.bottom <= lg.main.bottom + 0.5);
    await capture(win, 'labs-03b-glass-legend');
  } catch (e) {
    check('choropleth legend flow (' + e.message + ')', false);
  }

  // 4. 다크 모드에서도
  await js(`document.getElementById('theme-toggle').click()`);
  await sleep(400);
  await capture(win, 'labs-04-glass-dark');
  await js(`document.getElementById('theme-toggle').click()`);

  // 5. 새로고침해도 유지, ?lab=none 은 세션만 끈다
  await load(`${BASE}/`);
  check('persisted after reload', await js(`document.documentElement.getAttribute('data-surface') === 'glass'`));
  await load(`${BASE}/?lab=none`);
  check('?lab=none overrides', await js(`document.documentElement.getAttribute('data-surface') === null`));
  check('stored untouched', await js(`JSON.parse(localStorage.getItem('eGIS_labs')).glass === true`));

  // 6. 끄면 원상 복구 — 화면은 켜기 전(labs-01)과 픽셀 단위로 같아야 한다 (상태줄의 조회수 제외)
  await load(`${BASE}/`);
  await js(`__egisDebug.labs.set('glass', false)`);
  check('glass attr off', await js(`document.documentElement.getAttribute('data-surface') === null`));
  await sleep(300);
  g = await js(rects);
  check('flow layout restored (map.left == panel.right + resizer)', near(g.map.left, g.panel.right + g.resizerW));
  check('map position back to relative', g.mapPosition === 'relative');
  check('map back below the bars (map.top == main.top)', near(g.map.top, g.main.top));
  check('offset props removed', g.panelOffset === '' && g.topOffset === '' && g.bottomOffset === '');
  const img05 = await capture(win, 'labs-05-off');
  check('labs-05-off matches labs-01-toolbar (above statusbar, tolerance)', sameAboveStatusbar(img01, img05));

  app.quit();
});
