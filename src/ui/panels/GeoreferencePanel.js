// © 2026 김용현
// 이미지 지리참조 패널 — 이미지 로드 → 이미지/지도 대응점(GCP) 수집 → 아핀 워핑 미리보기 → 레이어로 추가.
// 지도를 클릭해야 하므로 전체화면 모달이 아닌 좌측 플로팅 패널(지도 조작 방해 안 함).
import { georeferenceTool } from '../../tools/GeoreferenceTool.js';
import { toLonLat } from 'ol/proj';

class GeoreferencePanel {
  constructor() {
    this.el = null;
    this.image = null;
    this.viewScale = 1;   // 이미지 캔버스 표시 배율(픽셀 배율)
    this.fitScale = 1;    // 패널 폭에 맞춘 최소 배율
    this.gcps = [];        // { imgX, imgY, mapX, mapY, label }
    this.pendingImg = null; // 이미지 점 찍고 지도 점 대기 중 { imgX, imgY, label }
    this.seq = 0;
    this.mode = 'affine';   // 'affine' | 'projective'
  }

  show() {
    this.close();
    georeferenceTool.cleanup();
    this.image = null; this.gcps = []; this.pendingImg = null; this.seq = 0; this.mode = 'affine';
    this.el = document.createElement('div');
    this.el.className = 'georef-panel';
    this.el.innerHTML = this._html();
    document.body.appendChild(this.el);
    this._bind();
  }

  _html() {
    return `
      <div class="georef-header">
        <strong>🗺️ 지리참조 (Georeferencing)</strong>
        <button class="georef-close" type="button" title="닫기">×</button>
      </div>
      <div class="georef-body">
        <p class="georef-hint">① 이미지를 불러온 뒤 ② 이미지의 한 점을 클릭하고 ③ 지도에서 같은 위치를 클릭하세요. 기준점 3쌍 이상이면 지도에 자동으로 맞춰 표시됩니다. <b>원하는 만큼 계속 추가</b>할 수 있고, 점이 많을수록 정확합니다.</p>
        <input type="file" id="georef-file" accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg" />
        <div id="georef-canvas-wrap" class="georef-canvas-wrap" hidden><canvas id="georef-canvas"></canvas></div>
        <div id="georef-zoom" class="georef-zoom" hidden>
          <button id="georef-zoom-out" type="button" title="축소">−</button>
          <span id="georef-zoom-label" class="georef-zoom-label">100%</span>
          <button id="georef-zoom-in" type="button" title="확대">+</button>
          <button id="georef-zoom-fit" type="button" title="패널 폭에 맞춤">맞춤</button>
          <span class="georef-zoom-hint">휠=확대 · 스크롤=이동</span>
        </div>
        <label class="georef-mode-row">변환 방식
          <select id="georef-mode">
            <option value="affine">아핀 (3점+ · 회전·크기·기울임)</option>
            <option value="projective">원근 (4점+ · 기울어진 사진)</option>
          </select>
        </label>
        <div id="georef-status" class="georef-status"></div>
        <ol id="georef-list" class="georef-list"></ol>
        <label class="georef-opacity" id="georef-opacity-row" hidden>투명도 <input type="range" id="georef-opacity" min="0" max="100" value="70"></label>
        <div class="georef-actions">
          <button id="georef-apply" class="georef-btn primary" type="button" disabled>레이어로 추가</button>
          <button id="georef-cancel" class="georef-btn" type="button">취소</button>
        </div>
      </div>`;
  }

  _bind() {
    this.el.querySelector('.georef-close').addEventListener('click', () => this._cancel());
    this.el.querySelector('#georef-cancel').addEventListener('click', () => this._cancel());
    this.el.querySelector('#georef-file').addEventListener('change', (e) => this._loadImage(e));
    this.el.querySelector('#georef-canvas').addEventListener('click', (e) => this._onImageClick(e));
    this.el.querySelector('#georef-apply').addEventListener('click', () => this._apply());
    this.el.querySelector('#georef-mode').addEventListener('change', (e) => { this.mode = e.target.value; this._refresh(); });
    this.el.querySelector('#georef-zoom-in').addEventListener('click', () => this._setZoom(this.viewScale * 1.25));
    this.el.querySelector('#georef-zoom-out').addEventListener('click', () => this._setZoom(this.viewScale / 1.25));
    this.el.querySelector('#georef-zoom-fit').addEventListener('click', () => this._setZoom(this.fitScale));
    this.el.querySelector('#georef-canvas').addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.el.querySelector('#georef-opacity').addEventListener('input', (e) => {
      georeferenceTool.setOpacity(Number(e.target.value) / 100);
    });
  }

