// © 2026 김용현
/**
 * LabFeedbackPanel - 실험실 의견 보내기 창
 *
 * 실험실 창의 「의견 보내기」로 연다(FEEDBACK_ENDPOINT 가 있을 때 — 없으면 LabPanel 이 구글 폼 링크를 쓴다).
 * 위에서 기능을 고르면 고른 기능마다 의견 카드(글 + 이미지)가 따로 생긴다(사용자 요청 2026-09-28).
 * 답은 Apps Script 웹앱(scripts/labs-feedback.gs)이 스프레드시트에 항목마다 한 줄씩 쌓고,
 * 이미지는 구글 드라이브 폴더에 저장한 뒤 그 줄에 링크를 남긴다.
 *
 * 보내기: POST, Content-Type text/plain(JSON 문자열) — application/json 이면 브라우저가 사전 요청(OPTIONS)을
 * 보내는데 Apps Script 는 그걸 받지 못한다.
 */
import { EXPERIMENTS, FEEDBACK_ENDPOINT } from '../../labs/registry.js';
import { labs as defaultLabs } from '../../labs/labs.js';
import { buildFeedbackPayload } from '../../labs/feedbackPayload.js';
import { encodeImage, encodeImageFile } from '../../labs/feedbackImage.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const OTHER = '실험실 전체·기타';

/** 지금 지도 화면(OL 레이어 캔버스 합성) — 3D·애니메이션 저장과 같은 방식 */
async function defaultCaptureMap() {
  const { composeMapCanvas } = await import('../../view3d/mapTexture.js');
  const el = document.getElementById('map');
  return el ? composeMapCanvas(el) : null;
}

export class LabFeedbackPanel {
  constructor({
    endpoint = FEEDBACK_ENDPOINT,
    experiments = EXPERIMENTS,
    labsOn = () => defaultLabs.enabledIds(),
    fetchFn = (...a) => fetch(...a),
    captureMap = defaultCaptureMap,
  } = {}) {
    this.endpoint = endpoint;
    this.experiments = experiments;
    this.labsOn = labsOn;
    this.fetchFn = fetchFn;
    this.captureMap = captureMap;
    this.modal = null;
    this.names = [];
    this.drafts = new Map(); // 기능 이름 → { text, image } — 카드를 껐다 켜도 남는다
    this.activeName = null;  // 붙여넣기(Ctrl+V)가 들어갈 카드
    this._escHandler = null;
    this._pasteHandler = null;
  }

  isOpen() {
    return !!this.modal;
  }

