// © 2026 김용현
// src/flow/FlowInteraction.js
/**
 * FlowInteraction — OL 지도 이벤트를 FlowRenderer 에 잇는다.
 *  - pointermove: 맨 위 흐름 레이어부터 hitTest → 호버 강조 + 툴팁
 *                 다른 도구가 활성이거나 포인터가 지도를 벗어나면 강조·툴팁을 정리한다.
 *  - click: 위치 원을 누르면 선택 집합에 넣고(다시 누르면 빼고) 그 위치와 이어진 흐름만 남긴다.
 *           흐름을 누르면(터치 탭 대응) 선택은 바꾸지 않고 툴팁만 보여준다.
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
   * @param {() => boolean} [o.isBlocked]           다른 도구가 활성이면 true (호버·클릭 모두 받지 않음)
   */
  constructor({ map, getRenderers, onSelectionChange = null, isBlocked = () => false }) {
    this.map = map;
    this.getRenderers = getRenderers;
    this.onSelectionChange = onSelectionChange;
    this.isBlocked = isBlocked;
    this.selected = new Map(); // renderer → Set<locationId>
    this.tooltip = null;
    this._hovering = false; // 현재 FlowInteraction 이 커서를 pointer 로 바꿔 놓았는지
    this._onMove = (e) => this._move(e);
    this._onClick = (e) => this._click(e);
    this._onLeave = () => this._clearHover();
  }

  attach() {
    if (this.tooltip) return; // 이미 붙어 있으면 중복 생성하지 않는다
    const target = this.map.getTargetElement();
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'flow-tooltip';
    this.tooltip.hidden = true;
    if (target) target.appendChild(this.tooltip);
    this.map.on('pointermove', this._onMove);
    this.map.on('click', this._onClick);
    this.map.getViewport().addEventListener('pointerleave', this._onLeave);
  }

  detach() {
    this._clearHover();
    this.map.un('pointermove', this._onMove);
    this.map.un('click', this._onClick);
    this.map.getViewport().removeEventListener('pointerleave', this._onLeave);
    if (this.tooltip) this.tooltip.remove();
    this.tooltip = null;
    const target = this.map.getTargetElement();
    if (target) target.style.cursor = '';
    this._hovering = false;
  }

  hideTooltip() { if (this.tooltip) this.tooltip.hidden = true; }

  /**
   * 호버 강조·툴팁을 정리한다 (다른 도구 활성화, 포인터가 지도를 벗어남, detach 시 사용).
   * 커서는 FlowInteraction 이 이전에 pointer 로 바꿔 둔 경우에만 되돌린다 —
   * 그렇지 않으면 다른 도구가 이미 지정해 둔 커서(예: crosshair)를 덮어써 버리게 된다.
   */
  _clearHover() {
    this.hideTooltip();
    for (const r of this.getRenderers()) r.setHover(null);
    const target = this.map.getTargetElement();
    if (target && this._hovering) target.style.cursor = '';
    this._hovering = false;
  }

  /** 저장된 선택을 되살릴 때 (프로젝트 복원) */
  setSelection(renderer, ids) {
    const set = new Set(ids || []);
    if (set.size) this.selected.set(renderer, set); else this.selected.delete(renderer);
    renderer.setHighlight([...set]);
  }

  /** 레이어 삭제 등으로 렌더러를 더 이상 쓰지 않을 때 선택 상태를 잊는다 */
  forget(renderer) {
    this.selected.delete(renderer);
  }

  _hit(pixel, renderers) {
    for (let i = renderers.length - 1; i >= 0; i--) {
      const hit = renderers[i].hitTest(pixel);
      if (hit) return { renderer: renderers[i], hit };
    }
    return null;
  }

  /** 툴팁 내용을 채우고 pixel 위치에 놓는다. 지도 가장자리에 가까우면 반대쪽으로 뒤집는다. */
  _showTooltip(found, pixel) {
    if (!this.tooltip) return;
    const unit = (found.renderer.dataset && found.renderer.dataset.meta && found.renderer.dataset.meta.unit) || '';
    this.tooltip.innerHTML = formatFlowTip(found.hit, found.renderer, unit);
    this.tooltip.hidden = false;
    this.tooltip.style.left = pixel[0] + 'px';
    this.tooltip.style.top = pixel[1] + 'px';
    this.tooltip.classList.remove('flow-tooltip--left', 'flow-tooltip--up');
    const size = this.map.getSize();
    if (size) {
      const [w, h] = size;
      if (pixel[0] + 14 + this.tooltip.offsetWidth > w) this.tooltip.classList.add('flow-tooltip--left');
      if (pixel[1] + 14 + this.tooltip.offsetHeight > h) this.tooltip.classList.add('flow-tooltip--up');
    }
  }

  _move(evt) {
    if (this.isBlocked()) { this._clearHover(); return; }
    if (!this.tooltip) return;
    if (evt.dragging) { this.hideTooltip(); return; }
    const renderers = this.getRenderers();
    const found = this._hit(evt.pixel, renderers);
    for (const r of renderers) r.setHover(found && found.renderer === r ? found.hit.key : null);
    const target = this.map.getTargetElement();
    if (target && !!found !== this._hovering) {
      target.style.cursor = found ? 'pointer' : '';
      this._hovering = !!found;
    }
    if (!found) { this.hideTooltip(); return; }
    this._showTooltip(found, evt.pixel);
  }

  _click(evt) {
    if (this.isBlocked()) return;
    const renderers = this.getRenderers();
    const found = this._hit(evt.pixel, renderers);
    if (found && found.hit.type === 'location') {
      const set = this.selected.get(found.renderer) || new Set();
      const id = found.hit.location.id;
      if (set.has(id)) set.delete(id); else set.add(id);
      this.setSelection(found.renderer, [...set]);
      if (this.onSelectionChange) this.onSelectionChange(found.renderer, [...set]);
      this._showTooltip(found, evt.pixel);
      return;
    }
    if (found) {
      // 흐름 자체를 눌렀을 때 — 터치 기기는 호버가 없으므로 탭으로 툴팁만 보여준다
      this._showTooltip(found, evt.pixel);
      return;
    }
    this.hideTooltip();
    if (this.selected.size > 0) {
      for (const [r] of this.selected) {
        this.setSelection(r, []);
        if (this.onSelectionChange) this.onSelectionChange(r, []);
      }
    }
  }
}
