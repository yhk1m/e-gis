// © 2026 김용현
/**
 * 실험실 4단계(시계열 단계구분도) 화면 검증 — 사용자처럼 메뉴와 슬라이더를 누른다.
 * 실행: cd eStoryMap && npx electron ../scripts/verify/labs-time-series.cjs
 *   (Electron 은 eStoryMap/node_modules 에 있다 — .claude/skills/verify/SKILL.md)
 *   EGIS_URL (기본 http://localhost:4173) 은 이 작업 트리 dist 의 vite preview 여야 한다.
 * 결과: scripts/verify/out/ts-*.png, out/ts-download.gif 와 콘솔 판정 (exit 0 = 전부 통과)
 *
 * 내장 자료에는 연도 열이 여러 개인 폴리곤이 없다. 내장 「서울 자치구」 GeoJSON 을 페이지 안에서
 * fetch 해 연도 열 6개(2015·2017·…·2025, 결정적 가짜 값)를 붙인 뒤 projectManager.deserialize 로 올린다.
 *
 * GIF 저장은 다운로드하지 않는다 — 페이지의 a.click 을 가로채 blob 을 읽고(바이트는 out/ 에만 쓴다),
 * 형식(image/gif)·크기·프레임 수(이미지 서술자 0x2C 개수 = 연도 수)·프레임 지연(1.2초)을 본다.
 * 동영상(MediaRecorder)은 헤드리스에서 믿을 수 없어 보지 않는다 — 배포 뒤 실제 크롬에서 본다.
 */
const { app, BrowserWindow, session } = require('electron');
app.disableHardwareAcceleration(); // 이 PC 는 GPU 드라이버 블루스크린 이력이 있다
const fs = require('fs');
const path = require('path');

const BASE = process.env.EGIS_URL || 'http://localhost:4173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
setTimeout(() => { console.error('WATCHDOG'); app.exit(2); }, 240000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const YEARS = ['2015', '2017', '2019', '2021', '2023', '2025'];
const DERIVED_NAME = '서울 자치구_시계열_2015~2025';

async function capture(win, name) {
  let img = null;
  for (let i = 0; i < 5 && (!img || img.isEmpty()); i++) {
    win.focus();
    await sleep(1500);
    img = await win.capturePage();
  }
  const png = img ? img.toPNG() : Buffer.alloc(0);
  fs.writeFileSync(path.join(OUT, `${name}.png`), png);
  console.log('captured', name, png.length);
  return img;
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  console.log(ok ? 'PASS' : 'FAIL', name, detail === undefined ? '' : `— ${detail}`);
  if (ok) passed++; else { failed++; process.exitCode = 1; }
}

/**
 * GIF 바이트를 블록 단위로 읽는다 (바이트 검색은 LZW 자료 속 0x2C 를 잘못 셀 수 있다).
 * @returns {{width, height, frames, delays: number[] (센티초), loop: boolean}|null}
 */
function parseGif(buf) {
  if (buf.length < 13 || buf.toString('ascii', 0, 3) !== 'GIF') return null;
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8);
  let p = 13;
  const packed = buf[10];
  if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1));   // 전역 팔레트
  const skipSub = () => { while (p < buf.length && buf[p] !== 0) p += buf[p] + 1; p++; };
  let frames = 0, loop = false;
  const delays = [];
  while (p < buf.length) {
    const b = buf[p++];
    if (b === 0x3B) break;                                  // 끝
    if (b === 0x21) {                                       // 확장
      const label = buf[p++];
      if (label === 0xF9) delays.push(buf.readUInt16LE(p + 2));   // 그래픽 제어: [크기 4][packed][지연 lo hi]...
      if (label === 0xFF && buf.toString('ascii', p + 1, p + 12) === 'NETSCAPE2.0') loop = true;
      skipSub();
    } else if (b === 0x2C) {                                // 이미지 서술자
      frames++;
      const ipacked = buf[p + 8];
      p += 9;
      if (ipacked & 0x80) p += 3 * (1 << ((ipacked & 7) + 1));   // 지역 팔레트
      p++;                                                  // LZW 최소 코드 크기
      skipSub();
    } else {
      return null;                                          // 망가진 파일
    }
  }
  return { width, height, frames, delays, loop };
}

