# 휴대폰 셸 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 휴대폰(≤768px)에서 메뉴바를 한 줄로 줄이고 툴바·메뉴를 왼쪽 서랍(햄버거)에 넣으며, 헤더의 레이어 버튼으로 레이어 시트를 열고, 글래스(블러 + 지도 위 부유 카드)를 휴대폰·태블릿에도 적용한다.

**Architecture:** `MobileShell.js` 가 `matchMedia('(max-width: 768px)')` 를 감시하며 `#toolbar`·`.menu-center`·`#toolbar-search` DOM 노드를 서랍/검색 줄로 옮기고 되돌린다(클릭 위임은 요소에 붙어 있어 그대로 산다). 스타일은 새 `mobile.css` 한 파일. 글래스는 `glass.css` 의 부유 블록을 전 폭으로 올리고 휴대폰 덮어쓰기 블록을 더한다. 설계서: `docs/superpowers/specs/2026-09-26-mobile-shell-design.md`.

**Tech Stack:** Vanilla JS ES modules, vitest(jsdom), Electron 검증 하네스(CDP 기기 에뮬레이션).

**규칙(README 와 같다):** 커밋 저자 `git -c user.name=yhk1m -c user.email=83273992+yhk1m@users.noreply.github.com`, `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 트레일러, `git add -A` 금지(파일 이름으로만), `public/data/builtin/raster_catalog.json` 절대 스테이징 금지, 새 파일 첫 줄 `// © 2026 김용현` 정확히 하나(jsdom 테스트는 1행 `// @vitest-environment jsdom`, 2행 ©), UI 이모지 금지·아이콘은 선 SVG, 구현자·검토자 서브에이전트 모델은 Opus 5.5.

---

### Task 1: `glass.js` — 휴대폰에서 패널 오프셋 0, 변수는 `#app` 에도

**Files:**
- Modify: `src/labs/glass.js` (`layoutOffsets`, `trackLayoutOffsets`)
- Test: `src/labs/glass.test.js` (기존 파일에 추가)

- [ ] **Step 1: 실패하는 테스트**

`src/labs/glass.test.js` 에 추가:

```js
describe('layoutOffsets — panelFloating', () => {
  it('panelFloating 이면 패널이 보여도 panel 오프셋은 0', () => {
    const o = layoutOffsets({
      appRect: { left: 0, top: 0, bottom: 800 },
      mainRect: { top: 60, bottom: 770 },
      panelRect: { right: 390 },
      panelHidden: false,
      panelFloating: true
    });
    expect(o).toEqual({ panel: 0, top: 60, bottom: 30 });
  });
});

describe('trackLayoutOffsets — 변수 쓰기 대상', () => {
  it('오프셋 변수를 mapContainer 와 app 양쪽에 쓴다', () => {
    const el = () => ({ style: { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } }, classList: { contains: () => false }, getBoundingClientRect: () => ({ left: 0, top: 0, right: 300, bottom: 800, width: 300 }) });
    const app = el(), main = el(), panel = el(), mapContainer = el();
    main.getBoundingClientRect = () => ({ top: 60, bottom: 770 });
    class RO { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} }
    const win = { dispatchEvent() {}, matchMedia: () => ({ matches: true }) };
    const untrack = trackLayoutOffsets({ app, main, panel, mapContainer, win, ResizeObserverCtor: RO });
    expect(mapContainer.style.props['--glass-panel-offset']).toBe('0px');
    expect(app.style.props['--glass-panel-offset']).toBe('0px');
    expect(app.style.props['--glass-bottom-offset']).toBe('30px');
    untrack();
    expect(app.style.props['--glass-top-offset']).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/labs/glass.test.js` → `panelFloating` 무시로 panel=390, `app.style.props` 비어 FAIL.

- [ ] **Step 3: 구현**

`layoutOffsets` 시그니처에 `panelFloating = false` 추가, `const panel = (panelHidden || panelFloating) ? 0 : …`. `trackLayoutOffsets` 의 `update()` 에서

```js
const panelFloating = !!(win && typeof win.matchMedia === 'function' && win.matchMedia(PHONE_MEDIA).matches);
```

(`export const PHONE_MEDIA = '(max-width: 768px)';` 파일 상단) 를 넘기고, 세 변수는 `[mapContainer, app]` 두 요소에 `setProperty`, 해제 시 두 요소 모두 `removeProperty`. `matchMedia` 결과에 `addEventListener('change', update)` 를 걸어 회전 시 다시 재고, 해제 함수에서 `removeEventListener`. 파일 머리 주석에 "휴대폰(≤768px)은 패널이 아래 시트라 panel 오프셋 0, 변수는 #app 에도 쓴다(시트가 #app 자식)" 한 줄.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/labs/glass.test.js`
- [ ] **Step 5: 커밋** — `git add src/labs/glass.js src/labs/glass.test.js` → `feat(glass): 휴대폰 패널 오프셋 0·변수 #app 에도 기록`

---