  _loadImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        georeferenceTool.image = img;
        this.fitScale = Math.min(1, 300 / img.naturalWidth);
        this.viewScale = this.fitScale;
        this._drawCanvas();
        this._updateZoomLabel();
        this.el.querySelector('#georef-canvas-wrap').hidden = false;
        this.el.querySelector('#georef-zoom').hidden = false;
        this._setStatus('이미지의 한 점을 클릭하세요. (휠로 확대하면 더 정밀합니다)');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  _drawCanvas() {
    const canvas = this.el.querySelector('#georef-canvas');
    const scale = this.viewScale;
    canvas.width = Math.max(1, Math.round(this.image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(this.image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    for (const g of this.gcps) this._drawImgMarker(ctx, g.imgX * scale, g.imgY * scale, g.label, false);
    if (this.pendingImg) this._drawImgMarker(ctx, this.pendingImg.imgX * scale, this.pendingImg.imgY * scale, this.pendingImg.label, true);
  }

  _drawImgMarker(ctx, x, y, label, pending) {
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = pending ? '#f59e0b' : '#e11d48'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(label), x, y);
  }

  _setZoom(scale) {
    if (!this.image) return;
    const max = Math.max(this.fitScale, 6000 / this.image.naturalWidth); // 캔버스 폭 ~6000px 상한
    this.viewScale = Math.max(this.fitScale, Math.min(max, scale));
    this._drawCanvas();
    this._updateZoomLabel();
  }

  _updateZoomLabel() {
    const l = this.el && this.el.querySelector('#georef-zoom-label');
    if (l) l.textContent = `${Math.round(this.viewScale * 100)}%`;
  }

  /** 휠로 커서 지점 기준 확대/축소(스크롤 위치 보정해 커서 아래 지점 유지). */
  _onWheel(e) {
    if (!this.image) return;
    e.preventDefault();
    const wrap = this.el.querySelector('#georef-canvas-wrap');
    const canvas = this.el.querySelector('#georef-canvas');
    const rect = canvas.getBoundingClientRect();
    const imgX = (e.clientX - rect.left) / this.viewScale;
    const imgY = (e.clientY - rect.top) / this.viewScale;
    this._setZoom(this.viewScale * (e.deltaY < 0 ? 1.25 : 1 / 1.25));
    const wrapRect = wrap.getBoundingClientRect();
    wrap.scrollLeft = imgX * this.viewScale - (e.clientX - wrapRect.left);
    wrap.scrollTop = imgY * this.viewScale - (e.clientY - wrapRect.top);
  }

  _onImageClick(e) {
    if (!this.image || this.pendingImg) return; // 지도 점 대기 중이면 무시
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    this.seq += 1;
    this.pendingImg = { imgX: cx / this.viewScale, imgY: cy / this.viewScale, label: this.seq };
    this._drawCanvas();
    this._setStatus(`지도에서 ${this.seq}번 지점을 클릭하세요.`);
    georeferenceTool.pickMapPoint((coordinate) => this._onMapPoint(coordinate));
  }

  _onMapPoint(coordinate) {
    if (!this.pendingImg) return;
    const g = { imgX: this.pendingImg.imgX, imgY: this.pendingImg.imgY, mapX: coordinate[0], mapY: coordinate[1], label: this.pendingImg.label };
    this.gcps.push(g);
    georeferenceTool.addMapMarker(coordinate, g.label);
    this.pendingImg = null;
    this._drawCanvas();
    this._renderList();
    this._refresh();
  }

  _renderList() {
    const list = this.el.querySelector('#georef-list');
    list.innerHTML = this.gcps.map((g) => {
      const [lon, lat] = toLonLat([g.mapX, g.mapY]);
      return `<li><span class="georef-num">${g.label}</span> 이미지(${Math.round(g.imgX)}, ${Math.round(g.imgY)}) → ${lat.toFixed(4)}, ${lon.toFixed(4)} <button class="georef-del" type="button" data-label="${g.label}" title="삭제">×</button></li>`;
    }).join('');
    list.querySelectorAll('.georef-del').forEach((b) => b.addEventListener('click', () => this._deleteGcp(Number(b.dataset.label))));
  }

  _deleteGcp(label) {
    this.gcps = this.gcps.filter((g) => g.label !== label);
    georeferenceTool.removeMapMarker(label);
    this._drawCanvas();
    this._renderList();
    this._refresh();
  }

  _refresh() {
    const res = georeferenceTool.updatePreview(this.gcps, this.mode);
    this.el.querySelector('#georef-apply').disabled = !res.ok;
    this.el.querySelector('#georef-opacity-row').hidden = !res.ok;
    if (res.ok) {
      let msg = `기준점 ${this.gcps.length}개 — 미리보기 표시됨 (더 찍을수록 정확)`;
      if (this.mode === 'projective' && res.type === 'affine') msg += ' (원근은 4점 이상 필요 → 지금은 아핀)';
      this._setStatus(msg);
    } else {
      const need = this.mode === 'projective' ? 4 : 3;
      this._setStatus(this.gcps.length ? `기준점 ${this.gcps.length}개 (${need}개 이상 필요)` : '이미지의 한 점을 클릭하세요.');
    }
  }

  _setStatus(t) { const s = this.el && this.el.querySelector('#georef-status'); if (s) s.textContent = t; }

  _apply() {
    georeferenceTool.commit('지리참조 이미지', this.gcps, this.mode);
    georeferenceTool.cleanup();
    this.close();
  }

  _cancel() {
    georeferenceTool.cleanup();
    this.close();
  }

  close() {
    georeferenceTool.cancelPick();
    if (this.el) { this.el.remove(); this.el = null; }
  }
}

export const georeferencePanel = new GeoreferencePanel();