  show() {
    this.close();
    const on = new Set(this.labsOn());
    this.names = [...this.experiments.map((e) => e.name), OTHER];
    const onNames = new Set(this.experiments.filter((e) => on.has(e.id)).map((e) => e.name));

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay labs-feedback-modal active';
    this.modal.innerHTML = `
      <div class="modal-content labs-feedback-content" role="dialog" aria-labelledby="lab-fb-heading">
        <div class="modal-header">
          <h3 id="lab-fb-heading">실험실 의견 보내기</h3>
          <button class="modal-close" id="lab-fb-close" aria-label="닫기">&times;</button>
        </div>
        <form class="modal-body lab-fb-form" id="lab-fb-form" novalidate>
          <fieldset class="lab-fb-field">
            <legend>어떤 기능에 대한 의견인가요? <span class="lab-fb-hint">고른 기능마다 의견 칸이 생깁니다</span></legend>
            <div class="lab-fb-exp">
              ${this.names.map((n) => `
                <label class="lab-fb-chip"><input type="checkbox" value="${escapeHtml(n)}"><span>${escapeHtml(n)}${onNames.has(n) ? '<i class="lab-fb-on" title="지금 켜 둔 기능">켜 둠</i>' : ''}</span></label>`).join('')}
            </div>
            <div class="lab-fb-error" id="lab-fb-items-error" role="alert"></div>
          </fieldset>

          <div class="lab-fb-items" id="lab-fb-items"></div>

          <div class="lab-fb-field lab-fb-two">
            <fieldset>
              <legend>역할 <span class="lab-fb-hint">선택</span></legend>
              <div class="lab-fb-roles">
                <label class="lab-fb-chip"><input type="radio" name="lab-fb-role" value="teacher"><span>교사</span></label>
                <label class="lab-fb-chip"><input type="radio" name="lab-fb-role" value="student"><span>학생</span></label>
                <label class="lab-fb-chip"><input type="radio" name="lab-fb-role" value="other"><span>기타</span></label>
              </div>
            </fieldset>
            <div>
              <label for="lab-fb-email">답장 받을 이메일 <span class="lab-fb-hint">선택</span></label>
              <input type="email" id="lab-fb-email" maxlength="200" placeholder="비워 두어도 됩니다" autocomplete="email">
              <div class="lab-fb-error" id="lab-fb-email-error" role="alert"></div>
            </div>
          </div>

          <!-- 봇 막이: 사람에게는 안 보이는 칸 -->
          <input type="text" id="lab-fb-website" name="website" class="lab-fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">

          <p class="lab-fb-privacy">보낸 내용은 기능 개선에만 쓰고 1년간 보관합니다. 이메일은 답장할 때만 씁니다.
            <a href="/privacy" target="_blank" rel="noopener">개인정보 처리방침</a></p>

          <div class="lab-fb-actions">
            <span class="lab-fb-status" id="lab-fb-status" role="status"></span>
            <button type="submit" class="btn btn-primary" id="lab-fb-submit">보내기</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  bindEvents() {
    const q = (s) => this.modal.querySelector(s);
    q('#lab-fb-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
    q('#lab-fb-form').addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
    q('.lab-fb-exp').addEventListener('change', () => this.renderItems());

    // 카드 안의 버튼·파일·입력 — 한 곳에서 받는다
    const items = q('#lab-fb-items');
    items.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.lab-fb-item');
      if (!cardEl) return;
      const name = cardEl.dataset.name;
      if (e.target.closest('.lab-fb-capture')) this.attachMap(name);
      else if (e.target.closest('.lab-fb-remove')) this.setImage(name, null);
    });
    items.addEventListener('change', (e) => {
      if (!e.target.matches('.lab-fb-file-input')) return;
      const file = e.target.files?.[0];
      if (file) this.attachFile(e.target.closest('.lab-fb-item').dataset.name, file);
      e.target.value = '';
    });
    items.addEventListener('input', (e) => {
      if (!e.target.matches('textarea')) return;
      this.draft(e.target.closest('.lab-fb-item').dataset.name).text = e.target.value;
    });
    items.addEventListener('focusin', (e) => {
      const cardEl = e.target.closest('.lab-fb-item');
      if (cardEl) this.activeName = cardEl.dataset.name;
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
    // 붙여넣은 이미지는 마지막으로 만진 카드(없으면 맨 아래 카드)에 붙인다
    this._pasteHandler = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (!item) return;
      const names = this.selectedNames();
      const target = names.includes(this.activeName) ? this.activeName : names[names.length - 1];
      if (!target) return;
      e.preventDefault();
      this.attachFile(target, item.getAsFile());
    };
    document.addEventListener('paste', this._pasteHandler);
  }

  draft(name) {
    if (!this.drafts.has(name)) this.drafts.set(name, { text: '', image: null });
    return this.drafts.get(name);
  }

  selectedNames() {
    if (!this.modal) return [];
    return [...this.modal.querySelectorAll('.lab-fb-exp input:checked')].map((i) => i.value);
  }

  cardEl(name) {
    return [...(this.modal?.querySelectorAll('.lab-fb-item') || [])].find((c) => c.dataset.name === name) || null;
  }

  /** 고른 기능 순서대로 카드를 맞춘다 — 이미 있는 카드는 그대로 두어 입력·포커스를 잃지 않게 */
  renderItems() {
    const box = this.modal.querySelector('#lab-fb-items');
    const selected = this.selectedNames();
    box.querySelectorAll('.lab-fb-item').forEach((c) => {
      if (selected.includes(c.dataset.name)) return;
      this.draft(c.dataset.name).text = c.querySelector('textarea').value; // 다시 켜면 되살린다
      c.remove();
    });
    selected.forEach((name, i) => {
      let el = this.cardEl(name);
      if (!el) el = this.createCard(name);
      if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null);
    });
    if (selected.length) this.modal.querySelector('#lab-fb-items-error').textContent = '';
  }

  createCard(name) {
    const d = this.draft(name);
    const el = document.createElement('section');
    el.className = 'lab-fb-item';
    el.dataset.name = name;
    el.innerHTML = `
      <h4 class="lab-fb-item-title">${escapeHtml(name)}</h4>
      <textarea rows="4" maxlength="3000" aria-label="${escapeHtml(name)} 의견"
        placeholder="좋았던 점, 불편한 점, 이렇게 바뀌면 좋겠다는 점을 적어 주세요."></textarea>
      <div class="lab-fb-error lab-fb-text-error" role="alert"></div>
      <div class="lab-fb-image-row">
        <label class="btn btn-sm btn-outline lab-fb-file">이미지 고르기<input type="file" class="lab-fb-file-input" accept="image/*" hidden></label>
        <button type="button" class="btn btn-sm btn-outline lab-fb-capture">지금 지도 담기</button>
        <span class="lab-fb-hint lab-fb-paste-hint">붙여넣기(Ctrl+V)도 됩니다</span>
      </div>
      <div class="lab-fb-preview" hidden>
        <img alt="${escapeHtml(name)} 첨부 이미지 미리보기">
        <button type="button" class="lab-fb-remove" aria-label="이미지 빼기">&times;</button>
      </div>
      <div class="lab-fb-error lab-fb-image-error" role="alert"></div>`;
    el.querySelector('textarea').value = d.text;
    this.showPreview(el, d.image);
    return el;
  }

  showPreview(el, image) {
    const box = el.querySelector('.lab-fb-preview');
    box.hidden = !image;
    box.querySelector('img').src = image ? image.dataUrl : '';
    el.querySelector('.lab-fb-image-error').textContent = '';
  }

  setImage(name, image) {
    this.draft(name).image = image;
    const el = this.cardEl(name);
    if (el) this.showPreview(el, image);
  }

  imageError(name, text) {
    const el = this.cardEl(name);
    if (el) el.querySelector('.lab-fb-image-error').textContent = text;
  }

  async attachFile(name, file) {
    try {
      this.setImage(name, await encodeImageFile(file));
    } catch (e) {
      this.imageError(name, e.message || '이미지를 붙이지 못했습니다.');
    }
  }

  async attachMap(name) {
    try {
      const canvas = await this.captureMap();
      if (!canvas) throw new Error('담을 지도 화면이 없습니다.');
      this.setImage(name, encodeImage(canvas, 'map.jpg'));
    } catch (e) {
      // 교차 출처 배경지도는 캔버스를 읽을 수 없게 만든다(SecurityError)
      this.imageError(name, e?.name === 'SecurityError'
        ? '지금 배경지도는 캡처할 수 없습니다. 화면을 캡처해 파일로 붙여 주세요.'
        : (e.message || '지도를 담지 못했습니다.'));
    }
  }

  readForm() {
    const q = (s) => this.modal.querySelector(s);
    return {
      items: this.selectedNames().map((name) => ({
        experiment: name,
        message: this.cardEl(name)?.querySelector('textarea').value ?? this.draft(name).text,
        image: this.draft(name).image,
      })),
      role: this.modal.querySelector('input[name="lab-fb-role"]:checked')?.value || '',
      email: q('#lab-fb-email').value,
      website: q('#lab-fb-website').value,
    };
  }

  async submit() {
    const q = (s) => this.modal.querySelector(s);
    const status = q('#lab-fb-status');
    const names = this.selectedNames();
    const r = buildFeedbackPayload(this.readForm(), {
      page: location.href, ua: navigator.userAgent, labsOn: this.labsOn(),
    });
    if (r.spam) return;

    q('#lab-fb-items-error').textContent = r.errors.items || '';
    q('#lab-fb-email-error').textContent = r.errors.email || '';
    names.forEach((name, i) => {
      const el = this.cardEl(name);
      el.querySelector('.lab-fb-text-error').textContent = r.errors.item?.[i] || '';
      if (r.errors.image?.[i]) el.querySelector('.lab-fb-image-error').textContent = r.errors.image[i];
    });
    if (!r.ok) {
      status.textContent = '';
      const first = Object.keys(r.errors.item || {})[0];
      if (first !== undefined) this.cardEl(names[first])?.querySelector('textarea').focus?.();
      return;
    }

    const btn = q('#lab-fb-submit');
    btn.disabled = true;
    status.textContent = '보내는 중…';
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(r.payload),
      });
      const data = res.ok ? await res.json() : null;
      if (!data?.ok) throw new Error(data?.error || '보내지 못했습니다. 잠시 뒤에 다시 해 주세요.');
      this.drafts.clear();
      this.showDone();
    } catch (e) {
      if (!this.modal) return;
      status.textContent = e.message && !/fetch|network/i.test(e.message) ? e.message : '보내지 못했습니다. 인터넷 연결을 확인해 주세요.';
      btn.disabled = false;
    }
  }

  showDone() {
    if (!this.modal) return;
    const form = this.modal.querySelector('#lab-fb-form');
    form.outerHTML = `
      <div class="modal-body lab-fb-done">
        <strong>고맙습니다!</strong>
        <p>보내 주신 의견은 실험 기능을 다듬는 데 씁니다.</p>
        <button type="button" class="btn btn-primary" id="lab-fb-done-close">닫기</button>
      </div>`;
    this.modal.querySelector('#lab-fb-done-close').addEventListener('click', () => this.close());
  }

  close() {
    if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
    if (this._pasteHandler) { document.removeEventListener('paste', this._pasteHandler); this._pasteHandler = null; }
    if (this.modal) { this.modal.remove(); this.modal = null; }
  }
}

export const labFeedbackPanel = new LabFeedbackPanel();