### Task 2: `AppLayout.js` — 헤더 버튼·검색 줄·서랍 골격·`data-label`·`toggleSidebar()`

**Files:**
- Modify: `src/ui/layout/AppLayout.js`

- [ ] **Step 1: 마크업**

(a) `<header id="menubar">` 의 `.menu-left` 앞에 햄버거, `.menu-right` 의 `#header-auth` 앞에 검색·레이어 버튼:

```html
<button class="mobile-only mobile-menu-btn" id="mobile-menu-btn" title="메뉴" aria-label="메뉴 열기" aria-expanded="false" aria-controls="mobile-drawer">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg>
</button>
```

```html
<button class="mobile-only mobile-header-btn" id="mobile-search-btn" title="장소 검색" aria-label="장소 검색" aria-expanded="false" aria-controls="mobile-search-row">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
</button>
<button class="mobile-only mobile-header-btn" id="mobile-layers-btn" title="레이어 목록" aria-label="레이어 목록" aria-pressed="false">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
  <span class="mobile-layers-count" id="mobile-layers-count" hidden>0</span>
</button>
```

(b) `</header>` 바로 뒤, `#toolbar` 앞에 검색 줄: `<div id="mobile-search-row" class="mobile-only mobile-search-row" hidden></div>`.

(c) `#statusbar` 뒤(= `#app` 의 마지막 자식)에 서랍:

```html
<div id="mobile-drawer" class="mobile-drawer" hidden>
  <div class="mobile-drawer-scrim" data-drawer-close></div>
  <aside class="mobile-drawer-sheet" role="dialog" aria-modal="true" aria-label="메뉴">
    <div class="mobile-drawer-head">
      <span class="mobile-drawer-title">e-GIS</span>
      <button class="btn-icon mobile-drawer-close" data-drawer-close title="닫기" aria-label="메뉴 닫기">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="mobile-drawer-body">
      <h3 class="mobile-drawer-heading">도구</h3>
      <div class="mobile-drawer-tools" id="mobile-drawer-tools"></div>
      <h3 class="mobile-drawer-heading">메뉴</h3>
      <div class="mobile-drawer-menus" id="mobile-drawer-menus"></div>
    </div>
  </aside>
</div>
```

(d) 툴바 `.btn-icon` 전부에 `data-label`: zoom-in 확대 / zoom-out 축소 / zoom-extent 전체 범위 / select 선택 / btn-feature-info 속성 보기 / btn-clear-selection 선택 취소 / btn-delete-selection 선택 삭제 / btn-merge-features 합치기 / edit-split 자르기 / draw-point 점 / draw-line 선 / draw-polygon 면 / draw-multipoint 멀티포인트 / draw-multiline 멀티라인 / draw-multipolygon 멀티폴리곤 / measure-distance 거리 / measure-area 면적 / clear-measures 측정 지우기 / upload-image 이미지. `.btn-tool-labeled` 는 그대로.

- [ ] **Step 2: 사이드바 토글 리팩터**

```js
initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  const leftPanel = document.getElementById('left-panel');
  const resizer = document.getElementById('panel-resizer');
  if (window.matchMedia('(max-width: 768px)').matches) this.setSidebarHidden(true);
  btn.addEventListener('click', () => this.toggleSidebar());
}

/** @returns {boolean} 바뀐 뒤 숨김 여부 */
setSidebarHidden(hidden) {
  const btn = document.getElementById('sidebar-toggle');
  const leftPanel = document.getElementById('left-panel');
  const resizer = document.getElementById('panel-resizer');
  leftPanel.classList.toggle('hidden', hidden);
  if (resizer) resizer.style.display = hidden ? 'none' : '';
  btn?.classList.toggle('collapsed', hidden);
  window.dispatchEvent(new Event('resize'));
  return hidden;
}

toggleSidebar() {
  return this.setSidebarHidden(!document.getElementById('left-panel').classList.contains('hidden'));
}

isSidebarHidden() { return document.getElementById('left-panel').classList.contains('hidden'); }
```

- [ ] **Step 3: 확인** — `npm run build` 성공, `npx vitest run src/ui` 통과(SwipePanel 등 기존 테스트가 AppLayout 을 쓰면 깨지지 않는지).
- [ ] **Step 4: 커밋** — `feat(mobile): 헤더 버튼·검색 줄·서랍 골격·data-label·toggleSidebar()`

---

### Task 3: `main.js` — 메뉴바 위임을 `document` 로

**Files:**
- Modify: `src/main.js` (`initMenubar`)

- [ ] **Step 1:** `menubar.addEventListener('click', …)` 를 `document.addEventListener('click', …)` 로 바꾸고, 핸들러 첫 줄에 `if (!e.target.closest('#menubar, #mobile-drawer')) return;` 를 넣는다(서랍으로 옮겨진 `.menu-center` 도 받는다). 주석: "휴대폰에서는 MobileShell 이 .menu-center 를 서랍으로 옮기므로 document 에 건다". 바깥 클릭 닫기 핸들러는 그대로.
- [ ] **Step 2:** `npm run build`, 브라우저 없이 확인이 어려우므로 Task 7 하네스에서 검증. 커밋 `refactor(menubar): 클릭 위임을 document 로 (서랍 이동 대비)`.

