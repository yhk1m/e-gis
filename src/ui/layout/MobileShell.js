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
    // 데스크톱에서 접어 둔 툴바는 휴대폰에서 펼칠 방법이 없으니(접기 버튼 숨김) 편 상태로 넣는다
    const toolbar = $('toolbar');
    if (toolbar?.classList.contains('collapsed')) {
      toolbar.classList.remove('collapsed');
      const collapseBtn = $('toolbar-collapse');
      if (collapseBtn) { collapseBtn.classList.remove('collapsed'); collapseBtn.title = '도구 모음 접기'; }
    }
    doc.body.classList.add('phone-shell');
  }
  function moveOut() {
    for (const [el, ph] of placeholders) { ph.parentNode?.replaceChild(el, ph); }
    placeholders.clear();
    // 서랍 안에서 펼친 드롭다운이 헤더로 돌아와 열린 채 남지 않게
    doc.querySelectorAll('.menu-item.dropdown.open').forEach((el) => el.classList.remove('open'));
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
  // 불러오기는 레이어를 다 넣은 뒤(LAYER_ADDED 마다 자동 열기 시도) PROJECT_LOADED 를 쏜다 — 레이어가 있으면 이미 연 것으로 친다
  eventBus?.on(Events.PROJECT_LOADED, () => { autoOpened = updateCount() > 0; });
  eventBus?.on(Events.PROJECT_NEW, () => { autoOpened = false; updateCount(); });

  mql.addEventListener?.('change', apply);
  apply(); updateCount(); syncLayersBtn();
  return { openDrawer, closeDrawer, isPhone, syncLayersBtn, destroy() { mql.removeEventListener?.('change', apply); moveOut(); } };
}
