// © 2026 김용현
/**
 * 실험실 3단계(스와이프 비교) 화면 검증 — 사용자처럼 버튼을 누르고 막대를 끈다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-swipe.cjs
 *   (Electron 은 eStoryMap/node_modules 에 있다 — .claude/skills/verify/SKILL.md)
 * 결과: scripts/verify/out/swipe-*.png 와 콘솔 판정
 *
 * 픽셀 검사: 내장 「대한민국 시도」를 불투명 빨강으로 칠하고 zoomToLayer 한 뒤,
 * capturePage 비트맵에서 막대 한쪽 40px 은 빨갛고 반대쪽 40px 은 아니어야 한다.
 * (OL 캔버스 getImageData 는 배경 타일 CORS 에 따라 오염될 수 있어 창 캡처를 읽는다.)
 * 시도 범위의 가운데(대구·구미 부근)는 육지라 ±40px 도 육지다.
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
const SIDO_URL = "encodeURI('./data/builtin/practice/Area Data/행정경계/대한민국 시도(2026.07.01.~).geojson')";

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

/** 캡처 비트맵에서 창 CSS 좌표 (x, y) 의 [r, g, b] (Windows 비트맵은 BGRA).
 *  getSize() 는 물리 픽셀이다(이 PC 는 배율 약 1.5) — cssWidth(window.innerWidth)로 나눠 배율을 구한다. */
function pixelAt(img, x, y, cssWidth) {
  if (!img || img.isEmpty()) return null;
  const { width, height } = img.getSize();
  const buf = img.toBitmap();
  if (buf.length !== width * height * 4) return null;
  const scale = width / cssWidth;
  const px = Math.round(x * scale), py = Math.round(y * scale);
  const i = (py * width + px) * 4;
  return [buf[i + 2], buf[i + 1], buf[i]];
}

