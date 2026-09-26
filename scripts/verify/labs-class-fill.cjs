// © 2026 김용현
/**
 * 실험실 1단계(구간 채움) 화면 검증 — 사용자처럼 범례 칸·팝오버·내보내기 창을 누른다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-class-fill.cjs
 *   (Electron 은 eStoryMap/node_modules 에 있다 — .claude/skills/verify/SKILL.md)
 * 결과: scripts/verify/out/class-fill-*.png 와 콘솔 판정
 *
 * 내장 「서울 자치구」(25개 폴리곤)에는 숫자 필드가 없어 하네스가 val 을 심고
 * __egisDebug.choroplethTool.apply 로 5구간 단계구분도를 만든다. 그 뒤는 사용자처럼
 * 범례 칸·팝오버·내보내기 창을 클릭한다. 새로고침 복원, Esc·바깥 클릭·끌기 가드까지.
 */
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration(); // 이 PC 는 GPU 드라이버 블루스크린 이력이 있다
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); process.exit(2); }, 240000);

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

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);
  const wc = win.webContents;
  // AutoSaveManager 가 레이어가 있으면 beforeunload 로 떠나기를 막는다 — 새로고침·종료가 멈추지 않게
  wc.on('will-prevent-unload', (e) => e.preventDefault());

  // 조회수 카운터를 건드리지 않게, 앱을 띄우기 전에 같은 출처의 정적 파일에서
  // 오늘(KST) 방문한 것으로 표시해 둔다 → 첫 로드부터 action=read
  await win.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`); // 이전 실행 잔재 제거
  // 자동 저장분이 남아 있으면 "이전 작업 복원" 창이 캡처를 가린다
  await js(`indexedDB.databases().then(ds => Promise.all(ds.map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }))))`);

  /** 앱을 (다시) 연다. "이전 작업 복원" 창이 뜨면 restore 에 따라 복원/새로 시작을 누른다. */
  const load = async (url, restore = false) => {
    await win.loadURL(url);
    await sleep(3000);
    let clicked = false;
    for (let i = 0; i < 10 && !clicked; i++) {
      clicked = await js(`(() => { const b = document.getElementById(${JSON.stringify(restore ? 'restore-yes' : 'restore-no')}); if (!b) return false; b.click(); return true; })()`);
      if (!clicked) await sleep(500);
    }
    if (clicked) await sleep(restore ? 2500 : 800);
    await js(`window.alert = (m) => console.log('ALERT', m); 0`); // 하네스가 멈추지 않게
    return clicked;
  };

  await load(`${BASE}/`);

  // 팝오버·범례 칸 위치 (DOMRect 는 IPC 로 안 넘어온다 → toJSON)
  const geom = (layerId, cls) => js(`(() => {
    const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    const pop = document.querySelector('.class-fill-popover');
    return { map: r(document.getElementById('map')), pop: r(pop),
      swatch: r(document.querySelector('#choropleth-legend-${layerId} .choropleth-legend-color[data-class="${cls}"]')),
      legend: r(document.getElementById('choropleth-legend-${layerId}')),
      text: pop ? pop.textContent : '' };
  })()`);
  const swatchSel = (layerId, cls) => `#choropleth-legend-${layerId} .choropleth-legend-color[data-class="${cls}"]`;
  const clickSwatch = (layerId, cls) => js(`document.querySelector('${swatchSel(layerId, cls)}').click()`);
  const hasTile = (layerId, cls) => js(`document.querySelector('${swatchSel(layerId, cls)}').style.backgroundImage.startsWith('url("data:image/png')`);
  const fillsOf = (layerId) => js(`JSON.parse(JSON.stringify(__egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig.fills || null))`);
  /** 그 구간에 드는 첫 피처의 OL 채움이 CanvasPattern 인가 */
  const olPattern = (layerId, cls) => js(`(() => {
    const info = __egisDebug.layerManager.getLayer('${layerId}');
    const cfg = info._choroplethConfig;
    const feat = info.source.getFeatures().find((f) => __egisDebug.choroplethTool.getColorIndex(parseFloat(f.get(cfg.attribute)), cfg.breaks) === ${cls});
    if (!feat) return 'no feature';
    const color = info.olLayer.getStyle()(feat).getFill().getColor();
    return color instanceof CanvasPattern ? 'pattern' : typeof color + ':' + String(color);
  })()`);

  // 0. 단계구분도 준비 — 서울 자치구 + 심은 값
  let layerId = await js(`(async () => {
    await __egisDebug.builtinDataManager.loadCatalogs(); // 보통은 데이터 불러오기 창이 읽는다
    const { layerId } = await __egisDebug.builtinDataManager.loadPracticeDataset('area-data', 'seoul-gu');
    const info = __egisDebug.layerManager.getLayer(layerId);
    info.source.getFeatures().forEach((f, i) => f.set('val', (i * 37) % 100));
    const r = __egisDebug.choroplethTool.apply(layerId, 'val', 'blues', 'quantile', 5);
    return r.layerId;
  })()`);
  await sleep(500);
  await js(`__egisDebug.layerManager.zoomToLayer('${layerId}')`); // 서울이 화면에 차야 채움이 보인다
  await sleep(2500);
  check('choropleth legend with 5 swatches', await js(`document.querySelectorAll('#choropleth-legend-${layerId} .choropleth-legend-color[data-class]').length === 5`));
  await capture(win, 'class-fill-00-before');

  // 1. 실험이 꺼져 있으면 칸을 눌러도 팝오버가 없다
  await clickSwatch(layerId, 2);
  await sleep(300);
  check('no popover while lab off', await js(`!document.querySelector('.class-fill-popover') && !document.getElementById('map').classList.contains('labs-class-fill')`));

  // 2. 켜기 → 칸 클릭 → 팝오버 (단색 탭, 탭 넷, 이모지 없음, 지도 안, 칸 오른쪽)
  await js(`__egisDebug.labs.set('class-fill', true)`);
  await sleep(200);
  check('map has labs-class-fill class', await js(`document.getElementById('map').classList.contains('labs-class-fill')`));
  await clickSwatch(layerId, 2);
  await sleep(400);
  check('popover opened for class 2', await js(`document.querySelector('.class-fill-popover .class-fill-title')?.textContent === '3구간 채움'`));
  check('solid tab selected, four tabs', await js(`document.querySelectorAll('.class-fill-kind').length === 4 && document.querySelector('.class-fill-kind[aria-selected="true"]')?.dataset.kind === 'solid'`));
  let g = await geom(layerId, 2);
  check('popover has no emoji', !/\p{Extended_Pictographic}/u.test(g.text));
  check('popover inside #map', !!g.pop && g.pop.left >= g.map.left && g.pop.right <= g.map.right && g.pop.top >= g.map.top && g.pop.bottom <= g.map.bottom);
  check('popover right of swatch (pop.left == swatch.right + 8)', !!g.pop && near(g.pop.left, g.swatch.right + 8, 2));
  check('popover width about 280px', !!g.pop && g.pop.width >= 260 && g.pop.width <= 320);
  await capture(win, 'class-fill-01-popover');

  // 3. 패턴 탭 → 사선 간격 6 → 지도 채움이 CanvasPattern, 범례 칸이 타일
  await js(`document.querySelector('.class-fill-kind[data-kind="pattern"]').click()`);
  await sleep(300);
  await js(`(() => { const el = document.querySelector('.cf-spacing'); el.value = 6; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(600);
  let fills = await fillsOf(layerId);
  check('cfg.fills[2] is hatch spacing 6', !!fills && fills[2].kind === 'hatch' && fills[2].spacing === 6);
  const ol2 = await olPattern(layerId, 2);
  check('OL fill is CanvasPattern for class 2 (' + ol2 + ')', ol2 === 'pattern');
  check('legend swatch 2 has tile image', await hasTile(layerId, 2));
  check('legend swatch 0 still solid', !(await hasTile(layerId, 0)));
  // 범례 항목이 다시 그려져도(innerHTML) 팝오버는 칸 옆에 남아야 한다
  g = await geom(layerId, 2);
  const stillNext = !!g.pop && near(g.pop.left, g.swatch.right + 8, 2) && g.pop.left >= g.map.left && g.pop.right <= g.map.right;
  if (!stillNext) console.log('  popover', JSON.stringify(g.pop), 'swatch', JSON.stringify(g.swatch), 'map.left', g.map && g.map.left);
  check('popover still next to swatch after restyle', stillNext);
  await capture(win, 'class-fill-02-hatch');

  // 4. 질감 탭 → 숲
  await js(`document.querySelector('.class-fill-kind[data-kind="texture"]').click()`);
  await sleep(300);
  await js(`document.querySelector('.cf-texture[data-name="forest"]').click()`);
  await sleep(600);
  fills = await fillsOf(layerId);
  check('cfg.fills[2] is forest texture', !!fills && fills[2].kind === 'texture' && fills[2].name === 'forest');
  check('forest button pressed', await js(`document.querySelector('.cf-texture[data-name="forest"]').getAttribute('aria-pressed') === 'true'`));
  await capture(win, 'class-fill-03-texture');

  // 5. 프리셋 bw-hatch → 다섯 구간 모두 사선, 높은 구간일수록 촘촘
  await js(`(() => { const s = document.querySelector('.class-fill-preset'); s.value = 'bw-hatch'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('.class-fill-preset-apply').click(); })()`);
  await sleep(800);
  fills = await fillsOf(layerId);
  check('all five classes hatch', !!fills && fills.length === 5 && fills.every((f) => f.kind === 'hatch'));
  check('hatch spacing tightens with class', !!fills && fills[0].spacing > fills[2].spacing && fills[2].spacing > fills[4].spacing);
  let tiles = 0;
  for (let i = 0; i < 5; i++) if (await hasTile(layerId, i)) tiles++;
  check('all five swatches tiled', tiles === 5);
  check('popover shows pattern tab after preset', await js(`document.querySelector('.class-fill-kind[aria-selected="true"]')?.dataset.kind === 'pattern'`));
  await js(`document.querySelector('.class-fill-close').click()`);
  await sleep(300);
  check('close button closes popover', await js(`!document.querySelector('.class-fill-popover')`));
  await capture(win, 'class-fill-04-preset');

  // 6. 저장 왕복·복제 — fills 가 따라오고 공유되지 않는다
  check('serialize carries fills', await js(`(() => {
    const data = __egisDebug.projectManager.serialize();
    const l = data.layers.find((x) => x.choroplethConfig && x.choroplethConfig.fills);
    return !!l && l.choroplethConfig.fills.length === 5 && !('tool' in l.choroplethConfig);
  })()`));
  check('duplicate does not share fills', await js(`(() => {
    const dupId = __egisDebug.layerManager.duplicateLayer('${layerId}');
    const a = __egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig.fills;
    const b = __egisDebug.layerManager.getLayer(dupId)._choroplethConfig.fills;
    const ok = a !== b && a[0] !== b[0] && b[0].kind === 'hatch';
    __egisDebug.layerManager.removeLayer(dupId);
    return ok;
  })()`));
  await sleep(500);

  // 7. 내보내기 범례 — 미리보기에 패턴이 찍힌다 (육안)
  await js(`document.querySelector('[data-action="project-export"]').click()`);
  await sleep(1500);
  await js(`(() => { const cb = document.getElementById('opt-legend'); if (cb && !cb.checked) cb.click(); })()`);
  await sleep(2500);
  check('export preview canvas drawn', await js(`(() => { const c = document.getElementById('preview-canvas'); return !!c && c.width > 0; })()`));
  await js(`document.getElementById('preview-expand').click()`);
  await sleep(1500);
  await capture(win, 'class-fill-05-export-legend');
  await js(`document.getElementById('zoom-modal-close')?.click()`);
  await sleep(300);
  await js(`document.getElementById('export-close')?.click()`);
  await sleep(500);

  // 8. 새로고침 → 자동 저장 복원 → 채움이 그대로 (실험 켜짐도 localStorage 로 유지)
  await sleep(1500); // 자동 저장 1초 디바운스
  const restored = await load(`${BASE}/`, true);
  check('restore prompt shown after reload', restored);
  layerId = await js(`(() => { const l = __egisDebug.layerManager.getAllLayers().find((x) => x.type === 'choropleth'); return l ? l.id : null; })()`);
  check('choropleth layer restored', !!layerId);
  if (layerId) {
    fills = await fillsOf(layerId);
    check('fills restored (5 hatch)', !!fills && fills.length === 5 && fills.every((f) => f.kind === 'hatch'));
    const olR = await olPattern(layerId, 4);
    check('OL fill is CanvasPattern after restore (' + olR + ')', olR === 'pattern');
    check('legend swatch 4 tiled after restore', await hasTile(layerId, 4));
    check('lab still on after reload', await js(`document.getElementById('map').classList.contains('labs-class-fill')`));
    await js(`__egisDebug.layerManager.zoomToLayer('${layerId}')`); // 지도 위치는 복원 대상이 아니라 다시 당긴다
    await sleep(2500);
  }
  await capture(win, 'class-fill-05b-restored');

  // 9. 되돌리기 → Esc → 바깥 클릭 → 끌기 가드 → 끄기 → 원상
  await clickSwatch(layerId, 0);
  await sleep(400);
  check('popover reopened after reload', await js(`!!document.querySelector('.class-fill-popover')`));
  await js(`document.querySelector('.class-fill-reset').click()`);
  await sleep(600);
  check('fills removed after reset', await js(`!('fills' in __egisDebug.layerManager.getLayer('${layerId}')._choroplethConfig)`));
  check('swatches solid after reset', !(await hasTile(layerId, 0)) && !(await hasTile(layerId, 4)));
  check('popover still open after reset', await js(`!!document.querySelector('.class-fill-popover')`));

  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 0`);
  await sleep(300);
  check('Esc closes popover', await js(`!document.querySelector('.class-fill-popover')`));

  // 바깥 클릭: 지도 한가운데(범례·패널 밖)를 진짜 마우스로
  await clickSwatch(layerId, 1);
  await sleep(400);
  g = await geom(layerId, 1);
  const mx = Math.round(g.map.left + g.map.width * 0.6), my = Math.round(g.map.top + g.map.height * 0.25);
  wc.sendInputEvent({ type: 'mouseDown', x: mx, y: my, button: 'left', clickCount: 1 });
  await sleep(80);
  wc.sendInputEvent({ type: 'mouseUp', x: mx, y: my, button: 'left', clickCount: 1 });
  await sleep(400);
  check('outside click closes popover', await js(`!document.querySelector('.class-fill-popover')`));

  // 끌기 가드: 칸을 잡고 40px 끌어 놓으면 팝오버가 안 뜬다(범례가 이동한다), 이어서 그냥 누르면 뜬다
  g = await geom(layerId, 1);
  const sx = Math.round(g.swatch.left + g.swatch.width / 2), sy = Math.round(g.swatch.top + g.swatch.height / 2);
  const dragBy = async (dx) => {
    wc.sendInputEvent({ type: 'mouseDown', x: sx, y: sy, button: 'left', clickCount: 1 });
    await sleep(80);
    for (let i = 1; i <= 4; i++) { wc.sendInputEvent({ type: 'mouseMove', x: sx + Math.round(dx * i / 4), y: sy }); await sleep(40); }
    wc.sendInputEvent({ type: 'mouseUp', x: sx + dx, y: sy, button: 'left', clickCount: 1 });
    await sleep(400);
  };
  const legendBefore = g.legend;
  await dragBy(40);
  g = await geom(layerId, 1);
  check('drag moves the legend (+40px)', near(g.legend.left, legendBefore.left + 40, 3));
  check('drag-then-release opens no popover', await js(`!document.querySelector('.class-fill-popover')`));
  // 제자리로 (캡처 06 이 00 과 같게)
  const sx2 = sx + 40;
  wc.sendInputEvent({ type: 'mouseDown', x: sx2, y: sy, button: 'left', clickCount: 1 });
  await sleep(80);
  for (let i = 1; i <= 4; i++) { wc.sendInputEvent({ type: 'mouseMove', x: sx2 - Math.round(40 * i / 4), y: sy }); await sleep(40); }
  wc.sendInputEvent({ type: 'mouseUp', x: sx, y: sy, button: 'left', clickCount: 1 });
  await sleep(400);
  g = await geom(layerId, 1);
  check('legend dragged back', near(g.legend.left, legendBefore.left, 3));
  check('still no popover after second drag', await js(`!document.querySelector('.class-fill-popover')`));
  wc.sendInputEvent({ type: 'mouseDown', x: sx, y: sy, button: 'left', clickCount: 1 });
  await sleep(80);
  wc.sendInputEvent({ type: 'mouseUp', x: sx, y: sy, button: 'left', clickCount: 1 });
  await sleep(400);
  check('plain mouse click opens popover for class 1', await js(`document.querySelector('.class-fill-popover .class-fill-title')?.textContent === '2구간 채움'`));

  await js(`__egisDebug.labs.set('class-fill', false)`);
  await sleep(300);
  check('popover closed and class removed when lab off', await js(`!document.querySelector('.class-fill-popover') && !document.getElementById('map').classList.contains('labs-class-fill')`));
  await clickSwatch(layerId, 2);
  await sleep(300);
  check('click does nothing when lab off', await js(`!document.querySelector('.class-fill-popover')`));
  // 단색 칸은 background 축약형이라 backgroundImage 가 'initial' — url( 로 시작하는지만 본다
  check('legend still rendered with 5 solid swatches', await js(`(() => { const s = document.querySelectorAll('#choropleth-legend-${layerId} .choropleth-legend-color[data-class]'); return s.length === 5 && [...s].every((el) => !el.style.backgroundImage.startsWith('url(')); })()`));
  await capture(win, 'class-fill-06-after');

  app.exit(process.exitCode || 0); // app.quit() 은 process.exitCode 를 무시한다
});
