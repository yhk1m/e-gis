// © 2026 김용현
/**
 * 실험실 0단계 화면 검증 — 사용자처럼 버튼을 눌러 본다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-shell.cjs
 *   (Electron 은 eStoryMap/node_modules 에 있다 — .claude/skills/verify/SKILL.md)
 * 결과: scripts/verify/out/labs-*.png 와 콘솔 판정
 */
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration(); // 이 PC 는 GPU 드라이버 블루스크린 이력이 있다
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 120000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(win, name) {
  let png = Buffer.alloc(0);
  for (let i = 0; i < 5 && png.length === 0; i++) {
    win.focus();
    await sleep(1500);
    png = (await win.capturePage()).toPNG();
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
}

function check(name, ok) {
  console.log(ok ? 'PASS' : 'FAIL', name);
  if (!ok) process.exitCode = 1;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);

  // 조회수 카운터를 건드리지 않게, 앱을 띄우기 전에 같은 출처의 정적 파일에서
  // 오늘(KST) 방문한 것으로 표시해 둔다 → 첫 로드부터 action=read
  await win.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`); // 이전 실행 잔재 제거

  await win.loadURL(`${BASE}/`);
  await sleep(3000);

  // 1. 버튼이 3D 묶음 바로 뒤에 있고 배지는 숨겨져 있다
  check('labs button after view3d group', await js(`(() => {
    const g = document.querySelector('.toolbar-group[data-group="labs"]');
    return !!g && g.previousElementSibling?.dataset.group === 'view3d'
      && !!g.querySelector('#labs-toggle') && g.querySelector('.labs-badge').hidden === true;
  })()`));
  await capture(win, 'labs-01-toolbar');

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

  // 3b. 데스크톱: 지도가 패널 아래까지 깔리고, 왼쪽 부유 요소는 패널 너비만큼 밀린다
  const rects = `(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON(); // DOMRect 는 IPC 로 안 넘어온다
    const rz = document.getElementById('panel-resizer');
    return { main: r('#main-container'), map: r('#map-container'), panel: r('#left-panel'),
      toggle: r('.sidebar-toggle'), scale: r('.map-scale-bar'), resizerW: rz && rz.style.display !== 'none' ? rz.getBoundingClientRect().width : 0,
      offset: getComputedStyle(document.getElementById('map-container')).getPropertyValue('--glass-panel-offset').trim() };
  })()`;
  check('desktop media branch (pointer: fine)', await js(`matchMedia('(min-width: 1025px) and (pointer: fine)').matches`));
  let g = await js(rects);
  check('map extends under panel (map.left == main.left)', Math.abs(g.map.left - g.main.left) < 1);
  check('sidebar toggle at panel edge', Math.abs(g.toggle.left - (g.panel.right + g.resizerW)) <= 2);
  check('--glass-panel-offset set', g.offset !== '' && g.offset !== '0px');
  check('scale bar not under panel (scale.left >= panel.right)', g.scale.left >= g.panel.right);
  await js(`document.getElementById('sidebar-toggle').click()`);
  await sleep(400);
  g = await js(rects);
  check('panel hidden → offset 0px', g.offset === '0px');
  check('panel hidden → toggle at main.left', Math.abs(g.toggle.left - g.main.left) < 1);
  await js(`document.getElementById('sidebar-toggle').click()`);
  await sleep(400);
  g = await js(rects);
  check('panel restored → offset back', g.offset !== '0px' && Math.abs(g.toggle.left - (g.panel.right + g.resizerW)) <= 2);

  // 3c. 단계구분도 범례가 패널에 가리지 않는다 — 데이터 불러오기 → 서울 자치구 → 주제도 ▸ 단계구분도
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
      return { legend: l.getBoundingClientRect().toJSON(), panel: document.getElementById('left-panel').getBoundingClientRect().toJSON() }; })()`);
    check('choropleth legend on map', !!lg);
    check('legend not under panel (legend.left >= panel.right)', !!lg && lg.legend.left >= lg.panel.right);
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
  await win.loadURL(`${BASE}/`);
  await sleep(3000);
  check('persisted after reload', await js(`document.documentElement.getAttribute('data-surface') === 'glass'`));
  await win.loadURL(`${BASE}/?lab=none`);
  await sleep(3000);
  check('?lab=none overrides', await js(`document.documentElement.getAttribute('data-surface') === null`));
  check('stored untouched', await js(`JSON.parse(localStorage.getItem('eGIS_labs')).glass === true`));

  // 6. 끄면 원상 복구
  await win.loadURL(`${BASE}/`);
  await sleep(3000);
  await js(`__egisDebug.labs.set('glass', false)`);
  check('glass attr off', await js(`document.documentElement.getAttribute('data-surface') === null`));
  await sleep(300);
  g = await js(rects);
  check('flow layout restored (map.left == panel.right + resizer)', Math.abs(g.map.left - (g.panel.right + g.resizerW)) < 1);
  check('--glass-panel-offset removed', g.offset === '');
  await capture(win, 'labs-05-off');

  app.quit();
});