const isRed = (px) => !!px && px[0] > 170 && px[1] < 110 && px[2] < 110;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const js = (c) => win.webContents.executeJavaScript(c);
  const wc = win.webContents;
  wc.on('will-prevent-unload', (e) => e.preventDefault());
  // 막대 끌기는 CDP Input.dispatchMouseEvent 로 한다. webContents.sendInputEvent 로 만든 포인터는
  // pointerType 이 '' 이고 setPointerCapture 가 잡히지 않아 이동이 지도로 새 나간다(하네스 환경 탓).
  wc.debugger.attach('1.3');
  const cdpMouse = (type, x, y, buttons) => wc.debugger.sendCommand('Input.dispatchMouseEvent',
    { type, x: Math.round(x), y: Math.round(y), button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
  /** 사용자처럼 (x0,y0) 을 누르고 10걸음에 (x1,y1) 로 끌어 놓는다 */
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
  const errors = [];
  wc.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });

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
  await js(`window.alert = (m) => console.log('ALERT', m); 0`);
  await js(`window.__swipeErrors = []; window.addEventListener('error', (e) => window.__swipeErrors.push(String(e.message))); 0`);

  const toggleVisible = `(() => { const b = document.getElementById('swipe-toggle'); return b.hidden === false && getComputedStyle(b).display !== 'none'; })()`;
  const toggleHidden = `(() => { const b = document.getElementById('swipe-toggle'); return b.hidden === true && getComputedStyle(b).display === 'none'; })()`;
  const mapRect = () => js(`document.getElementById('map').getBoundingClientRect().toJSON()`);
  const setSelect = (id, value) => js(`(() => { const s = document.getElementById('${id}'); s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);

  // 0. 실험이 꺼져 있으면 토글이 안 보인다
  check('toggle hidden when lab off', await js(toggleHidden));
  const baseLayerCount = await js(`__egisDebug.mapManager.getMap().getLayers().getLength()`);

  // 1. 내장 폴리곤(시도)을 올리고 불투명 빨강으로 칠한 뒤 화면에 채운다
  const layerId = await js(`__egisDebug.geojsonLoader.loadFromUrl(${SIDO_URL}, '시도')`);
  await sleep(1500);
  await js(`(() => { const lm = __egisDebug.layerManager; lm.setLayerFillColor('${layerId}', '#e60012'); lm.setLayerFillOpacity('${layerId}', 1); lm.setLayerStrokeColor('${layerId}', '#e60012'); })()`);
  await js(`__egisDebug.layerManager.zoomToLayer('${layerId}')`);
  await sleep(2500);
  check('layer loaded', await js(`__egisDebug.layerManager.getAllLayers().length === 1`));

  // 2. 실험 켜기 → 토글 보임 (새로고침 없이), 실험실 버튼 바로 뒤
  await js(`__egisDebug.labs.set('swipe', true)`);
  await sleep(200);
  check('toggle visible when lab on', await js(toggleVisible));
  check('toggle sits after the labs button', await js(`(() => { const p = document.getElementById('swipe-toggle').previousElementSibling; return !!p && p.dataset.tool === 'labs'; })()`));
  await capture(win, 'swipe-01-toggle');

  // 3. 토글 클릭 → 박스·막대(세로, 50%), 대상은 맨 위 레이어(시도)
  await js(`document.getElementById('swipe-toggle').click()`);
  await sleep(600);
  check('controls and divider shown', await js(`!document.getElementById('swipe-controls').hidden && getComputedStyle(document.getElementById('swipe-controls')).display !== 'none' && !document.getElementById('swipe-divider').hidden && getComputedStyle(document.getElementById('swipe-divider')).display !== 'none'`));
  check('divider vertical at 50%', await js(`(() => { const d = document.getElementById('swipe-divider'); return !d.classList.contains('horizontal') && d.style.left === '50%' && d.getAttribute('aria-orientation') === 'vertical'; })()`));
  check('default ratio 0.5', await js(`__egisDebug.swipePanel.tool.ratio === 0.5 && __egisDebug.swipePanel.tool.orientation === 'vertical'`));
  check('first target is the layer', await js(`document.getElementById('swipe-target').value === 'layer:${layerId}'`));
  const opts = await js(`(() => {
    const s = document.getElementById('swipe-target');
    const groups = [...s.querySelectorAll('optgroup')].map((g) => ({ label: g.label, values: [...g.querySelectorAll('option')].map((o) => o.value) }));
    return { groups, current: __egisDebug.mapManager.getBasemap() };
  })()`);
  console.log('  options', JSON.stringify(opts));
  const bmGroup = opts.groups.find((g) => g.label === '배경지도');
  check('select lists layer group and 배경지도 group', opts.groups.length === 2 && opts.groups[0].label === '레이어' && opts.groups[0].values.includes(`layer:${layerId}`) && !!bmGroup && bmGroup.values.length > 0);
  check('배경지도 group excludes current basemap (' + opts.current + ')', !!bmGroup && !bmGroup.values.includes(`basemap:${opts.current}`) && bmGroup.values.includes('basemap:SATELLITE'));
  check('toggle pressed', await js(`document.getElementById('swipe-toggle').getAttribute('aria-pressed') === 'true' && document.getElementById('swipe-toggle').classList.contains('active')`));
  const boxGeom = await js(`(() => {
    const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    return { box: r(document.getElementById('swipe-controls')), zoom: r(document.querySelector('.ol-zoom')), basemap: r(document.querySelector('.egis-basemap')), compass: r(document.querySelector('.egis-compass')), text: document.getElementById('swipe-controls').textContent };
  })()`);
  const clear = (a, b) => !a || !b || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
  check('box does not cover map controls (zoom/compass/basemap)', clear(boxGeom.box, boxGeom.zoom) && clear(boxGeom.box, boxGeom.compass) && clear(boxGeom.box, boxGeom.basemap));
  check('box has no emoji', !/\p{Extended_Pictographic}/u.test(boxGeom.text));

  // 4. 픽셀: 막대(50%) 왼쪽 40px 은 빨강, 오른쪽 40px 은 아님
  await sleep(1500);   // 타일·렌더 안정
  let rect = await mapRect();
  const cxAbs = rect.left + rect.width / 2, cyAbs = rect.top + rect.height / 2;
  const cssW = await js(`window.innerWidth`);
  const at = (im, x, y) => pixelAt(im, x, y, cssW);
  let img = await capture(win, 'swipe-02-vertical');
  let left = at(img, cxAbs - 40, cyAbs), right = at(img, cxAbs + 40, cyAbs);
  console.log('  pixels 50%', JSON.stringify({ left, right }));
  check('left of divider is red', isRed(left));
  check('right of divider is not red', !isRed(right));
  // 막대 선의 위치 = 클립 경계
  const lineX = await js(`(() => { const d = document.getElementById('swipe-divider').getBoundingClientRect(); return d.left + d.width / 2; })()`);
  check('divider line at clip edge (map centre)', Math.abs(lineX - cxAbs) <= 1);

  // 5. 막대를 손잡이로 잡아 오른쪽으로 200px 끈다 — 전에 안 빨갛던 자리(cx+40)가 이제 빨갛다.
  //    (왼쪽 25% 는 서해라 새 경계 왼쪽이 원래 빨갛지 않다 — 경계가 육지(경북)에 오도록 오른쪽으로 끈다)
  const handle = await js(`(() => { const r = document.querySelector('#swipe-divider .swipe-handle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const targetX = handle.x + 200;
  const expectRatio = (targetX - rect.left) / rect.width;
  const viewBeforeDrag = await js(`__egisDebug.mapManager.getMap().getView().getCenter()`);
  await drag(handle.x, handle.y, targetX, handle.y);
  const ratio = await js(`__egisDebug.swipePanel.tool.ratio`);
  console.log('  ratio after drag', ratio);
  check(`ratio moved to ~${expectRatio.toFixed(3)} (+200px)`, Math.abs(ratio - expectRatio) < 0.01);
  // 인라인 % 는 브라우저가 소수 넷째 자리로 줄여 보관한다 — 숫자로 비교
  const leftStyle = await js(`document.getElementById('swipe-divider').style.left`);
  check(`divider follows (style.left ${leftStyle})`, leftStyle.endsWith('%') && Math.abs(parseFloat(leftStyle) - ratio * 100) < 0.001);
  check('drag state cleared after mouseUp', await js(`__egisDebug.swipePanel.dragging === false`));
  img = await capture(win, 'swipe-03-dragged');
  const edgeX = rect.left + rect.width * ratio;
  const oldRight = at(img, cxAbs + 40, cyAbs);
  const newLeft = at(img, edgeX - 40, cyAbs), newRight = at(img, edgeX + 40, cyAbs);
  console.log('  pixels dragged', JSON.stringify({ oldRight, newLeft, newRight }));
  check('old right sample (cx+40) now red', isRed(oldRight));
  check('clip moved with the divider (left of new edge red, right not)', isRed(newLeft) && !isRed(newRight));
  // 드래그 뒤 지도가 같이 끌리지 않았어야 한다(막대 pointerdown 이 지도 팬을 막는다)
  const viewAfterDrag = await js(`__egisDebug.mapManager.getMap().getView().getCenter()`);
  check('dragging the divider does not pan the map', Math.abs(viewAfterDrag[0] - viewBeforeDrag[0]) < 1 && Math.abs(viewAfterDrag[1] - viewBeforeDrag[1]) < 1);

  // 6. 배경지도 대상 (Esri 위성 — 키 없이 된다) → 임시 레이어가 index 1, 레이어 클립 해제
  await setSelect('swipe-target', 'basemap:SATELLITE');
  await sleep(5000);   // 위성 타일 로드
  check('temp basemap layer at index 1', await js(`(() => { const p = __egisDebug.swipePanel; const m = __egisDebug.mapManager.getMap(); return !!p.tempLayer && m.getLayers().item(1) === p.tempLayer && p.tool.target === p.tempLayer; })()`));
  check('layer clip released', await js(`(() => { const l = __egisDebug.layerManager.getLayer('${layerId}').olLayer; const ls = l.getListeners ? l.getListeners('prerender') : undefined; return !ls || ls.length === 0; })()`));
  img = await capture(win, 'swipe-04-basemap');
  // 레이어는 이제 안 잘린다 → 막대 양쪽 모두 빨강
  const bl = at(img, cxAbs - 40, cyAbs), br = at(img, cxAbs + 40, cyAbs);   // 둘 다 육지(구미·대구)
  console.log('  pixels basemap target', JSON.stringify({ bl, br }));
  check('layer drawn on both sides with basemap target', isRed(bl) && isRed(br));

  // 7. 레이어 대상으로 돌아가면 임시 배경지도가 빠진다
  await setSelect('swipe-target', `layer:${layerId}`);
  await sleep(600);
  check('temp basemap removed when target is a layer', await js(`__egisDebug.swipePanel.tempLayer === null && __egisDebug.mapManager.getMap().getLayers().getArray().every((l) => l.get('name') !== 'swipe-basemap')`));
  check('map layer count back to base + 1', await js(`__egisDebug.mapManager.getMap().getLayers().getLength()`) === baseLayerCount + 1);

  // 8. 가로 방향 → 막대 가로, 위쪽만 레이어
  await setSelect('swipe-orientation', 'horizontal');
  await sleep(800);
  const hState = await js(`(() => { const d = document.getElementById('swipe-divider'); return { cls: d.classList.contains('horizontal'), top: d.style.top, left: d.style.left, aria: d.getAttribute('aria-orientation'), orient: __egisDebug.swipePanel.tool.orientation, ratio: __egisDebug.swipePanel.tool.ratio }; })()`);
  console.log('  horizontal', JSON.stringify(hState));
  check('orientation keeps ratio', Math.abs(hState.ratio - ratio) < 1e-9);
  check('horizontal divider', hState.cls && hState.orient === 'horizontal' && hState.aria === 'horizontal' && hState.top.endsWith('%') && Math.abs(parseFloat(hState.top) - hState.ratio * 100) < 0.001 && (hState.left === '0' || hState.left === '0px'));
  // 방향을 바꿔도 비율은 그대로(약 0.65) — 막대를 위로 55% 까지 끈다
  const hTargetY = rect.top + rect.height * 0.55;
  const hHandle = await js(`(() => { const r = document.querySelector('#swipe-divider .swipe-handle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await drag(hHandle.x, hHandle.y, hHandle.x, hTargetY);
  const hRatio = await js(`__egisDebug.swipePanel.tool.ratio`);
  console.log('  ratio after horizontal drag', hRatio);
  check('horizontal drag moves ratio to ~0.55', Math.abs(hRatio - 0.55) < 0.01);
  const lineY = await js(`(() => { const d = document.getElementById('swipe-divider').getBoundingClientRect(); return d.top + d.height / 2; })()`);
  img = await capture(win, 'swipe-05-horizontal');
  const edgeY = rect.top + rect.height * hRatio;
  check('horizontal line at clip edge', Math.abs(lineY - edgeY) <= 1);
  // 막대 손잡이를 피해 막대 왼쪽 100px 에서 위·아래를 본다
  const top = at(img, cxAbs - 100, edgeY - 40), bottom = at(img, cxAbs - 100, edgeY + 40);
  console.log('  pixels horizontal', JSON.stringify({ top, bottom }));
  check('above horizontal divider is red', isRed(top));
  check('below horizontal divider is not red', !isRed(bottom));
  // 세로로 되돌린다
  await setSelect('swipe-orientation', 'vertical');
  await sleep(300);

  // 9. 글래스 켜기 → 막대가 보이는 지도 칸으로 밀리고 박스가 위 오프셋 아래로
  await js(`__egisDebug.labs.set('glass', true)`);
  await sleep(1500);
  const glass = await js(`(() => {
    const cs = getComputedStyle(document.getElementById('map-container'));
    const d = getComputedStyle(document.getElementById('swipe-divider'));
    const b = getComputedStyle(document.getElementById('swipe-controls'));
    return { attr: document.documentElement.getAttribute('data-surface'), desktop: matchMedia('(min-width: 1025px) and (pointer: fine)').matches,
      offTop: parseFloat(cs.getPropertyValue('--glass-top-offset')) || 0, offBottom: parseFloat(cs.getPropertyValue('--glass-bottom-offset')) || 0, offPanel: parseFloat(cs.getPropertyValue('--glass-panel-offset')) || 0,
      marginTop: parseFloat(d.marginTop), boxTop: parseFloat(b.top), ratio: __egisDebug.swipePanel.tool.ratio,
      mapW: document.getElementById('map').getBoundingClientRect().width };
  })()`);
  console.log('  glass', JSON.stringify(glass));
  if (glass.attr === 'glass' && glass.desktop && glass.offTop > 0) {
    check('glass: divider margin-top == --glass-top-offset', Math.abs(glass.marginTop - glass.offTop) < 0.5);
    check('glass: box top == offset + 12', Math.abs(glass.boxTop - (glass.offTop + 12)) < 0.5);
    check('glass: ratio kept inside visible map (>= panel offset)', glass.ratio >= glass.offPanel / glass.mapW - 1e-6);
  } else {
    skip('glass interplay', `glass not active on desktop (attr=${glass.attr}, desktop=${glass.desktop}, offTop=${glass.offTop})`);
  }
  await js(`__egisDebug.labs.set('glass', false)`);
  await sleep(1000);
  check('glass off: divider margin-top back to 0', await js(`parseFloat(getComputedStyle(document.getElementById('swipe-divider')).marginTop) === 0`));
  check('swipe still active across glass toggles', await js(`__egisDebug.swipePanel.isActive()`));

  // 10. 대상 레이어를 지우면 조용히 끝난다
  await js(`__egisDebug.layerManager.removeLayer('${layerId}')`);
  await sleep(500);
  check('ends when target layer removed', await js(`!__egisDebug.swipePanel.isActive() && document.getElementById('swipe-divider').hidden && document.getElementById('swipe-controls').hidden`));
  check('toggle unpressed', await js(`document.getElementById('swipe-toggle').getAttribute('aria-pressed') === 'false' && !document.getElementById('swipe-toggle').classList.contains('active')`));
  check('no page errors so far', await js(`window.__swipeErrors.length === 0`));

  // 11. 다시 열고 배경지도 대상으로 둔 채 실험을 끄면 끝나고 토글이 숨고 임시 레이어가 빠진다
  const layer2 = await js(`__egisDebug.geojsonLoader.loadFromUrl(${SIDO_URL}, '시도')`);
  await sleep(1500);
  await js(`document.getElementById('swipe-toggle').click()`);
  await sleep(500);
  check('reopened', await js(`__egisDebug.swipePanel.isActive() && document.getElementById('swipe-target').value === 'layer:${layer2}'`));
  await setSelect('swipe-target', 'basemap:SATELLITE');
  await sleep(500);
  check('temp basemap present before lab off', await js(`!!__egisDebug.swipePanel.tempLayer`));
  await js(`__egisDebug.labs.set('swipe', false)`);
  await sleep(300);
  check('lab off ends swipe and hides toggle', await js(`!__egisDebug.swipePanel.isActive() && document.getElementById('swipe-controls').hidden && document.getElementById('swipe-divider').hidden`) && await js(toggleHidden));
  check('lab off removes temp basemap', await js(`__egisDebug.swipePanel.tempLayer === null && __egisDebug.mapManager.getMap().getLayers().getLength() === ${baseLayerCount + 1}`));
  await capture(win, 'swipe-06-off');

  // 12. 3D 배타 — 스와이프를 연 채 3D 를 켜면 스와이프가 닫힌다
  await js(`__egisDebug.labs.set('swipe', true)`);
  await sleep(200);
  await js(`document.getElementById('swipe-toggle').click()`);
  await sleep(500);
  check('open again before 3D', await js(`__egisDebug.swipePanel.isActive()`));
  let view3dOk = true;
  try {
    await js(`document.getElementById('view3d-toggle').click(); 0`);
    await sleep(5000);
  } catch (err) {
    view3dOk = false;
    skip('3D exclusivity', 'view3d click threw: ' + err.message);
  }
  if (view3dOk) {
    check('3D on closes swipe', await js(`!__egisDebug.swipePanel.isActive() && document.getElementById('swipe-controls').hidden && document.getElementById('swipe-divider').hidden`));
    const on3d = await js(`(() => { const b = document.getElementById('view3d-toggle'); return b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true'; })()`);
    if (on3d) {
      await capture(win, 'swipe-07-view3d');
      await js(`document.getElementById('swipe-toggle').click()`);
      await sleep(400);
      check('swipe refuses to open while 3D is on', await js(`!__egisDebug.swipePanel.isActive() && document.getElementById('swipe-controls').hidden`));
      await js(`document.getElementById('view3d-toggle').click(); 0`);
      await sleep(2000);
    } else {
      skip('swipe refuses to open while 3D is on', '3D view did not become active in this Electron (software rendering)');
    }
  }

  console.log('  console errors', JSON.stringify(errors.filter((m) => !/indexeddb|quota|cache|favicon/i.test(m)).slice(0, 10)));
  console.log('  page errors', JSON.stringify(await js(`window.__swipeErrors`)));
  app.exit(process.exitCode || 0); // app.quit() 은 process.exitCode 를 무시한다
});
