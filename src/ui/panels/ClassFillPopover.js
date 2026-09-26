// © 2026 김용현
/**
 * ClassFillPopover - 범례 색 칸 옆에 뜨는 구간 채움 편집 팝오버 (실험 class-fill)
 *
 * 채움 종류 넷(단색·패턴·이미지·질감)을 탭으로 고르고, 바꾸는 즉시
 * choroplethTool.setClassFill / setClassColor 로 지도·범례에 반영한다.
 * 아래에 "모든 구간에 프리셋"과 "팔레트로 되돌리기".
 * 지도 컨테이너(#map) 안에 절대 위치로 뜨고, 바깥 클릭·Esc 로 닫힌다.
 * 이미지 읽기 실패 같은 알림은 onMessage(상태 표시줄)로 보낸다.
 * 되돌리기(HistoryManager)는 범위 밖.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「1단계」
 */
import { choroplethTool } from '../../tools/ChoroplethTool.js';
import { normalizeFill, presetFills, fillSpecBytes, TEXTURE_NAMES, HATCH_ANGLES } from '../../tools/classFill.js';
import { tileDataUrl, reencodeImageFile } from '../../tools/classFillCanvas.js';
import { eventBus, Events } from '../../utils/EventBus.js';

const KIND_TABS = [
  { kind: 'solid', label: '단색' },
  { kind: 'pattern', label: '패턴' },
  { kind: 'image', label: '이미지' },
  { kind: 'texture', label: '질감' }
];

const TEXTURE_LABELS = { paper: '종이', gloss: '광택', sand: '모래', forest: '숲', water: '물' };
const PRESET_LABELS = { 'bw-hatch': '흑백 인쇄용 사선(밀도 단계)', 'dots-density': '점 밀도 단계', 'texture-uniform': '종이 질감 통일' };

const CLOSE_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