---

### Task 4: `MobileShell.js` + 테스트

**Files:**
- Create: `src/ui/layout/MobileShell.js`
- Test: `src/ui/layout/MobileShell.test.js` (jsdom)
- Modify: `src/main.js` (호출)

- [ ] **Step 1: 실패하는 테스트** — 골격 DOM 을 문자열로 만들고 `matchMedia` 를 흉내 낸다:

```js
// @vitest-environment jsdom
// © 2026 김용현
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initMobileShell, PHONE_MEDIA } from './MobileShell.js';

function dom() {
  document.body.innerHTML = `
    <div id="app">
      <header id="menubar"><button id="mobile-menu-btn" aria-expanded="false"></button><div class="menu-center"><div class="menu-items"><div class="menu-item dropdown"><button class="menu-button">프로젝트</button><div class="dropdown-menu"><div class="dropdown-item" data-action="x">항목</div></div></div></div></div>
        <div class="menu-right"><button id="mobile-search-btn" aria-expanded="false"></button><button id="mobile-layers-btn" aria-pressed="false"><span id="mobile-layers-count" hidden>0</span></button></div></header>
      <div id="mobile-search-row" hidden></div>
      <div id="toolbar"><div class="toolbar-group"><button class="btn-icon" data-tool="zoom-in"></button></div><div class="toolbar-search" id="toolbar-search"><input id="location-search-input"></div></div>
      <div id="main-container"><aside id="left-panel" class="hidden"></aside><div id="map-container"><button id="sidebar-toggle"></button></div></div>
      <div id="statusbar"></div>
      <div id="mobile-drawer" hidden><div class="mobile-drawer-scrim" data-drawer-close></div><aside class="mobile-drawer-sheet"><button data-drawer-close></button><div id="mobile-drawer-tools"></div><div id="mobile-drawer-menus"></div></aside></div>
    </div>`;
}
function mql(matches) { const l = new Set(); return { matches, addEventListener: (_, f) => l.add(f), removeEventListener: (_, f) => l.delete(f), fire(m) { this.matches = m; l.forEach((f) => f({ matches: m })); } }; }
function layoutStub() { let hidden = true; return { isSidebarHidden: () => hidden, setSidebarHidden: vi.fn((h) => { hidden = h; document.getElementById('left-panel').classList.toggle('hidden', h); return h; }), toggleSidebar() { return this.setSidebarHidden(!hidden); } }; }
function busStub() { const h = {}; return { on: (ev, f) => { (h[ev] ||= []).push(f); }, emit: (ev, d) => (h[ev] || []).forEach((f) => f(d)) }; }

describe('MobileShell', () => {
  let m, layout, bus, layers;
  beforeEach(() => { dom(); m = mql(true); layout = layoutStub(); bus = busStub(); layers = []; initMobileShell({ layout, layerManager: { getAllLayers: () => layers }, eventBus: bus, Events: { LAYER_ADDED: 'la', LAYER_REMOVED: 'lr', PROJECT_LOADED: 'pl', PROJECT_NEW: 'pn' }, matchMedia: () => m }); });

  it('휴대폰이면 툴바·메뉴·검색을 서랍/검색 줄로 옮기고, 풀리면 되돌린다', () => {
    expect(document.querySelector('#mobile-drawer-tools #toolbar')).not.toBeNull();
    expect(document.querySelector('#mobile-drawer-menus .menu-center')).not.toBeNull();
    expect(document.querySelector('#mobile-search-row #toolbar-search')).not.toBeNull();
    expect(document.body.classList.contains('phone-shell')).toBe(true);
    m.fire(false);
    expect(document.querySelector('#app > #toolbar')).not.toBeNull();
    expect(document.querySelector('#menubar .menu-center')).not.toBeNull();
    expect(document.querySelector('#toolbar #toolbar-search')).not.toBeNull();
    expect(document.body.classList.contains('phone-shell')).toBe(false);
  });

  it('햄버거로 열고 스크림·닫기·Esc 로 닫는다', () => {
    const drawer = document.getElementById('mobile-drawer'); const btn = document.getElementById('mobile-menu-btn');
    btn.click(); expect(drawer.hidden).toBe(false); expect(btn.getAttribute('aria-expanded')).toBe('true');
    document.querySelector('.mobile-drawer-scrim').click(); expect(drawer.hidden).toBe(true);
    btn.click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); expect(drawer.hidden).toBe(true);
  });

  it('도구 버튼·실행 항목을 누르면 닫히고, 메뉴 제목은 닫히지 않는다', () => {
    const drawer = document.getElementById('mobile-drawer');
    document.getElementById('mobile-menu-btn').click();
    document.querySelector('.menu-button').click(); expect(drawer.hidden).toBe(false);
    document.querySelector('.dropdown-item').click(); expect(drawer.hidden).toBe(true);
    document.getElementById('mobile-menu-btn').click();
    document.querySelector('[data-tool="zoom-in"]').click(); expect(drawer.hidden).toBe(true);
  });

  it('검색 버튼이 검색 줄을 펼치고 입력창에 포커스', () => {
    document.getElementById('mobile-search-btn').click();
    expect(document.getElementById('mobile-search-row').hidden).toBe(false);
    expect(document.activeElement.id).toBe('location-search-input');
    document.getElementById('mobile-search-btn').click();
    expect(document.getElementById('mobile-search-row').hidden).toBe(true);
  });

  it('레이어 버튼은 시트를 토글하고 aria-pressed 를 맞춘다', () => {
    const b = document.getElementById('mobile-layers-btn');
    b.click(); expect(layout.isSidebarHidden()).toBe(false); expect(b.getAttribute('aria-pressed')).toBe('true');
    b.click(); expect(layout.isSidebarHidden()).toBe(true); expect(b.getAttribute('aria-pressed')).toBe('false');
  });

  it('배지는 레이어 수, 0 → 1 이 되면 시트를 한 번만 자동으로 연다', () => {
    const c = document.getElementById('mobile-layers-count');
    layers = [{}]; bus.emit('la'); expect(c.hidden).toBe(false); expect(c.textContent).toBe('1'); expect(layout.isSidebarHidden()).toBe(false);
    layout.setSidebarHidden(true); layers = [{}, {}]; bus.emit('la'); expect(c.textContent).toBe('2'); expect(layout.isSidebarHidden()).toBe(true);
    layers = []; bus.emit('pn'); expect(c.hidden).toBe(true);
    layers = [{}]; bus.emit('la'); expect(layout.isSidebarHidden()).toBe(false);
  });

  it('데스크톱에서는 자동 열기·이동을 하지 않는다', () => {
    m.fire(false); layout.setSidebarHidden(true);
    layers = [{}]; bus.emit('la'); expect(layout.isSidebarHidden()).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/ui/layout/MobileShell.test.js` → 모듈 없음.

