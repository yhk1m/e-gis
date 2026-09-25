// © 2026 김용현
/**
 * LabPanel - 실험실 창
 *
 * 실험을 켜고 끄는 스위치만 쥔다. 실험 기능 자체는 각자 자기 자리(범례·툴바·메뉴)에
 * 있고 labs.isOn() 으로만 가려진다 — 그래서 승격할 때 이 창에서 지울 것은 목록 한 줄뿐이다.
 * 모달 규약은 GeocodingPanel 과 같다 (.modal-overlay / .modal-content / Esc·바깥 클릭).
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md
 */
import { labs as defaultLabs } from '../../labs/labs.js';
import { EXPERIMENTS, FEEDBACK_URL } from '../../labs/registry.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const EXTERNAL_ICON = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;

export class LabPanel {
  constructor({ labs = defaultLabs, experiments = EXPERIMENTS, feedbackUrl = FEEDBACK_URL } = {}) {
    this.labs = labs;
    this.experiments = experiments;
    this.feedbackUrl = feedbackUrl;
    this.modal = null;
    this._escHandler = null;
    this._offChange = null;
  }

  show() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay labs-modal active';
    this.modal.innerHTML = `
      <div class="modal-content labs-content" role="dialog" aria-labelledby="labs-title">
        <div class="modal-header">
          <h3 id="labs-title">실험실</h3>
          <button class="modal-close" id="labs-close" aria-label="닫기">&times;</button>
        </div>
        <div class="modal-body">
          <p class="labs-intro">검증 중인 기능입니다. 켠 상태는 이 브라우저에 저장됩니다.</p>
          <div class="labs-cards">
            ${this.experiments.map((e) => this.cardHtml(e)).join('')}
          </div>
          <div class="labs-share">
            <label for="labs-share-url">켜진 상태로 여는 링크</label>
            <div class="labs-share-row">
              <input type="text" id="labs-share-url" readonly value="${escapeHtml(this.labs.shareUrl())}">
              <button type="button" class="btn btn-sm btn-outline" id="labs-share-copy">복사</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  cardHtml(exp) {
    const on = this.labs.isOn(exp.id);
    const feedback = this.feedbackUrl
      ? `<a class="labs-feedback" href="${escapeHtml(this.feedbackUrl)}" target="_blank" rel="noopener noreferrer">의견 보내기 ${EXTERNAL_ICON}</a>`
      : '';
    return `
      <div class="labs-card" data-id="${escapeHtml(exp.id)}">
        <div class="labs-card-text">
          <div class="labs-card-name">${escapeHtml(exp.name)}</div>
          <div class="labs-card-summary">${escapeHtml(exp.summary)}</div>
          <div class="labs-card-meta"><span class="labs-since">${escapeHtml(exp.since)} 실험 시작</span>${feedback}</div>
        </div>
        <button type="button" class="labs-switch" role="switch" data-id="${escapeHtml(exp.id)}"
                aria-checked="${on ? 'true' : 'false'}" aria-label="${escapeHtml(exp.name)} 켜기/끄기">
          <span class="labs-switch-knob"></span>
        </button>
      </div>`;
  }

  bindEvents() {
    this.modal.querySelector('#labs-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.modal.querySelectorAll('.labs-switch').forEach((sw) => {
      sw.addEventListener('click', () => this.labs.toggle(sw.dataset.id));
    });

    // 상태가 어디서 바뀌든(스위치·하네스·다른 창) 스위치와 공유 주소를 맞춘다
    this._offChange = this.labs.onChange(() => this.refresh());

    this.modal.querySelector('#labs-share-copy').addEventListener('click', () => this.copyShareUrl());

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  refresh() {
    if (!this.modal) return;
    this.modal.querySelectorAll('.labs-switch').forEach((sw) => {
      sw.setAttribute('aria-checked', this.labs.isOn(sw.dataset.id) ? 'true' : 'false');
    });
    const input = this.modal.querySelector('#labs-share-url');
    if (input) input.value = this.labs.shareUrl();
  }

  async copyShareUrl() {
    const input = this.modal.querySelector('#labs-share-url');
    const button = this.modal.querySelector('#labs-share-copy');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(input.value);
      } else {
        input.select();
        document.execCommand('copy');
      }
      button.textContent = '복사됨';
      setTimeout(() => { if (button.isConnected) button.textContent = '복사'; }, 1500);
    } catch {
      input.select();   // 못 복사하면 선택만 해 준다 — 사용자가 Ctrl+C
    }
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this._offChange) {
      this._offChange();
      this._offChange = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const labPanel = new LabPanel();
