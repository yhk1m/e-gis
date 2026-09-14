// © 2026 김용현
/**
 * GeocodingPanel - 주소 → 좌표 안내창
 *
 * 지오코딩은 e-GIS 안에서 하지 않는다. 선생님이 배포한 구글 시트 도구
 * (Apps Script GEOCODE 함수)를 학생이 각자 사본으로 쓰도록 안내만 한다.
 * Apps Script 지오코딩 한도는 스크립트 소유 계정마다 하루 1,000건이라, e-GIS가
 * 한 곳에서 대신 호출하면 반 하나로 바닥나지만 사본이면 학생 계정마다 따로 잡힌다.
 * 설계: docs/superpowers/specs/2026-09-14-geocoding-button-design.md
 */
import { builtinDataDialog } from '../dialogs/BuiltinDataDialog.js';

/** 선생님이 배포한 지오코딩 시트 (링크가 있는 모든 사용자: 뷰어) */
export const GEOCODING_SHEET_ID = '1nW24wsVc_6RKL-rBxlUb5iS24MebZaQtAj4qYdlPmgw';

/** 구글 시트의 "사본 만들기" 화면을 바로 여는 주소 */
export function geocodingCopyUrl(sheetId = GEOCODING_SHEET_ID) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/copy`;
}

const EXTERNAL_ICON = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;

class GeocodingPanel {
  constructor() {
    this.modal = null;
    this._escHandler = null;
  }

  show() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay geocoding-modal active';
    this.modal.innerHTML = `
      <div class="modal-content geocoding-content">
        <div class="modal-header">
          <h3>Geocoding</h3>
          <button class="modal-close" id="geocoding-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="geocoding-intro">주소나 장소명 목록을 위도·경도로 바꿔 지도에 올리는 순서입니다.</p>
          <ol class="geocoding-steps">
            <li>
              <div class="geocoding-step-title">지오코딩 시트 사본 만들기</div>
              <p>구글 계정으로 로그인한 뒤 "사본 만들기"를 누르면 내 드라이브에 복사됩니다.</p>
              <button type="button" class="btn btn-primary btn-sm" id="geocoding-copy">사본 만들기 ${EXTERNAL_ICON}</button>
            </li>
            <li>
              <div class="geocoding-step-title">주소 넣고 좌표 채우기</div>
              <p><code>template</code> 시트 B열에 주소나 장소명을 넣고, C열에 <code>=GEOCODE(B2)</code>를 입력하면 위도·경도가 자동으로 채워집니다. 자세한 사용법은 시트 첫 장의 설명서를 보세요.</p>
            </li>
            <li>
              <div class="geocoding-step-title">e-GIS로 가져오기</div>
              <p>완성된 시트를 "링크가 있는 모든 사용자"로 공유한 뒤 시트 주소를 붙여 넣으면 포인트 레이어가 됩니다.</p>
              <button type="button" class="btn btn-secondary btn-sm" id="geocoding-import">구글 시트 불러오기</button>
            </li>
          </ol>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  bindEvents() {
    this.modal.querySelector('#geocoding-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.modal.querySelector('#geocoding-copy').addEventListener('click', () => {
      window.open(geocodingCopyUrl(), '_blank', 'noopener');
    });

    // 불러오기 창이 이 창 위에 겹치지 않도록 먼저 닫는다
    this.modal.querySelector('#geocoding-import').addEventListener('click', () => {
      this.close();
      builtinDataDialog.show('sheets');
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
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

export const geocodingPanel = new GeocodingPanel();