/** 서울 자치구에 가상 연도 열 6개를 붙여 프로젝트로 올린다 (페이지 안에서 실행) */
const LOAD_DATA = `(async () => {
  const gj = await fetch(encodeURI('./data/builtin/practice/Area Data/행정경계/서울 자치구.geojson')).then(r => r.json());
  const YEARS = ${JSON.stringify(YEARS)};
  gj.features.forEach((f, i) => {
    const base = 200000 + i * 15000;
    YEARS.forEach((y, k) => { f.properties[y] = Math.round(base * (1 + 0.06 * k * ((i % 3) - 1)) + (i * 7919) % 30000); });
  });
  await __egisDebug.projectManager.deserialize({
    version: '1.0', name: 'ts-harness',
    layers: [{ id: 'ts-src', name: '서울 자치구', type: 'vector', geometryType: 'MultiPolygon', color: '#3b82f6', visible: true, features: gj }]
  });
  __egisDebug.layerManager.zoomToLayer('ts-src');
  return { layers: __egisDebug.layerManager.getAllLayers().length, features: gj.features.length };
})()`;

/** 파생 레이어의 피처별 채움색 (스타일 함수로 계산) */
const FILL_COLORS = `(() => {
  const info = __egisDebug.layerManager.getAllLayers().find(l => l.name === '${DERIVED_NAME}');
  if (!info) return null;
  const fn = info.olLayer.getStyleFunction ? info.olLayer.getStyleFunction() : null;
  return info.source.getFeatures().map(f => {
    try {
      let s = fn ? fn(f, 1) : info.olLayer.getStyle();
      if (Array.isArray(s)) s = s[0];
      const c = s && s.getFill && s.getFill() ? s.getFill().getColor() : null;
      return Array.isArray(c) ? c.join(',') : String(c);
    } catch (e) { return 'ERR ' + e.message; }
  });
})()`;

