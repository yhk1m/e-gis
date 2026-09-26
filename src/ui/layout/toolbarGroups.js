/**
 * 툴바 묶음 펼치기
 *
 * 태블릿 폭에서 툴바가 넘치지 않도록 도구를 묶음으로 접어 둔다.
 * - 선택 묶음: 「선택」 버튼만 보이고, 선택 도구(또는 같은 묶음의 자르기)가 켜지면
 *   속성 보기·합치기·자르기가 옆으로 펼쳐진다. 머리 버튼이 곧 선택 도구다.
 * - 그리기·측정 묶음: 머리 버튼(data-group-toggle)을 누르면 펼쳐지고 다시 누르면 접힌다.
 *   둘은 한 번에 하나만 펼친다. 접히는 묶음의 도구가 켜져 있으면 끈다
 *   (보이지 않는 도구가 켜진 채 남지 않게).
 *
 * 묶음 요소: .toolbar-group[data-collapsible], 펼침 상태는 .is-open,
 * 접힐 때 숨는 버튼은 .toolbar-sub (CSS 가 숨긴다).
 */

const TOGGLE_GROUPS = ['draw', 'measure'];

/** 도구 이름 → 묶음 이름 (묶음 밖 도구는 null) */
export function groupOfTool(tool) {
  if (!tool) return null;
  if (tool === 'select' || tool === 'edit-split') return 'select';
  if (tool.startsWith('draw-')) return 'draw';
  if (tool.startsWith('measure-')) return 'measure';
  return null;
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.toolbar
 * @param {() => string|null} opts.getCurrentTool
 * @param {() => void} opts.deactivateCurrentTool  현재 도구를 끈다(툴바 표시 갱신 포함)
 * @returns {{ sync: (tool: string|null) => void, isOpen: (group: string) => boolean }}
 */
export function initToolbarGroups({ toolbar, getCurrentTool, deactivateCurrentTool }) {
  const groupEl = (name) => toolbar.querySelector(`.toolbar-group[data-group="${name}"]`);

  const setOpen = (name, open) => {
    const el = groupEl(name);
    if (!el) return;
    el.classList.toggle('is-open', open);
    el.querySelector('[data-group-toggle]')?.setAttribute('aria-expanded', String(open));
  };

  const isOpen = (name) => !!groupEl(name)?.classList.contains('is-open');

  /** 켜진 도구에 맞춰 펼침 상태를 맞춘다 */
  const sync = (tool) => {
    const g = groupOfTool(tool);
    setOpen('select', g === 'select');
    if (g === 'draw' || g === 'measure') {
      TOGGLE_GROUPS.forEach((name) => setOpen(name, name === g));
    } else if (g === 'select') {
      TOGGLE_GROUPS.forEach((name) => setOpen(name, false));
    }
    // 도구가 꺼졌을 때(null)는 그리기·측정 묶음을 그대로 둔다 — 이어서 다른 도구를 고르기 쉽게
  };

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-group-toggle]');
    if (!btn || !toolbar.contains(btn)) return;
    const name = btn.dataset.groupToggle;
    const opening = !isOpen(name);
    const currentGroup = groupOfTool(getCurrentTool());

    if (opening) {
      // 다른 그리기·측정 묶음을 접는다. 그 묶음의 도구가 켜져 있으면 끈다.
      TOGGLE_GROUPS.forEach((other) => {
        if (other === name) return;
        if (currentGroup === other) deactivateCurrentTool();
        setOpen(other, false);
      });
      setOpen(name, true);
    } else {
      if (currentGroup === name) deactivateCurrentTool();
      setOpen(name, false);
    }
  });

  TOGGLE_GROUPS.forEach((name) => setOpen(name, false));
  sync(getCurrentTool());
  return { sync, isOpen };
}