- [ ] **Step 3: 구현** `src/ui/layout/MobileShell.js`

```js
// © 2026 김용현
/**
 * 휴대폰 셸 — (max-width: 768px) 에서 툴바·메뉴·검색을 서랍/검색 줄로 옮기고, 레이어 버튼·배지를 돌린다.
 * 노드를 실제로 옮기므로 #toolbar 에 걸린 클릭 위임은 그대로 산다(메뉴 위임은 main.js 가 document 에 건다).
 * 미디어가 풀리면 placeholder 자리로 되돌린다.
 */
export const PHONE_MEDIA = '(max-width: 768px)';
const MOVES = [
  { id: 'toolbar', into: 'mobile-drawer-tools' },
  { id: 'toolbar-search', into: 'mobile-search-row' },
  { sel: '#menubar .menu-center', into: 'mobile-drawer-menus' }
];

export function initMobileShell({ layout, layerManager, eventBus, Events, matchMedia = (q) => window.matchMedia(q), doc = document } = {}) {
  const mql = matchMedia(PHONE_MEDIA);
  const placeholders = new Map();
  const $ = (id) => doc.getElementById(id);
  const drawer = $('mobile-drawer'), menuBtn = $('mobile-menu-btn'), searchBtn = $('mobile-search-btn'), searchRow = $('mobile-search-row'), layersBtn = $('mobile-layers-btn'), countEl = $('mobile-layers-count');
  const isPhone = () => !!mql.matches;
  let autoOpened = false;

  function moveIn() {
    for (const m of MOVES) {
      const el = m.id ? $(m.id) : doc.querySelector(m.sel);
      const target = $(m.into);
      if (!el || !target || placeholders.has(el)) continue;
      const ph = doc.createComment(`mobile-shell:${m.id || m.sel}`);
      el.parentNode.insertBefore(ph, el);
      placeholders.set(el, ph);
      target.appendChild(el);
    }
    doc.body.classList.add('phone-shell');
  }
  function moveOut() {
    for (const [el, ph] of placeholders) { ph.parentNode?.replaceChild(el, ph); }
    placeholders.clear();
    doc.body.classList.remove('phone-shell');
    closeDrawer(); setSearch(false);
  }
  function apply() { if (isPhone()) moveIn(); else moveOut(); }

  function openDrawer() { if (!drawer) return; drawer.hidden = false; doc.body.classList.add('drawer-open'); menuBtn?.setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { if (!drawer || drawer.hidden) return; drawer.hidden = true; doc.body.classList.remove('drawer-open'); menuBtn?.setAttribute('aria-expanded', 'false'); }
  menuBtn?.addEventListener('click', () => (drawer?.hidden ? openDrawer() : closeDrawer()));
  drawer?.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-close]')) { closeDrawer(); return; }
    if (e.target.closest('[data-tool], .dropdown-item, .btn-community[data-action]')) closeDrawer();
  });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer && !drawer.hidden) closeDrawer(); });

  function setSearch(open) { if (!searchRow) return; searchRow.hidden = !open; searchBtn?.setAttribute('aria-expanded', String(open)); if (open) $('location-search-input')?.focus(); }
  searchBtn?.addEventListener('click', () => setSearch(searchRow?.hidden));

  function syncLayersBtn() { layersBtn?.setAttribute('aria-pressed', String(!layout.isSidebarHidden())); layersBtn?.classList.toggle('active', !layout.isSidebarHidden()); }
  layersBtn?.addEventListener('click', () => { layout.toggleSidebar(); syncLayersBtn(); });
  $('sidebar-toggle')?.addEventListener('click', syncLayersBtn);

  function updateCount() {
    const n = layerManager?.getAllLayers?.().length ?? 0;
    if (countEl) { countEl.textContent = String(n); countEl.hidden = n === 0; }
    return n;
  }
  eventBus?.on(Events.LAYER_ADDED, () => {
    const n = updateCount();
    if (isPhone() && n > 0 && !autoOpened && layout.isSidebarHidden()) { layout.setSidebarHidden(false); autoOpened = true; syncLayersBtn(); }
  });
  eventBus?.on(Events.LAYER_REMOVED, updateCount);
  eventBus?.on(Events.PROJECT_LOADED, () => { autoOpened = false; updateCount(); });
  eventBus?.on(Events.PROJECT_NEW, () => { autoOpened = false; updateCount(); });

  mql.addEventListener?.('change', apply);
  apply(); updateCount(); syncLayersBtn();
  return { openDrawer, closeDrawer, isPhone, destroy() { mql.removeEventListener?.('change', apply); moveOut(); } };
}
```