const LEGEND_ITEMS = `(() => { const el = document.querySelector('.choropleth-legend .choropleth-legend-items'); return el ? el.innerText.trim() : null; })()`;
const setRange = (i) => `(() => { const r = document.getElementById('ts-range'); r.value = '${i}'; r.dispatchEvent(new Event('input', { bubbles: true })); return r.value; })()`;
const FIELD = `(document.getElementById('ts-field') || {}).textContent`;
const SUBTITLE = `(document.querySelector('.choropleth-legend .choropleth-legend-subtitle') || {}).textContent`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true });
  const wc = win.webContents;
  const js = (c) => wc.executeJavaScript(c);
  wc.on('will-prevent-unload', (e) => e.preventDefault());
  const errors = [];
  wc.on('console-message', (_e, level, message) => { if (level >= 3) errors.push(message); });

  // 안전망: 가로채기를 빠져나간 진짜 다운로드는 취소하고 기록만 남긴다
  const leakedDownloads = [];
  session.defaultSession.on('will-download', (_e, item) => { leakedDownloads.push(item.getFilename()); item.cancel(); });

  // 조회수 카운터를 건드리지 않게, 앱을 띄우기 전에 같은 출처의 정적 파일에서 오늘(KST) 방문으로 표시
  await win.loadURL(`${BASE}/favicon.svg`);
  await js(`localStorage.setItem('egis_last_visit', new Date(Date.now() + 9*3600e3).toISOString().slice(0,10))`);
  await js(`localStorage.removeItem('eGIS_labs')`); // 이전 실행 잔재 제거
  await js(`indexedDB.databases().then(ds => Promise.all(ds.map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }))))`);

  const openApp = async (query = '') => {
    await win.loadURL(`${BASE}/${query}`);
    await sleep(3000);
    await js(`window.alert = (m) => console.log('ALERT', m); 0`);
    await js(`window.__tsErrors = []; window.addEventListener('error', (e) => window.__tsErrors.push(String(e.message))); 0`);
  };
  const dismissRestore = async (id) => {
    for (let i = 0; i < 10; i++) {
      const clicked = await js(`(() => { const b = document.getElementById('${id}'); if (!b) return false; b.click(); return true; })()`);
      if (clicked) return true;
      await sleep(500);
    }
    return false;
  };

  await openApp();
  await dismissRestore('restore-no');

  // 1. 실험 꺼짐: 메뉴 항목이 숨겨져 있다
  check('menu item hidden when lab off', await js(`document.querySelector('[data-action="analysis-time-series"]').hidden === true`));

  // 2. 자료 올리기 → 실험 켜기 → 메뉴 항목 보임 (새로고침 없이)
  const loaded = await js(LOAD_DATA);
  await sleep(2000);
  check('source layer loaded', loaded.layers === 1 && loaded.features === 25, JSON.stringify(loaded));
  await js(`__egisDebug.labs.set('time-series', true)`);
  await sleep(300);
  check('menu item visible when lab on', await js(`document.querySelector('[data-action="analysis-time-series"]').hidden === false`));

  // 3. 메뉴 → 설정 창 → 연도 자동 선택 → 적용
  await js(`document.querySelector('[data-menu="thematic-map"] .menu-button') && document.querySelector('[data-menu="thematic-map"] .menu-button').click(); 0`);
  await sleep(200);
  await js(`document.querySelector('[data-action="analysis-time-series"]').click()`);
  await sleep(500);
  check('panel opened from menu', await js(`!!document.querySelector('.time-series-modal')`));
  await js(`document.getElementById('ts-auto-years').click()`);
  const checkedFields = await js(`Array.from(document.querySelectorAll('.ts-field-check:checked')).map(b => b.value)`);
  check('auto-select checks the 6 year fields in order', JSON.stringify(checkedFields) === JSON.stringify(YEARS), JSON.stringify(checkedFields));
  check('panel has no emoji', !/\p{Extended_Pictographic}/u.test(await js(`document.querySelector('.time-series-modal').textContent`)));
  await capture(win, 'ts-01-panel');
  await js(`document.getElementById('ts-apply').click()`);
  await sleep(1000);
  check('panel closed after apply', await js(`!document.querySelector('.time-series-modal')`));
  check('derived layer created', await js(`__egisDebug.layerManager.getAllLayers().some(l => l.name === '${DERIVED_NAME}')`));
  const cfg0 = await js(`(() => { const c = __egisDebug.timeSeriesTool.config(); return c ? { ts: c.timeSeries, attribute: c.attribute } : null; })()`);
  check('config.timeSeries = { fields: 6 years, index: 0 }', !!cfg0 && JSON.stringify(cfg0.ts) === JSON.stringify({ fields: YEARS, index: 0 }) && cfg0.attribute === '2015', JSON.stringify(cfg0));
  check('controls shown at 2015', await js(`!!document.getElementById('time-series-controls') && ${FIELD} === '2015'`));
  check('slider range 0..5', await js(`document.getElementById('ts-range').min === '0' && document.getElementById('ts-range').max === '5' && document.getElementById('ts-range').value === '0'`));
  const sub0 = await js(SUBTITLE);
  check('legend subtitle 2015 (1/6)', sub0 === '2015 (1/6)', sub0);
  const legend0 = await js(LEGEND_ITEMS);
  const colors0 = await js(FILL_COLORS);
  const ctrlGeom = await js(`(() => {
    const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
    return { box: r(document.getElementById('time-series-controls')), map: r(document.getElementById('map')), legend: r(document.querySelector('.choropleth-legend')), text: document.getElementById('time-series-controls').textContent };
  })()`);
  const clear = (a, b) => !a || !b || a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
  const boxCx = ctrlGeom.box.left + ctrlGeom.box.width / 2, mapCx = ctrlGeom.map.left + ctrlGeom.map.width / 2;
  check('controls centred at map bottom', Math.abs(boxCx - mapCx) < 2 && ctrlGeom.box.bottom <= ctrlGeom.map.bottom && ctrlGeom.box.top > ctrlGeom.map.top + ctrlGeom.map.height / 2,
    `boxCx=${boxCx.toFixed(1)} mapCx=${mapCx.toFixed(1)} boxBottom=${ctrlGeom.box.bottom.toFixed(1)} mapBottom=${ctrlGeom.map.bottom.toFixed(1)}`);
  check('controls do not overlap legend', clear(ctrlGeom.box, ctrlGeom.legend));
  check('controls have no emoji', !/\p{Extended_Pictographic}/u.test(ctrlGeom.text));
  await capture(win, 'ts-02-year-2015');

  // 4. 슬라이더 이동 → 색이 바뀌고 부제가 따라온다, 범례 구간은 그대로(구간 고정)
  await js(setRange(3));
  await sleep(700);
  const sub3 = await js(SUBTITLE);
  check('slider moved to 2021', await js(`${FIELD} === '2021' && __egisDebug.timeSeriesTool.config().attribute === '2021' && __egisDebug.timeSeriesTool.config().timeSeries.index === 3`));
  check('legend subtitle 2021 (4/6)', sub3 === '2021 (4/6)', sub3);
  await capture(win, 'ts-03-year-2021');
  await js(setRange(5));
  await sleep(700);
  const sub5 = await js(SUBTITLE);
  const legend5 = await js(LEGEND_ITEMS);
  const colors5 = await js(FILL_COLORS);
  check('legend subtitle 2025 (6/6)', sub5 === '2025 (6/6)', sub5);
  check('legend breaks fixed across years', !!legend0 && legend0 === legend5, JSON.stringify(legend0));
  const changed = colors0 && colors5 ? colors0.filter((c, i) => c !== colors5[i]).length : -1;
  check('district colours differ between 2015 and 2025', changed > 0 && !colors0.some((c) => /^ERR|null/.test(c)), `${changed}/${colors0 ? colors0.length : 0} features changed`);
  await capture(win, 'ts-04-year-2025');

  // 5. 재생: 1× 간격(1.2초)으로 끝에서 처음으로 넘어간다 → 일시정지
  await js(`(() => {
    window.__tsTicks = [];
    let last = document.getElementById('ts-field').textContent;
    window.__tsObs = new MutationObserver(() => {
      const el = document.getElementById('ts-field');
      if (el && el.textContent !== last) { last = el.textContent; window.__tsTicks.push({ t: performance.now(), f: last }); }
    });
    window.__tsObs.observe(document.getElementById('time-series-controls'), { subtree: true, childList: true, characterData: true });
  })()`);
  await js(`document.getElementById('ts-play').click()`);
  await sleep(200);
  check('play button pressed', await js(`document.getElementById('ts-play').getAttribute('aria-pressed') === 'true' && __egisDebug.timeSeriesTool.isPlaying()`));
  await sleep(3700);   // 약 3칸 (1.2초 × 3)
  const ticks1 = await js(`window.__tsTicks.slice()`);
  const gaps = (t) => t.slice(1).map((x, i) => x.t - t[i].t);
  const avg = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const gaps1 = gaps(ticks1);
  check('play wrapped 2025 -> 2015 first', ticks1.length > 0 && ticks1[0].f === '2015', JSON.stringify(ticks1.map((x) => x.f)));
  check('1x interval ~1200ms', gaps1.length >= 1 && Math.abs(avg(gaps1) - 1200) < 150, `ticks=${ticks1.length} avgGap=${avg(gaps1).toFixed(0)}ms`);
  // 속도 2× — 재생 중 바꾸면 새 간격으로 다시 돈다
  await js(`(() => { window.__tsTicks = []; const s = document.getElementById('ts-speed'); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(3100);   // 약 5칸 (0.6초 × 5)
  const ticks2 = await js(`window.__tsTicks.slice()`);
  const gaps2 = gaps(ticks2);
  check('speed 2x: still playing, tool.speed = 2', await js(`__egisDebug.timeSeriesTool.isPlaying() && __egisDebug.timeSeriesTool.speed === 2`));
  check('2x interval ~600ms', gaps2.length >= 2 && Math.abs(avg(gaps2) - 600) < 100, `ticks=${ticks2.length} avgGap=${avg(gaps2).toFixed(0)}ms`);
  await js(`document.getElementById('ts-play').click()`);
  await sleep(200);
  const idxAtPause = await js(`__egisDebug.timeSeriesTool.config().timeSeries.index`);
  await sleep(1500);
  check('paused (aria-pressed false, index frozen)', await js(`document.getElementById('ts-play').getAttribute('aria-pressed') === 'false' && !__egisDebug.timeSeriesTool.isPlaying() && __egisDebug.timeSeriesTool.config().timeSeries.index === ${idxAtPause}`));
  // 재생 중에 슬라이더를 만지면 멈춘다
  await js(`document.getElementById('ts-play').click()`);
  await sleep(200);
  await js(setRange(1));
  await sleep(300);
  check('dragging slider while playing pauses at that index', await js(`!__egisDebug.timeSeriesTool.isPlaying() && ${FIELD} === '2017'`));
  await js(`(() => { window.__tsObs.disconnect(); const s = document.getElementById('ts-speed'); s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);

  // 6. 프로젝트 파일 왕복 — serialize 에 timeSeries 가 실리고 deserialize 뒤 컨트롤이 되살아난다
  await js(setRange(4));
  await sleep(400);
  const projJson = await js(`JSON.stringify(__egisDebug.projectManager.serialize())`);
  const proj = JSON.parse(projJson);
  const projLayer = (proj.layers || []).find((l) => l.name === DERIVED_NAME);
  const projTs = projLayer && projLayer.choroplethConfig && projLayer.choroplethConfig.timeSeries;
  check('serialize carries timeSeries {fields, index 4}', !!projTs && JSON.stringify(projTs) === JSON.stringify({ fields: YEARS, index: 4 }), JSON.stringify(projTs));
  await js(`__egisDebug.projectManager.deserialize(${projJson}).then(() => 0)`);
  await sleep(1500);
  check('deserialize: layer has timeSeries index 4', await js(`__egisDebug.layerManager.getAllLayers().some(l => l.name === '${DERIVED_NAME}' && l._choroplethConfig && l._choroplethConfig.timeSeries && l._choroplethConfig.timeSeries.index === 4)`));
  check('deserialize: controls restored at 2023', await js(`!!document.getElementById('time-series-controls') && ${FIELD} === '2023' && document.querySelectorAll('#time-series-controls').length === 1`));
  const subP = await js(SUBTITLE);
  check('deserialize: legend subtitle 2023 (5/6)', subP === '2023 (5/6)', subP);

  // 7. 새로고침 → 자동 복원 → 컨트롤이 되살아난다 (복원 대화상자는 「복원하기」). ?lab= 로 연다.
  await js(setRange(2));
  await sleep(3500);   // 자동 저장 디바운스 1초 + IndexedDB 쓰기
  const VIEW = `(() => { const v = __egisDebug.mapManager.getMap().getView(); return { center: v.getCenter().map(Math.round), zoom: +v.getZoom().toFixed(2) }; })()`;
  const viewBefore = await js(VIEW);
  const storedView = await js(`localStorage.getItem('eGIS_mapState')`);
  await openApp('?lab=time-series');
  const storedAtPrompt = await js(`localStorage.getItem('eGIS_mapState')`);
  const restoredClicked = await dismissRestore('restore-yes');
  check('restore dialog offered', restoredClicked);
  await sleep(4000);
  check('auto-restore: layer has timeSeries index 2', await js(`__egisDebug.layerManager.getAllLayers().some(l => l._choroplethConfig && l._choroplethConfig.timeSeries && l._choroplethConfig.timeSeries.index === 2)`));
  check('auto-restore: controls at 2019', await js(`!!document.getElementById('time-series-controls') && ${FIELD} === '2019'`));
  const subR = await js(SUBTITLE);
  check('auto-restore: legend subtitle 2019 (3/6)', subR === '2019 (3/6)', subR);
  const viewAfter = await js(VIEW);
  // 참고(시계열과 무관한 기존 동작): 지도 시작 때의 moveend 가 2초 디바운스로 기본 시점을 eGIS_mapState 에
  // 덮어써, 복원 대화상자에서 2초 넘게 머물면 저장된 시점이 사라진다. 판정하지 않고 기록만 한다.
  console.log('  view before reload', JSON.stringify(viewBefore), '| stored', storedView, '| stored at prompt', storedAtPrompt, '| after restore', JSON.stringify(viewAfter));
  // 프레임이 서울을 담도록 시계열 레이어로 확대한다
  await js(`__egisDebug.layerManager.zoomToLayer(__egisDebug.timeSeriesTool.layerId)`);
  await sleep(2500);
  await capture(win, 'ts-05-restored');

  // 8. GIF 저장 — a.click 을 가로채 blob 을 읽는다 (내려받지 않는다)
  await js(`(() => {
    window.__tsDownloads = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && String(this.href).startsWith('blob:')) {
        const name = this.download;
        window.__tsDownloads.push(fetch(this.href).then(r => r.blob()).then(b => new Promise(res => {
          const fr = new FileReader();
          fr.onload = () => res({ name, type: b.type, size: b.size, b64: String(fr.result).split(',')[1] });
          fr.readAsDataURL(b);
        })));
        return;
      }
      return orig.call(this);
    };
  })()`);
  await js(`document.getElementById('ts-save').click()`);
  await sleep(500);
  const dlg = await js(`(() => { const m = document.querySelector('.anim-export-modal'); return m ? { run: document.getElementById('anim-run').textContent, intro: m.querySelector('.anim-intro').textContent, hold: document.getElementById('anim-hold').value, gifChecked: document.getElementById('anim-format-gif').checked, text: m.textContent } : null; })()`);
  check('export dialog: GIF default, 6 years, hold 1.2s', !!dlg && dlg.run === 'GIF 만들기' && dlg.gifChecked && /6개 연도/.test(dlg.intro) && dlg.hold === '1.2', JSON.stringify(dlg && { run: dlg.run, intro: dlg.intro, hold: dlg.hold }));
  check('export dialog has no emoji', !!dlg && !/\p{Extended_Pictographic}/u.test(dlg.text));
  await capture(win, 'ts-06-export-dialog');
  const t0 = Date.now();
  await js(`document.getElementById('anim-run').click()`);
  let nDl = 0;
  for (let i = 0; i < 80 && nDl === 0; i++) { await sleep(500); nDl = await js(`window.__tsDownloads.length`); }
  const dls = nDl ? await js(`Promise.all(window.__tsDownloads)`) : [];
  const dl = dls[0];
  console.log('  export took', Date.now() - t0, 'ms; downloads', JSON.stringify(dls.map((d) => ({ name: d.name, type: d.type, size: d.size }))));
  check('GIF blob produced (image/gif, .gif, > 10 KB)', !!dl && dl.type === 'image/gif' && /\.gif$/.test(dl.name) && dl.size > 10000, dl ? `${dl.name} ${dl.type} ${dl.size} bytes` : 'no download');
  if (dl) {
    const bytes = Buffer.from(dl.b64, 'base64');
    fs.writeFileSync(path.join(OUT, 'ts-download.gif'), bytes);
    const g = parseGif(bytes);
    const mapSize = await js(`__egisDebug.mapManager.getMap().getSize().concat(window.devicePixelRatio)`);
    console.log('  gif', JSON.stringify(g && { width: g.width, height: g.height, frames: g.frames, delays: g.delays, loop: g.loop }), 'map', JSON.stringify(mapSize));
    check('GIF parses and has 6 frames (= fields)', !!g && g.frames === YEARS.length, g ? `frames=${g.frames}` : 'unparseable');
    check('GIF frame delays 120cs (1.2s) each, loops', !!g && g.delays.length === YEARS.length && g.delays.every((d) => d === 120) && g.loop, g ? JSON.stringify(g.delays) : '');
    check('GIF size = map size x devicePixelRatio (1x)', !!g && g.width === Math.round(mapSize[0] * mapSize[2]) && g.height === Math.round(mapSize[1] * mapSize[2]), g ? `${g.width}x${g.height}` : '');
  }
  await sleep(500);
  check('export dialog closed after save', await js(`!document.querySelector('.anim-export-modal')`));
  check('slider back to 2019 after export', await js(`${FIELD} === '2019' && __egisDebug.timeSeriesTool.config().timeSeries.index === 2`));
  check('no real download leaked', leakedDownloads.length === 0, JSON.stringify(leakedDownloads));

  // 9. 끄기 → 컨트롤·메뉴 항목 사라지고 레이어는 정적으로 남는다
  await js(`__egisDebug.labs.set('time-series', false)`);
  await sleep(300);
  check('controls removed when lab off', await js(`!document.getElementById('time-series-controls')`));
  check('menu hidden again', await js(`document.querySelector('[data-action="analysis-time-series"]').hidden === true`));
  check('layer and legend stay', await js(`__egisDebug.layerManager.getAllLayers().some(l => l.name === '${DERIVED_NAME}') && !!document.querySelector('.choropleth-legend')`));
  await capture(win, 'ts-07-off');
  // 다시 켜면 컨트롤이 돌아온다
  await js(`__egisDebug.labs.set('time-series', true)`);
  await sleep(300);
  check('lab on again restores controls at 2019', await js(`!!document.getElementById('time-series-controls') && ${FIELD} === '2019'`));
  // 닫기 버튼 → 컨트롤만 사라진다
  await js(`document.getElementById('ts-close').click()`);
  await sleep(200);
  check('close button removes controls only', await js(`!document.getElementById('time-series-controls') && __egisDebug.layerManager.getAllLayers().some(l => l.name === '${DERIVED_NAME}')`));

  const pageErrors = await js(`window.__tsErrors`);
  const consoleErrors = errors.filter((m) => !/indexeddb|quota|cache|favicon|vworld|tile/i.test(m));
  console.log('  console errors', JSON.stringify(consoleErrors.slice(0, 10)));
  check('no page errors', pageErrors.length === 0, JSON.stringify(pageErrors));

  // 뒷정리: 다음 실행이 복원 창을 안 만나게
  await js(`__egisDebug.labs.set('time-series', false); localStorage.removeItem('eGIS_labs')`);
  await js(`__egisDebug.layerManager.getAllLayers().slice().forEach(l => __egisDebug.layerManager.removeLayer(l.id))`);
  await sleep(2000);
  console.log(`SUMMARY ${passed} passed, ${failed} failed`);
  app.exit(process.exitCode || 0); // app.quit() 은 beforeunload 에 걸려 멈출 수 있다
}).catch((err) => {
  console.error('HARNESS ERROR', err && err.stack ? err.stack : err);
  app.exit(1);
});
