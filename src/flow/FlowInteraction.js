// © 2026 김용현
// src/flow/FlowInteraction.js
/**
 * FlowInteraction — OL 지도 이벤트를 FlowRenderer 에 잇는다.
 *  - pointermove: 맨 위 흐름 레이어부터 hitTest → 호버 강조 + 툴팁
 *  - click: 위치 원을 누르면 선택 집합에 넣고(다시 누르면 빼고) 그 위치와 이어진 흐름만 남긴다.
 *           빈 곳을 누르면 해제.
 * 제품(FlowTool)과 시연 페이지가 같이 쓴다. 렌더러 목록은 getRenderers() 로 매번 받는다.
 */
import { escapeHtml } from '../utils/escapeHtml.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

export function formatFlowTip(hit, renderer, unit = '') {
  if (hit.type === 'flow') {
    const o = renderer.getLocation(hit.flow.origin);
    const d = renderer.getLocation(hit.flow.dest);
    return `<b>${escapeHtml(o ? o.name : hit.flow.origin)} → ${escapeHtml(d ? d.name : hit.flow.dest)}</b>  ${fmt(hit.flow.count)}${escapeHtml(unit)}`;
  }
  const t = hit.totals;
  const sign = t.net > 0 ? '+' : '';
  return `<b>${escapeHtml(hit.location.name)}</b>  유입 ${fmt(t.inflow)} · 유출 ${fmt(t.outflow)} · 순이동 ${sign}${fmt(t.net)}${escapeHtml(unit)}`;
}

export class FlowInteraction {
  /**
   * @param {Object} o
   * @param {import('ol/Map').default} o.map
   * @param {() => FlowRenderer[]} o.getRenderers   보이는 흐름 렌더러, 아래→위 순서
   * @param {(renderer, ids: string[]) => void} [o.onSelectionChange]
   * @param {() => boolean} [o.isBlocked]           다른 도구가 활성이면 true (클릭 필터를 받지 않음)
   */
  constructor({ map, getRenderers, onSelectionChange = null, isBlocked = () => false }) {
    this.map = map;
    this.getRenderers = getRenderers;
    this.onSelectionChange = onSelectionChange;
    this.isBlocked = isBlocked;
    this.selected = new Map(); // renderer → Set<locationId>
    this.tooltip = null;
    this._onMove = (e) => this._move(e);
    this._onClick = (e) => this._click(e);
  }

  attach() {
    const target = this.map.getTargetElement();
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'flow-tooltip';
    this.tooltip.hidden = true;
    target.appendChild(this.tooltip);
    this.map.on('pointermove', this._onMove);
    this.map.on('click', this._onClick);
  }

  detach() {
    this.map.un('pointermove', this._onMove);
    this.map.un('click', this._onClick);
    if (this.tooltip) this.tooltip.remove();
    this.tooltip = null;
    this.map.getTargetElement().style.cursor = '';
  }

  hideTooltip() { if (this.tooltip) this.tooltip.hidden = true; }

  /** 저장된 선택을 되살릴 때 (프로젝트 복원) */
  setSelection(renderer, ids) {
    const set = new Set(ids || []);
    if (set.size) this.selected.set(renderer, set); else this.selected.delete(renderer);
    renderer.setHighlight([...set]);
  }

  _hit(pixel) {
    const renderers = this.getRenderers();
    for (let i = renderers.length - 1; i >= 0; i--) {
      const hit = renderers[i].hitTest(pixel);
      if (hit) return { renderer: renderers[i], hit };
    }
    return null;
  }

  _move(evt) {
    if (!this.tooltip) return;
    if (evt.dragging) { this.hideTooltip(); return; }
    const found = this._hit(evt.pixel);
    for (const r of this.getRenderers()) r.setHover(found && found.renderer === r ? found.hit.key : null);
    this.map.getTargetElement().style.cursor = found ? 'pointer' : '';
    if (!found) { this.hideTooltip(); return; }
    const unit = (found.renderer.dataset && found.renderer.dataset.meta && found.renderer.dataset.meta.unit) || '';
    this.tooltip.innerHTML = formatFlowTip(found.hit, found.renderer, unit);
    this.tooltip.style.left = evt.pixel[0] + 'px';
    this.tooltip.style.top = evt.pixel[1] + 'px';
    this.tooltip.hidden = false;
  }

  _click(evt) {
    if (this.isBlocked()) return;
    const found = this._hit(evt.pixel);
    if (found && found.hit.type === 'location') {
      const set = this.selected.get(found.renderer) || new Set();
      const id = found.hit.location.id;
      if (set.has(id)) set.delete(id); else set.add(id);
      this.setSelection(found.renderer, [...set]);
      if (this.onSelectionChange) this.onSelectionChange(found.renderer, [...set]);
      return;
    }
    if (!found && this.selected.size > 0) {
      for (const [r] of this.selected) {
        this.setSelection(r, []);
        if (this.onSelectionChange) this.onSelectionChange(r, []);
      }
    }
  }
}