주의: `autoOpened` 은 "레이어 수가 0→1" 대신 "이번 프로젝트에서 아직 자동으로 안 열었음"으로 단순화한다 — 테스트 시나리오와 맞는다(두 번째 추가는 열지 않고, 프로젝트 새로 만들기 뒤 다시 연다).

- [ ] **Step 4: 통과 확인** — 위 테스트 7개 PASS.
- [ ] **Step 5: main.js 호출** — `layout.render()` 뒤, 실험실 블록 앞에:

```js
import { initMobileShell } from './ui/layout/MobileShell.js';
…
initMobileShell({ layout, layerManager, eventBus, Events });
```

(`layerManager` 가 그 시점에 이미 만들어져 있어야 한다 — 아니면 생성 직후로 옮긴다.) `__egisDebug` 에 `mobileShell` 을 넣는다.

- [ ] **Step 6: 커밋** — `git add src/ui/layout/MobileShell.js src/ui/layout/MobileShell.test.js src/main.js` → `feat(mobile): MobileShell — 서랍 이동·검색 줄·레이어 버튼·배지·자동 열기`

---

### Task 5: `mobile.css` — 휴대폰 헤더·서랍·격자 툴바·아코디언 + `layout.css` 정리

**Files:**
- Create: `src/styles/mobile.css`
- Modify: `src/styles/main.css` (`@import './layout.css';` 다음 줄에 `@import './mobile.css';`)
- Modify: `src/styles/layout.css` (휴대폰 블록 745~921행 정리)

- [ ] **Step 1: `mobile.css`**