function tabOf(spec) {
  if (!spec || spec.kind === 'solid') return 'solid';
  if (spec.kind === 'image' || spec.kind === 'texture') return spec.kind;
  return 'pattern';
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** onMessage 를 안 넘겼을 때의 기본값 — 상태 표시줄에 3초 */
function defaultMessage(message) {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = message;
  setTimeout(() => { if (el.textContent === message) el.textContent = '준비'; }, 3000);
}

export class ClassFillPopover {
  constructor({ tool = choroplethTool, onMessage = defaultMessage } = {}) {
    this.tool = tool;
    this.onMessage = onMessage;
    this.el = null;
    this.layerId = null;
    this.classIndex = -1;
    this.anchor = null;
    this.tab = 'solid';
    /** 탭마다 마지막 사양을 기억해 탭을 오가도 값이 유지되게 */
    this.drafts = {};
    this._onKey = null;
    this._onDown = null;
    this._onRemoved = null;
  }

  open({ layerId, classIndex, anchor }) {
    this.close();
    const cfg = this.tool.configOf(layerId);
    if (!cfg || !anchor) return;
    const map = document.getElementById('map');
    if (!map) return;

    this.layerId = layerId;
    this.classIndex = classIndex;
    this.anchor = anchor;
    const current = normalizeFill(cfg.fills ? cfg.fills[classIndex] : null);
    this.tab = tabOf(current);
    this.drafts = { [this.tab]: current };

    this.el = document.createElement('div');
    this.el.className = 'class-fill-popover';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', '구간 채움');
    this.el.innerHTML = `
      <div class="class-fill-head">
        <span class="class-fill-title">${classIndex + 1}구간 채움</span>
        <button type="button" class="class-fill-close" aria-label="닫기">${CLOSE_ICON}</button>
      </div>
      <div class="class-fill-kinds" role="tablist">
        ${KIND_TABS.map((t) => `<button type="button" class="class-fill-kind" role="tab" data-kind="${t.kind}" aria-selected="${t.kind === this.tab}">${t.label}</button>`).join('')}
      </div>
      <div class="class-fill-body"></div>
      <div class="class-fill-foot">
        <div class="class-fill-row">
          <select class="class-fill-preset" aria-label="모든 구간에 프리셋">
            <option value="">모든 구간에 프리셋…</option>
            ${Object.keys(PRESET_LABELS).map((k) => `<option value="${k}">${PRESET_LABELS[k]}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-sm class-fill-preset-apply">적용</button>
        </div>
        <button type="button" class="btn btn-sm btn-outline class-fill-reset">팔레트로 되돌리기</button>
      </div>`;
    map.appendChild(this.el);
    this.renderBody();
    this.bind();
    this.position(map);
  }

  /* ---------- 본문 ---------- */

  currentSpec() {
    return this.drafts[this.tab] || this.defaultSpecFor(this.tab);
  }

  defaultSpecFor(tab) {
    if (tab === 'pattern') return normalizeFill({ kind: 'hatch' });
    if (tab === 'texture') return normalizeFill({ kind: 'texture' });
    if (tab === 'image') return { kind: 'solid' };   // 파일을 고르기 전까지는 단색
    return { kind: 'solid' };
  }

  baseColor() {
    const cfg = this.tool.configOf(this.layerId);
    return (cfg && cfg.colors[this.classIndex]) || '#808080';
  }

  renderBody() {
    const body = this.el.querySelector('.class-fill-body');
    const spec = this.currentSpec();
    const base = this.baseColor();

    if (this.tab === 'solid') {
      body.innerHTML = `
        <div class="class-fill-row"><label>색 <input type="color" class="cf-color" value="${base}"></label></div>`;
      body.querySelector('.cf-color').addEventListener('input', (e) => {
        this.tool.setClassColor(this.layerId, this.classIndex, e.target.value);
      });
      return;
    }

    if (this.tab === 'pattern') {
      const p = spec.kind === 'solid' ? this.defaultSpecFor('pattern') : spec;
      const isHatch = p.kind === 'hatch';
      const isDots = p.kind === 'dots';
      const customBg = p.background !== 'class' && p.background !== 'none';
      body.innerHTML = `
        <div class="class-fill-row"><label>종류
          <select class="cf-ptype">
            <option value="hatch">사선</option><option value="dots">점</option><option value="cross">격자</option>
          </select></label>
          <label>색 <input type="color" class="cf-pcolor" value="${p.color}"></label></div>
        <div class="class-fill-row"><label>간격 <input type="range" class="cf-spacing" min="4" max="24" step="1" value="${p.spacing}"><span class="cf-val cf-spacing-val">${p.spacing}</span></label></div>
        <div class="class-fill-row cf-row-width"><label>굵기 <input type="range" class="cf-width" min="0.5" max="6" step="0.5" value="${isDots ? 1.5 : p.width}"><span class="cf-val cf-width-val">${isDots ? 1.5 : p.width}</span></label></div>
        <div class="class-fill-row cf-row-radius"><label>점 크기 <input type="range" class="cf-radius" min="0.5" max="6" step="0.1" value="${isDots ? p.radius : 1.6}"><span class="cf-val cf-radius-val">${isDots ? p.radius : 1.6}</span></label></div>
        <div class="class-fill-row cf-row-angle"><label>각도
          <select class="cf-angle">${HATCH_ANGLES.map((a) => `<option value="${a}">${a}°</option>`).join('')}</select></label></div>
        <div class="class-fill-row"><label>배경
          <select class="cf-bg">
            <option value="class">구간 색</option><option value="none">없음</option><option value="custom">직접</option>
          </select></label>
          <input type="color" class="cf-bgcolor" value="${customBg ? p.background : '#ffffff'}" aria-label="배경 색"></div>`;
      body.querySelector('.cf-ptype').value = p.kind;
      body.querySelector('.cf-angle').value = String(isHatch ? p.angle : 45);
      body.querySelector('.cf-bg').value = customBg ? 'custom' : p.background;
      this.syncPatternRows();
      const apply = () => {
        const kind = body.querySelector('.cf-ptype').value;
        const bgSel = body.querySelector('.cf-bg').value;
        const background = bgSel === 'custom' ? body.querySelector('.cf-bgcolor').value : bgSel;
        const next = normalizeFill({
          kind,
          color: body.querySelector('.cf-pcolor').value,
          spacing: Number(body.querySelector('.cf-spacing').value),
          width: Number(body.querySelector('.cf-width').value),
          radius: Number(body.querySelector('.cf-radius').value),
          angle: Number(body.querySelector('.cf-angle').value),
          background
        });
        this.drafts.pattern = next;
        this.syncPatternRows();
        this.tool.setClassFill(this.layerId, this.classIndex, next);
      };
      body.querySelectorAll('select, input').forEach((el) => {
        el.addEventListener('input', () => { this.showRangeValues(); apply(); });
        el.addEventListener('change', () => { this.showRangeValues(); apply(); });
      });
      return;
    }

    if (this.tab === 'image') {
      const img = spec.kind === 'image' ? spec : null;
      body.innerHTML = `
        <div class="class-fill-row"><label class="cf-file-label">이미지 파일 <input type="file" class="cf-file" accept="image/png,image/jpeg,image/svg+xml"></label></div>
        <div class="class-fill-row"><label>배율 <input type="range" class="cf-iscale" min="0.25" max="4" step="0.25" value="${img ? img.scale : 1}" ${img ? '' : 'disabled'}><span class="cf-val cf-iscale-val">${img ? img.scale : 1}</span></label></div>
        <div class="class-fill-row"><label>불투명도 <input type="range" class="cf-iopacity" min="0" max="1" step="0.05" value="${img ? img.opacity : 1}" ${img ? '' : 'disabled'}><span class="cf-val cf-iopacity-val">${img ? img.opacity : 1}</span></label></div>
        <div class="class-fill-row class-fill-note"><span class="cf-isize">${img ? `${img.width}×${img.height}px · 저장 크기 약 ${formatBytes(fillSpecBytes(img))}` : ''}</span></div>`;
      body.querySelector('.cf-file').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const layerId = this.layerId;
        const classIndex = this.classIndex;
        try {
          const { dataUrl, width, height } = await reencodeImageFile(file);
          // 읽는 사이 닫혔거나 다른 칸으로 옮겨 갔으면 버린다
          if (!this.el || this.layerId !== layerId || this.classIndex !== classIndex) return;
          const prev = this.drafts.image && this.drafts.image.kind === 'image' ? this.drafts.image : {};
          const next = normalizeFill({ kind: 'image', dataUrl, width, height, scale: prev.scale, opacity: prev.opacity });
          this.drafts.image = next;
          this.tool.setClassFill(this.layerId, this.classIndex, next);
          if (this.tab === 'image') this.renderBody();
        } catch (err) {
          this.onMessage((err && err.message) || '이미지를 읽을 수 없습니다.');
        }
      });
      const applyRanges = () => {
        if (!this.drafts.image || this.drafts.image.kind !== 'image') return;
        const next = normalizeFill({
          ...this.drafts.image,
          scale: Number(body.querySelector('.cf-iscale').value),
          opacity: Number(body.querySelector('.cf-iopacity').value)
        });
        this.drafts.image = next;
        this.tool.setClassFill(this.layerId, this.classIndex, next);
      };
      body.querySelectorAll('.cf-iscale, .cf-iopacity').forEach((el) => {
        el.addEventListener('input', () => { this.showRangeValues(); applyRanges(); });
      });
      return;
    }

    // texture
    const t = spec.kind === 'texture' ? spec : this.defaultSpecFor('texture');
    body.innerHTML = `
      <div class="class-fill-textures">
        ${TEXTURE_NAMES.map((name) => {
          const tile = tileDataUrl({ kind: 'texture', name, strength: 0.7 }, base, 32);
          const style = tile ? `background-image:url(${tile})` : `background:${base}`;
          return `<button type="button" class="cf-texture" data-name="${name}" aria-pressed="${name === t.name}" title="${TEXTURE_LABELS[name]}">
            <span class="cf-texture-tile" style="${style}"></span><span class="cf-texture-label">${TEXTURE_LABELS[name]}</span></button>`;
        }).join('')}
      </div>
      <div class="class-fill-row"><label>강도 <input type="range" class="cf-strength" min="0" max="1" step="0.05" value="${t.strength}"><span class="cf-val cf-strength-val">${t.strength}</span></label></div>`;
    const applyTexture = (name) => {
      const next = { kind: 'texture', name, strength: Number(body.querySelector('.cf-strength').value) };
      this.drafts.texture = next;
      body.querySelectorAll('.cf-texture').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.name === name)));
      this.tool.setClassFill(this.layerId, this.classIndex, next);
    };
    body.querySelectorAll('.cf-texture').forEach((b) => b.addEventListener('click', () => applyTexture(b.dataset.name)));
    body.querySelector('.cf-strength').addEventListener('input', () => {
      this.showRangeValues();
      const pressed = body.querySelector('.cf-texture[aria-pressed="true"]');
      applyTexture(pressed ? pressed.dataset.name : t.name);
    });
  }

  /** 패턴 종류에 따라 각도·굵기·점 크기 행을 보이고 숨긴다 */
  syncPatternRows() {
    const body = this.el.querySelector('.class-fill-body');
    const kind = body.querySelector('.cf-ptype').value;
    body.querySelector('.cf-row-angle').hidden = kind !== 'hatch';
    body.querySelector('.cf-row-width').hidden = kind === 'dots';
    body.querySelector('.cf-row-radius').hidden = kind !== 'dots';
    body.querySelector('.cf-bgcolor').hidden = body.querySelector('.cf-bg').value !== 'custom';
  }

  showRangeValues() {
    this.el.querySelectorAll('input[type="range"]').forEach((r) => {
      const out = r.parentElement.querySelector('.cf-val');
      if (out) out.textContent = r.value;
    });
  }

  /* ---------- 공통 ---------- */

  bind() {
    this.el.querySelector('.class-fill-close').addEventListener('click', () => this.close());

    this.el.querySelectorAll('.class-fill-kind').forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.kind));
    });

    this.el.querySelector('.class-fill-preset-apply').addEventListener('click', () => {
      const name = this.el.querySelector('.class-fill-preset').value;
      const cfg = this.tool.configOf(this.layerId);
      if (!name || !cfg) return;
      const fills = presetFills(name, cfg.colors.length);
      if (!fills) return;
      this.tool.setAllFills(this.layerId, fills);
      this.drafts = {};
      this.drafts[tabOf(fills[this.classIndex])] = normalizeFill(fills[this.classIndex]);
      this.switchTab(tabOf(fills[this.classIndex]), { silent: true });
    });

    this.el.querySelector('.class-fill-reset').addEventListener('click', () => {
      this.tool.setAllFills(this.layerId, null);
      this.drafts = {};
      this.switchTab('solid', { silent: true });
    });

    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._onKey);

    this._onDown = (e) => {
      if (!this.el) return;
      if (this.el.contains(e.target)) return;
      if (this.anchor && (e.target === this.anchor || this.anchor.contains(e.target))) return;
      this.close();
    };
    document.addEventListener('mousedown', this._onDown);

    this._onRemoved = (data) => { if (data && data.layerId === this.layerId) this.close(); };
    eventBus.on(Events.LAYER_REMOVED, this._onRemoved);
  }

  /**
   * 탭 전환. silent 가 아니면 그 탭의 기본 사양을 바로 적용한다
   * (패턴 탭을 누르는 순간 지도에 사선이 보여야 "무엇이 바뀌는지" 알 수 있다).
   */
  switchTab(kind, { silent = false } = {}) {
    if (!this.el) return;
    this.tab = kind;
    this.el.querySelectorAll('.class-fill-kind').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kind === kind)));
    if (!silent) {
      if (kind === 'solid') {
        this.tool.setClassFill(this.layerId, this.classIndex, { kind: 'solid' });
      } else if (kind === 'pattern' || kind === 'texture') {
        const next = this.drafts[kind] || this.defaultSpecFor(kind);
        this.drafts[kind] = next;
        this.tool.setClassFill(this.layerId, this.classIndex, next);
      } else if (kind === 'image' && this.drafts.image && this.drafts.image.kind === 'image') {
        this.tool.setClassFill(this.layerId, this.classIndex, this.drafts.image);
      }
    }
    this.renderBody();
  }

  /** 앵커(색 칸) 오른쪽에 붙이되 지도 밖으로 나가면 안쪽으로 당긴다 */
  position(map) {
    const mapRect = map.getBoundingClientRect();
    const a = this.anchor.getBoundingClientRect();
    let left = a.right - mapRect.left + 8;
    let top = a.top - mapRect.top - 8;
    const w = this.el.offsetWidth || 280;
    const h = this.el.offsetHeight || 320;
    if (left + w > mapRect.width - 8) left = Math.max(8, a.left - mapRect.left - w - 8);
    if (top + h > mapRect.height - 8) top = Math.max(8, mapRect.height - h - 8);
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
  }

  close() {
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this._onDown) { document.removeEventListener('mousedown', this._onDown); this._onDown = null; }
    if (this._onRemoved) { eventBus.off(Events.LAYER_REMOVED, this._onRemoved); this._onRemoved = null; }
    if (this.el) { this.el.remove(); this.el = null; }
    this.anchor = null;
  }
}

export const classFillPopover = new ClassFillPopover();
