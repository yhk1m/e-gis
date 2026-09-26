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

  it('프로젝트 불러오기 뒤 레이어를 더해도 시트를 다시 열지 않는다', () => {
    layers = [{}]; bus.emit('la'); expect(layout.isSidebarHidden()).toBe(false);
    layout.setSidebarHidden(true);
    bus.emit('pl');
    layers = [{}, {}]; bus.emit('la'); expect(layout.isSidebarHidden()).toBe(true);
  });

  it('빈 프로젝트를 불러오면 다음 첫 레이어에 시트를 연다', () => {
    bus.emit('pl');
    layers = [{}]; bus.emit('la'); expect(layout.isSidebarHidden()).toBe(false);
  });

  it('데스크톱에서 접어 둔 툴바는 서랍에 넣을 때 편다', () => {
    m.fire(false);
    const toolbar = document.getElementById('toolbar');
    const btn = document.createElement('button'); btn.id = 'toolbar-collapse'; btn.className = 'collapsed'; btn.title = '도구 모음 펴기';
    toolbar.appendChild(btn); toolbar.classList.add('collapsed');
    m.fire(true);
    expect(document.querySelector('#mobile-drawer-tools #toolbar')).not.toBeNull();
    expect(toolbar.classList.contains('collapsed')).toBe(false);
    expect(btn.classList.contains('collapsed')).toBe(false);
    expect(btn.title).toBe('도구 모음 접기');
  });

  it('서랍에서 펼친 드롭다운은 헤더로 돌아올 때 닫힌다', () => {
    const item = document.querySelector('#mobile-drawer-menus .menu-item.dropdown');
    item.classList.add('open');
    m.fire(false);
    expect(document.querySelector('#menubar .menu-item.dropdown')).toBe(item);
    expect(item.classList.contains('open')).toBe(false);
  });
});