```css
/* © 2026 김용현 */
/* 휴대폰 셸 (≤768px): 헤더 한 줄, 툴바·메뉴는 왼쪽 서랍, 검색 줄, 레이어 버튼. MobileShell.js 가 노드를 옮긴 뒤의 모양. */

.mobile-only { display: none; }

@media (max-width: 768px) {
  .mobile-only { display: flex; }

  /* --- 헤더 한 줄 --- */
  #menubar { height: var(--menubar-height); min-height: 0; flex-wrap: nowrap; padding: 0 var(--spacing-xs); gap: var(--spacing-xs); }
  .menu-left { display: flex; flex: 1; min-width: 0; }
  .menu-right { display: flex; align-items: center; gap: 2px; order: 0; width: auto; }
  .toolbar-collapse-btn, .header-privacy-link, .btn-community:not(.btn-community-primary), .header-user-mail { display: none !important; }
  .auth-label-ko { display: none; } .auth-label-en { display: inline; }
  .header-user-email { max-width: 28vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-menu-btn, .mobile-header-btn { position: relative; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: none; border-radius: var(--radius-md); background: transparent; color: var(--text-primary); cursor: pointer; }
  .mobile-header-btn.active { color: var(--color-primary); background: var(--bg-hover); }
  .mobile-layers-count { position: absolute; top: 4px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--color-primary); color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; }
  .mobile-layers-count[hidden] { display: none; }

  /* --- 검색 줄 (헤더 아래) --- */
  .mobile-search-row { padding: var(--spacing-xs) var(--spacing-sm); background: var(--bg-toolbar); border-bottom: 1px solid var(--border-color); z-index: var(--z-toolbar); }
  .mobile-search-row[hidden] { display: none; }
  .mobile-search-row .toolbar-search { flex: 1; }
  .mobile-search-row #location-search-input { width: 100%; height: 40px; font-size: 15px; }

  /* --- 서랍 --- */
  .mobile-drawer { position: fixed; inset: 0; z-index: var(--z-dialog); }
  .mobile-drawer[hidden] { display: none; }
  .mobile-drawer-scrim { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }
  .mobile-drawer-sheet { position: absolute; top: 0; bottom: 0; left: 0; width: min(86vw, 360px); display: flex; flex-direction: column; background: var(--bg-panel); border-right: 1px solid var(--border-color); box-shadow: var(--shadow-lg); animation: mobile-drawer-in 180ms ease-out; }
  @keyframes mobile-drawer-in { from { transform: translateX(-100%); } to { transform: none; } }
  @media (prefers-reduced-motion: reduce) { .mobile-drawer-sheet { animation: none; } }
  .mobile-drawer-head { display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 var(--spacing-sm) 0 var(--spacing-md); border-bottom: 1px solid var(--border-color); font-weight: 700; }
  .mobile-drawer-close { width: 36px; height: 36px; }
  .mobile-drawer-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding-bottom: env(safe-area-inset-bottom); }
  .mobile-drawer-heading { margin: 0; padding: var(--spacing-md) var(--spacing-md) var(--spacing-xs); font-size: var(--font-size-xs); font-weight: 600; letter-spacing: 0.04em; color: var(--text-muted); text-transform: uppercase; }

  /* 서랍 안 툴바: 4열 격자, 아이콘 위 라벨 아래 */
  .mobile-drawer #toolbar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; height: auto; min-height: 0; padding: 0 var(--spacing-sm); background: transparent; border: none; }
  .mobile-drawer #toolbar .toolbar-group { display: contents; }
  .mobile-drawer #toolbar .btn-icon, .mobile-drawer #toolbar .btn-tool-labeled { width: auto; height: auto; min-height: 64px; flex-direction: column; justify-content: center; gap: 4px; padding: 6px 2px; border-radius: var(--radius-md); font-size: 11px; line-height: 1.2; }
  .mobile-drawer #toolbar .btn-icon svg { width: 24px !important; height: 24px !important; }
  .mobile-drawer #toolbar .btn-icon[data-label]::after { content: attr(data-label); display: block; font-size: 11px; color: var(--text-secondary); white-space: nowrap; }
  .mobile-drawer #toolbar .btn-icon.active::after { color: var(--color-primary); }
  .mobile-drawer #toolbar [hidden], .mobile-drawer #toolbar [style*="display:none"], .mobile-drawer #toolbar [style*="display: none"] { display: none !important; }
  .mobile-drawer #toolbar .toolbar-copyright { display: none; }
  .mobile-drawer #toolbar .btn-tool-labeled svg { width: 24px; height: 24px; }

  /* 서랍 안 메뉴: 아코디언 */
  .mobile-drawer .menu-center { display: block; width: auto; order: 0; }
  .mobile-drawer .menu-items { display: flex; flex-direction: column; flex-wrap: nowrap; padding: 0 var(--spacing-xs) var(--spacing-md); }
  .mobile-drawer .menu-item { position: static; }
  .mobile-drawer .menu-button, .mobile-drawer .btn-community { display: flex; align-items: center; gap: var(--spacing-sm); width: 100%; min-height: 44px; padding: 0 var(--spacing-md) !important; border: none; border-radius: var(--radius-md); background: transparent; font-size: 15px !important; color: var(--text-primary); text-align: left; }
  .mobile-drawer .menu-btn-icon { display: none; }
  .mobile-drawer .menu-btn-label, .mobile-drawer .btn-community-label { display: inline; }
  .mobile-drawer .menu-item.dropdown > .menu-button::after, .mobile-drawer .menu-item.dropdown > .btn-community::after { content: ''; margin-left: auto; width: 8px; height: 8px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); opacity: 0.6; transition: transform var(--transition-fast); }
  .mobile-drawer .menu-item.dropdown.open > .menu-button::after, .mobile-drawer .menu-item.dropdown.open > .btn-community::after { transform: rotate(-135deg); }
  .mobile-drawer .menu-item .dropdown-menu { position: static; display: none; min-width: 0; margin: 0 0 var(--spacing-xs) var(--spacing-md); padding: 0 0 0 var(--spacing-sm); border: none; border-left: 2px solid var(--border-color); border-radius: 0; box-shadow: none; background: transparent; max-width: none; }
  .mobile-drawer .menu-item.dropdown.open .dropdown-menu { display: block; }
  .mobile-drawer .dropdown-item { min-height: 40px; display: flex; align-items: center; font-size: 14px; }
  .mobile-drawer .btn-community-primary { justify-content: flex-start; }

  /* --- 툴바 자리에 남는 것 없음: 서랍 밖의 #toolbar 는 (미디어 전환 중 잠깐) 숨긴다 --- */
  body.phone-shell #app > #toolbar { display: none; }

  /* 상태줄 */
  #statusbar { gap: var(--spacing-sm); overflow-x: auto; }
  .visitor-counter { display: none; }
}
```

