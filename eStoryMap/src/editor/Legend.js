// © 2026 김용현
// eStoryMap/src/editor/Legend.js
// 범례 박스 — #map 자식 오버레이. 편집기=드래그·라벨수정·숨김토글, 발표=정적 표시.
// 순수 도출은 core/legend.js(buildLegendItems), DEM 램프색은 core/rasterColor.js.
// 접착 컴포넌트라 단위 테스트 없음 — 수동 스모크.
import { buildLegendItems, DEFAULT_LEGEND } from '../core/legend.js';
import { DEM_COLOR_RAMP } from '../core/rasterColor.js';

function rampGradientCss() {
  const stops = DEM_COLOR_RAMP.map(
    (s) => `rgb(${s.color[0]},${s.color[1]},${s.color[2]}) ${Math.round(s.value * 100)}%`,
  );
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * @param {HTMLElement} container - #legend (#map 자식, position:absolute)
 * @param {object} deps
 * @param {() => object} deps.getDoc
 * @param {(change:{pos?:{x,y}, override?:{key,label?,hidden?}}) => void} deps.onChange
 */
export function createLegend(container, { getDoc, onChange }) {
  container.hidden = true;
  let editable = false;
  let drag = null; // {grabX, grabY, x, y}

  // 드래그(편집기 전용) — 컨테이너 1회 바인딩. 라벨/눈 버튼은 stopPropagation으로 제외.
  container.addEventListener('pointerdown', (e) => {
    if (!editable) return;
    const rect = container.getBoundingClientRect();
    drag = { grabX: e.clientX - rect.left, grabY: e.clientY - rect.top, x: null, y: null };
    container.setPointerCapture(e.pointerId);
    container.classList.add('dragging');
    e.preventDefault();
  });
  container.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const mr = container.parentElement.getBoundingClientRect(); // #map 기준
    const x = Math.max(0, Math.min(1, (e.clientX - mr.left - drag.grabX) / mr.width));
    const y = Math.max(0, Math.min(1, (e.clientY - mr.top - drag.grabY) / mr.height));
    drag.x = x; drag.y = y;
    container.style.left = `${x * 100}%`;
    container.style.top = `${y * 100}%`;
  });
  function endDrag(e) {
    if (!drag) return;
    try { container.releasePointerCapture(e.pointerId); } catch { /* 무시 */ }
    container.classList.remove('dragging');
    const moved = drag.x != null;
    const pos = { x: drag.x, y: drag.y };
    drag = null;
    if (moved) onChange({ pos }); // 저장(재렌더 없음 — 이미 위치 반영됨)
  }
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);

  function makeRow(item) {
    const row = document.createElement('div');
    row.className = 'legend-row' + (item.hidden ? ' legend-hidden' : '');

    const mark = document.createElement('span');
    mark.className = item.kind === 'ramp' ? 'legend-mark legend-ramp' : 'legend-mark';
    mark.style.background = item.kind === 'ramp' ? rampGradientCss() : item.color;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;

    row.append(mark, label);

    if (editable) {
      label.contentEditable = 'true';
      label.spellcheck = false;
      label.addEventListener('pointerdown', (e) => e.stopPropagation()); // 드래그 아닌 편집
      label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
      });
      label.addEventListener('blur', () => {
        const text = label.textContent.trim();
        if (text && text !== item.label) onChange({ override: { key: item.key, label: text } });
        else label.textContent = item.label; // 빈 값이면 되돌림
      });

      const eye = document.createElement('button');
      eye.type = 'button';
      eye.className = 'legend-eye';
      eye.textContent = item.hidden ? '🚫' : '👁';
      eye.title = item.hidden ? '범례에 표시' : '범례에서 숨김';
      eye.addEventListener('pointerdown', (e) => e.stopPropagation());
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        onChange({ override: { key: item.key, hidden: !item.hidden } });
      });
      row.appendChild(eye);
    }
    return row;
  }

  /** @param {object} page @param {{editable?:boolean}} opts */
  function render(page, { editable: ed = false } = {}) {
    editable = ed;
    const doc = getDoc();
    const legend = (doc && doc.meta.legend) || DEFAULT_LEGEND;
    const all = doc ? buildLegendItems(doc, page) : [];
    const shown = editable ? all : all.filter((i) => !i.hidden); // 발표는 숨김 제외
    if (!legend.visible || shown.length === 0) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.classList.toggle('editable', editable);
    container.style.left = `${legend.pos.x * 100}%`;
    container.style.top = `${legend.pos.y * 100}%`;
    container.innerHTML = '';
    for (const item of shown) container.appendChild(makeRow(item));
  }

  return { render };
}
