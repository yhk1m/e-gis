// © 2026 김용현
/**
 * LabGuidePanel - 실험실 사용 안내 창
 *
 * 실험실 창 제목 옆 i 버튼으로 연다. 실험실 창 위에 따로 뜨는 넓은 창으로,
 * 왼쪽 목록에서 「실험실이란?」 또는 기능 하나를 고르면 오른쪽에 그 안내만 보인다
 * (한 화면에 다 늘어놓으면 위아래로 너무 길어진다 — 사용자 요청 2026-09-27).
 * 안내 글은 registry.js 의 details(글자 그대로)에서 온다.
 */
import { EXPERIMENTS } from '../../labs/registry.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const OVERVIEW_ID = '_overview';

/** 「실험실이란?」 — 실험실 창 자체를 쓰는 법 */
const OVERVIEW = {
  name: '실험실이란?',
  summary: '아직 검증 중인 기능을 먼저 써 보는 곳입니다.',
  details: {
    intro: [
      '실험실에는 정식 기능이 되기 전에 수업에서 먼저 써 보고 의견을 모으는 기능이 모여 있습니다. 스위치를 켜면 그 기능이 원래 있어야 할 자리(범례·툴바·메뉴)에 나타나고, 끄면 사라집니다.',
      '왼쪽 목록에서 기능을 고르면 소개와 사용 방법을 볼 수 있습니다.'
    ],
    steps: [
      '툴바 오른쪽의 플라스크 버튼을 눌러 실험실 창을 엽니다.',
      '써 보고 싶은 기능의 스위치를 켭니다. 켜진 실험 수가 플라스크 버튼에 숫자로 표시됩니다.',
      '켠 상태는 이 브라우저에 저장되어, 다음에 접속해도 그대로입니다.',
      '학생들에게도 같은 기능을 켜 주고 싶다면 창 아래 「켜진 상태로 여는 링크」를 복사해 나눠 줍니다.'
    ],
    notes: [
      '주소 뒤에 ?lab=glass 처럼 붙여 열면 그 실험이 켜진 채로 열립니다. ?lab=all 은 전부 켜기, ?lab=none 은 전부 끄기입니다.',
      '실험 기능은 예고 없이 바뀌거나 사라질 수 있습니다. 써 본 소감은 About e-GIS 의 커뮤니티로 알려 주세요.'
    ]
  }
};

const list = (items, tag) => `<${tag}>${items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</${tag}>`;

/** 오른쪽 칸 — 이름·요약·소개·사용 방법·알아 두기 */
export function guideBodyHtml(item) {
  const d = item.details || {};
  const intro = (d.intro || []).map((t) => `<p>${escapeHtml(t)}</p>`).join('');
  return `
    <h3 class="labs-guide-title">${escapeHtml(item.name)}</h3>
    <p class="labs-guide-summary">${escapeHtml(item.summary || '')}</p>
    ${intro ? `<h4>소개</h4>${intro}` : ''}
    ${d.steps?.length ? `<h4>사용 방법</h4>${list(d.steps, 'ol')}` : ''}
    ${d.notes?.length ? `<h4>알아 두기</h4>${list(d.notes, 'ul')}` : ''}`;
}

export class LabGuidePanel {
  constructor({ experiments = EXPERIMENTS } = {}) {
    this.experiments = experiments.filter((e) => e.details);
    this.modal = null;
    this.current = OVERVIEW_ID;
    this._escHandler = null;
  }

  isOpen() {
    return !!this.modal;
  }

  items() {
    return [{ id: OVERVIEW_ID, ...OVERVIEW }, ...this.experiments];
  }

  show(id = OVERVIEW_ID) {
    this.close();
    this.current = this.items().some((i) => i.id === id) ? id : OVERVIEW_ID;

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay labs-guide-modal active';
    this.modal.innerHTML = `
      <div class="modal-content labs-guide-content" role="dialog" aria-labelledby="labs-guide-heading">
        <div class="modal-header">
          <h3 id="labs-guide-heading">실험실 사용 안내</h3>
          <button class="modal-close" id="labs-guide-close" aria-label="닫기">&times;</button>
        </div>
        <div class="labs-guide-layout">
          <nav class="labs-guide-nav" aria-label="안내 목록">
            ${this.items().map((i) => `
              <button type="button" class="labs-guide-tab" data-id="${escapeHtml(i.id)}">${escapeHtml(i.name)}</button>`).join('')}
          </nav>
          <article class="labs-guide-body" tabindex="-1"></article>
        </div>
      </div>`;
    document.body.appendChild(this.modal);

    this.modal.querySelector('#labs-guide-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
    this.modal.querySelectorAll('.labs-guide-tab').forEach((tab) => {
      tab.addEventListener('click', () => this.select(tab.dataset.id));
    });
    // 실험실 창도 Esc 를 듣는다 — 안내 창이 열려 있으면 안내 창만 닫는다(LabPanel 이 isOpen 을 본다)
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    this.select(this.current);
  }

  select(id) {
    if (!this.modal) return;
    const item = this.items().find((i) => i.id === id);
    if (!item) return;
    this.current = id;
    this.modal.querySelectorAll('.labs-guide-tab').forEach((tab) => {
      const on = tab.dataset.id === id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    const body = this.modal.querySelector('.labs-guide-body');
    body.innerHTML = guideBodyHtml(item);
    body.scrollTop = 0;
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const labGuidePanel = new LabGuidePanel();