- [ ] **Step 2: `layout.css` 정리** — 745행 `@media (max-width: 768px)` 블록에서 메뉴바 줄바꿈(`#menubar {height:auto…}`), `.menu-left {display:none}`, `.menu-right {order…}`, `.menu-center {order…}`, `.menu-button {font-size:17px…}`, `.menu-btn-icon/.menu-btn-label`, `.menu-item .dropdown-menu {max-width}`, `.btn-community-primary` 3개 규칙, 툴바 줄바꿈(`#toolbar {height:auto…}`, `.toolbar-search`, `#location-search-input`), 상태줄 2개 규칙을 **삭제**한다(mobile.css 로 옮겼다). `.header-user-email`·`.header-auth`·bottom sheet(`#main-container`, `#left-panel`, `.panel-resizer`, `.sidebar-toggle` 3개, `#left-panel:not(.hidden) ~ …`)는 남긴다.
- [ ] **Step 3:** `npm run build`, `npm test`. 커밋 `git add src/styles/mobile.css src/styles/main.css src/styles/layout.css` → `feat(mobile): 휴대폰 헤더 한 줄·서랍·격자 툴바·아코디언 스타일`

---

### Task 6: `glass.css` — 블러 복원, 부유 배치를 전 폭으로, 휴대폰 덮어쓰기, 서랍 유리

**Files:**
- Modify: `src/styles/glass.css`
- Modify: `docs/superpowers/specs/2026-09-25-labs-design.md` (글래스 항목에 "휴대폰·태블릿도 부유 배치·블러" 한 줄)

- [ ] **Step 1:** 146~194행 coarse 블록을 다음으로 교체:

```css
/* 휴대폰: 블러는 살리되 조금 낮춘다 (GPU) */
@media (max-width: 768px) {
  [data-surface="glass"] { --glass-blur: 14px; }
}
```

(블러 값이 리터럴이면 `--glass-blur` 토큰을 도입해 `backdrop-filter: blur(var(--glass-blur)) saturate(170%)` 로 바꾼다 — 기존 값 18px 을 `:root`/`[data-surface="glass"]` 토큰에 둔다.)

- [ ] **Step 2:** 195행 `@media (min-width: 1025px) and (pointer: fine) { … }` 의 미디어 래퍼를 제거해 안의 규칙을 무조건 규칙으로 올린다(들여쓰기만 정리). 주석을 "모든 폭: 지도를 창 전체에 깔고 …; 휴대폰은 아래 블록이 시트·손잡이만 덮어쓴다"로 고친다.

- [ ] **Step 3:** 그 뒤에 휴대폰 블록:

```css
@media (max-width: 768px) {
  /* 시트는 #app 기준(main 이 static) — 상태줄 카드 위에 앉힌다 */
  [data-surface="glass"] #left-panel {
    position: absolute; top: auto; left: var(--glass-gap); right: var(--glass-gap);
    bottom: calc(var(--glass-bottom-offset, 0px) + var(--glass-gap));
    width: auto !important; height: 55%; margin: 0;
    border-radius: 12px 12px 0 0; border-bottom: none;
  }
  [data-surface="glass"] .sidebar-toggle {
    left: 50%; top: auto; transform: translateX(-50%);
    bottom: calc(var(--glass-bottom-offset, 0px) + var(--glass-gap));
  }
  [data-surface="glass"] #left-panel:not(.hidden) ~ #map-container .sidebar-toggle {
    bottom: calc(55% + var(--glass-bottom-offset, 0px) + var(--glass-gap));
  }
  /* 헤더 카드 안의 검색 줄은 카드 하단 안쪽에 붙는다 */
  [data-surface="glass"] .mobile-search-row { border-bottom: none; background: transparent; }
  /* 서랍 시트·스크림 */
  [data-surface="glass"] .mobile-drawer-sheet { background: var(--glass-bg-strong, var(--bg-panel)); }
}
```

`#mobile-search-row` 는 `#menubar` 바깥 형제이므로 카드가 되도록 상단 블록의 `#menubar, #toolbar` 카드 목록에 `.mobile-search-row` 를 추가한다(`margin: 0 var(--glass-gap)`, radius 12px, border).

- [ ] **Step 4:** 블러·테두리·halo 를 받는 셀렉터 목록(파일 상단 `[data-surface="glass"] #menubar, …` 부유 목록과 `text-shadow` halo 목록)에 `.mobile-drawer-sheet`, `.mobile-search-row` 를 추가. 호버/누름 블록의 `:is(…)` 에 `.mobile-menu-btn, .mobile-header-btn, .mobile-drawer-close` 추가.
- [ ] **Step 5:** `npm run build`. 커밋 `git add src/styles/glass.css docs/superpowers/specs/2026-09-25-labs-design.md` → `feat(glass): 휴대폰·태블릿도 블러와 부유 카드, 서랍 유리`

