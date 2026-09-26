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
  return { openDrawer, closeDrawer, isPhone, syncLayersBtn, destroy() { mql.removeEventListener?.('change', apply); moveOut(); } };
}
