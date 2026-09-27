// © 2026 김용현
/**
 * LabFeedbackPanel - 실험실 의견 보내기 창
 *
 * 실험실 창의 「의견 보내기」로 연다(FEEDBACK_ENDPOINT 가 있을 때 — 없으면 LabPanel 이 구글 폼 링크를 쓴다).
 * 답은 Apps Script 웹앱(scripts/labs-feedback.gs)이 사용자의 스프레드시트에 한 줄씩 쌓고,
 * 첨부 이미지는 드라이브 폴더에 저장한 뒤 시트에 링크를 남긴다.
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
    this.image = null;
    this._escHandler = null;
    this._pasteHandler = null;
  }

  isOpen() {
    return !!this.modal;
  }

  show() {
    this.close();
    const on = new Set(this.labsOn());
    const names = this.experiments.map((e) => ({ name: e.name, checked: on.has(e.id) }));
    names.push({ name: OTHER, checked: false });

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
            <legend>어떤 기능에 대한 의견인가요? <span class="lab-fb-hint">여러 개 골라도 됩니다</span></legend>
            <div class="lab-fb-exp">
              ${names.map((n) => `
                <label class="lab-fb-chip"><input type="checkbox" value="${escapeHtml(n.name)}"${n.checked ? ' checked' : ''}><span>${escapeHtml(n.name)}</span></label>`).join('')}
            </div>
          </fieldset>

          <div class="lab-fb-field">
            <label for="lab-fb-message">의견 <span class="lab-fb-req">필수</span></label>
            <textarea id="lab-fb-message" rows="6" maxlength="3000" placeholder="좋았던 점, 불편한 점, 이렇게 바뀌면 좋겠다는 점을 자유롭게 적어 주세요."></textarea>
            <div class="lab-fb-error" id="lab-fb-message-error" role="alert"></div>
          </div>

          <div class="lab-fb-field">
            <span class="lab-fb-label">화면 캡처 <span class="lab-fb-hint">선택 · 붙여넣기(Ctrl+V)도 됩니다</span></span>
            <div class="lab-fb-image-row">
              <label class="btn btn-sm btn-outline lab-fb-file">이미지 고르기<input type="file" id="lab-fb-file" accept="image/*" hidden></label>
              <button type="button" class="btn btn-sm btn-outline" id="lab-fb-capture">지금 지도 담기</button>
            </div>
            <div class="lab-fb-preview" id="lab-fb-preview" hidden>
              <img alt="첨부한 이미지 미리보기">
              <button type="button" class="lab-fb-remove" id="lab-fb-remove" aria-label="이미지 빼기">&times;</button>
            </div>
            <div class="lab-fb-error" id="lab-fb-image-error" role="alert"></div>
          </div>

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

          <div class="lab-fb-actions">
            <span class="lab-fb-status" id="lab-fb-status" role="status"></span>
            <button type="submit" class="btn btn-primary" id="lab-fb-submit">보내기</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(this.modal);
    this.bindEvents();
    this.modal.querySelector('#lab-fb-message').focus?.();
  }

  bindEvents() {
    const q = (s) => this.modal.querySelector(s);
    q('#lab-fb-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
    q('#lab-fb-form').addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
    q('#lab-fb-file').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) this.attachFile(f); e.target.value = ''; });
    q('#lab-fb-capture').addEventListener('click', () => this.attachMap());
    q('#lab-fb-remove').addEventListener('click', () => this.setImage(null));

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
    this._pasteHandler = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) { e.preventDefault(); this.attachFile(item.getAsFile()); }
    };
    document.addEventListener('paste', this._pasteHandler);
  }

  setImage(image) {
    this.image = image;
    const box = this.modal?.querySelector('#lab-fb-preview');
    if (!box) return;
    box.hidden = !image;
    box.querySelector('img').src = image ? image.dataUrl : '';
    this.modal.querySelector('#lab-fb-image-error').textContent = '';
  }

  async attachFile(file) {
    try {
      this.setImage(await encodeImageFile(file));
    } catch (e) {
      this.modal.querySelector('#lab-fb-image-error').textContent = e.message || '이미지를 붙이지 못했습니다.';
    }
  }

  async attachMap() {
    const err = this.modal.querySelector('#lab-fb-image-error');
    try {
      const canvas = await this.captureMap();
      if (!canvas) throw new Error('담을 지도 화면이 없습니다.');
      this.setImage(encodeImage(canvas, 'map.jpg'));
    } catch (e) {
      // 교차 출처 배경지도는 캔버스를 읽을 수 없게 만든다(SecurityError)
      err.textContent = e?.name === 'SecurityError'
        ? '지금 배경지도는 캡처할 수 없습니다. 화면을 캡처해 파일로 붙여 주세요.'
        : (e.message || '지도를 담지 못했습니다.');
    }
  }

  readForm() {
    const q = (s) => this.modal.querySelector(s);
    return {
      experiments: [...this.modal.querySelectorAll('.lab-fb-exp input:checked')].map((i) => i.value),
      message: q('#lab-fb-message').value,
      role: this.modal.querySelector('input[name="lab-fb-role"]:checked')?.value || '',
      email: q('#lab-fb-email').value,
      image: this.image,
      website: q('#lab-fb-website').value,
    };
  }

  async submit() {
    const q = (s) => this.modal.querySelector(s);
    const status = q('#lab-fb-status');
    const r = buildFeedbackPayload(this.readForm(), {
      page: location.href, ua: navigator.userAgent, labsOn: this.labsOn(),
    });
    q('#lab-fb-message-error').textContent = r.errors.message || '';
    q('#lab-fb-email-error').textContent = r.errors.email || '';
    if (r.errors.image) q('#lab-fb-image-error').textContent = r.errors.image;
    if (r.spam) return;
    if (!r.ok) { status.textContent = ''; return; }

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
    this.image = null;
    if (this.modal) { this.modal.remove(); this.modal = null; }
  }
}

export const labFeedbackPanel = new LabFeedbackPanel();