---

### Task 7: Electron 하네스 `scripts/verify/mobile-shell.cjs` + 발견 사항 수정

**Files:**
- Create: `scripts/verify/mobile-shell.cjs`
- (수정이 필요하면) Task 2~6 파일

- [ ] **Step 1: 하네스** — 기존 `scripts/verify/labs-shell.cjs` 의 골격(`app.disableHardwareAcceleration()`, 파비콘 선로드 + `localStorage.egis_last_visit` 오늘(KST), IndexedDB 삭제, `#restore-no` 클릭, watchdog, `will-prevent-unload`, `app.exit`)을 따르고, 기기 에뮬레이션은 `webContents.debugger` 로:

```js
const dbg = win.webContents.debugger; if (!dbg.isAttached()) dbg.attach('1.3');
await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
```

**페이지를 load 할 때마다 다시 보낸다**(내비게이션 후 풀린다). 탭은 `Input.dispatchTouchEvent` touchStart/touchEnd. `BrowserWindow({ width: 390, height: 844, useContentSize: true })`.

확인 항목(각각 PASS/FAIL 출력, 하나라도 FAIL 이면 exit 1):
1. `plain`: `#menubar` 높이 ≤ 56, `#app > #toolbar` 없음(서랍 안에 있음), `matchMedia('(pointer: coarse)')` true. 캡처 `mobile-01-home`.
2. 햄버거 탭 → `#mobile-drawer` 보임, 서랍 안 `[data-tool]` 보이는 버튼 ≥ 19, `.menu-item` 11. 캡처 `mobile-02-drawer`. 「프로젝트」 탭 → `.menu-item.dropdown.open` 1, 캡처 `mobile-03-drawer-menu`. `[data-tool="zoom-in"]` 탭 → 서랍 닫힘, 지도 줌이 +1.
3. 검색 버튼 탭 → `#mobile-search-row` 보임, `document.activeElement.id === 'location-search-input'`. 캡처 `mobile-04-search`. 다시 탭 → 숨김.
4. 레이어 버튼 탭 → `#left-panel` 보임, `aria-pressed=true`. 캡처 `mobile-05-sheet`. 다시 탭 → 숨김.
5. 레이어 추가(`__egisDebug.builtinDataManager.loadCatalogs()` 뒤 서울 자치구 로드 — `labs-swipe.cjs` 가 쓰는 방식 그대로) → 시트 자동 열림, 배지 텍스트 `1`. 캡처 `mobile-06-autoopen`.
6. `?lab=glass`: `getComputedStyle(#menubar).backdropFilter` 에 `blur(` 포함, `#map-container` 가 `#app` 과 같은 rect, `.ol-zoom` 의 top ≥ `#menubar` bottom, `#left-panel` 열었을 때 bottom ≤ `#statusbar` top. 캡처 `mobile-07-glass-home`, `mobile-08-glass-drawer`, `mobile-09-glass-sheet`. 다크 테마 `mobile-10-glass-dark`.
7. 데스크톱 회귀(에뮬레이션 해제, 창 1280×800 로 `setContentSize`, 다시 load): `#mobile-drawer` hidden, `#app > #toolbar` 있음, `#menubar .menu-center` 있음. 캡처 `desktop-11-regression`.

- [ ] **Step 2:** `npm run build` → `nohup npx vite preview --port 4173 --strictPort &` → PowerShell 로 `& "C:/Users/김용현/Desktop/vibecoding/eGIS/eStoryMap/node_modules/.bin/electron.cmd" scripts/verify/mobile-shell.cjs`. 캡처 PNG 를 눈으로 확인(겹침·잘림·글자 대비). 발견한 문제는 원인 파일에서 고치고 같은 커밋 규칙으로 따로 커밋.
- [ ] **Step 3:** 커밋 `git add scripts/verify/mobile-shell.cjs` → `test(mobile): 휴대폰 셸 Electron 검증 하네스`

---

### Task 8: 마무리 — 설명서·전체 검토·병합·배포

- [ ] `docs/사용설명서.md` 에 휴대폰 문단(헤더의 `≡` 로 도구·메뉴, 레이어 버튼으로 목록, 글래스 실험은 휴대폰에서도) 한 개 추가. 커밋 `docs(mobile): 설명서 휴대폰 문단`.
- [ ] 설계서 끝에 「구현하며 바뀐 점」 항목. 계획서 각 Task 체크박스 갱신.
- [ ] `npm test`, `npm run build`. 브랜치 전체 Opus 검토(읽기 전용) → Important 이상은 고치고 재검토.
- [ ] `main` 병합(noreply 저자), `git push origin main`, 워크트리 프로세스 정리 후 제거, 배포 폴링(번들에 `mobile-drawer` 문자열), e-gis.kr 에서 하네스 6번만 다시 실행해 확인. 메모리 파일 갱신.
