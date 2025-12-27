/**
 * ExportPanel - 지도 내보내기 설정 패널
 */

import { exportTool } from '../../tools/ExportTool.js';

class ExportPanel {
  constructor() {
    this.modal = null;
  }

  /**
   * 내보내기 패널 열기
   */
  show() {
    this.render();
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    const formats = exportTool.getFormats();

    this.modal = document.createElement('div');
    this.modal.className = 'export-modal';
    this.modal.innerHTML = this.getModalHTML(formats);
    document.body.appendChild(this.modal);

    this.bindEvents();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(formats) {
    const formatOptions = formats.map(f =>
      '<option value="' + f.value + '">' + f.label + '</option>'
    ).join('');

    return '<div class="export-content">' +
      '<div class="export-header">' +
        '<h3>지도 내보내기</h3>' +
        '<button class="export-close" id="export-close">&times;</button>' +
      '</div>' +
      '<div class="export-body">' +
        '<div class="export-form-group">' +
          '<label for="export-filename">파일 이름</label>' +
          '<input type="text" id="export-filename" value="eGIS_map" placeholder="파일 이름">' +
        '</div>' +
        '<div class="export-form-group">' +
          '<label for="export-format">파일 형식</label>' +
          '<select id="export-format">' + formatOptions + '</select>' +
        '</div>' +
        '<div class="export-form-group" id="quality-group">' +
          '<label for="export-quality">이미지 품질</label>' +
          '<input type="range" id="export-quality" min="0.5" max="1" step="0.1" value="0.92">' +
          '<span id="export-quality-value">92%</span>' +
        '</div>' +
        '<div class="export-form-group">' +
          '<label for="export-scale">해상도 배율</label>' +
          '<select id="export-scale">' +
            '<option value="1">1x (기본)</option>' +
            '<option value="2" selected>2x (고해상도)</option>' +
            '<option value="3">3x (초고해상도)</option>' +
          '</select>' +
        '</div>' +
        '<div class="export-form-group">' +
          '<label>' +
            '<input type="checkbox" id="export-no-basemap"> 배경 지도 제외 (투명 배경)' +
          '</label>' +
        '</div>' +
        '<div class="export-preview">' +
          '<p>미리보기가 여기에 표시됩니다</p>' +
        '</div>' +
      '</div>' +
      '<div class="export-footer">' +
        '<button class="btn btn-secondary" id="export-cancel">취소</button>' +
        '<button class="btn btn-primary" id="export-apply">내보내기</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('export-close');
    const cancelBtn = document.getElementById('export-cancel');
    const applyBtn = document.getElementById('export-apply');
    const formatSelect = document.getElementById('export-format');
    const qualityInput = document.getElementById('export-quality');
    const qualityValue = document.getElementById('export-quality-value');
    const qualityGroup = document.getElementById('quality-group');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    // 포맷 변경 시 품질 옵션 표시/숨기기
    formatSelect.addEventListener('change', (e) => {
      qualityGroup.style.display = e.target.value === 'jpg' ? 'block' : 'none';
    });

    // 품질 슬라이더
    qualityInput.addEventListener('input', (e) => {
      qualityValue.textContent = Math.round(e.target.value * 100) + '%';
    });

    // 내보내기 버튼
    applyBtn.addEventListener('click', () => this.export());

    // 초기 상태: PNG 선택 시 품질 옵션 숨기기
    qualityGroup.style.display = 'none';
  }

  /**
   * 내보내기 실행
   */
  async export() {
    const filename = document.getElementById('export-filename').value.trim() || 'eGIS_map';
    const format = document.getElementById('export-format').value;
    const quality = parseFloat(document.getElementById('export-quality').value);
    const scale = parseInt(document.getElementById('export-scale').value);
    const noBasemap = document.getElementById('export-no-basemap').checked;

    const applyBtn = document.getElementById('export-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '내보내는 중...';

    try {
      await exportTool.exportMap({
        filename,
        format,
        quality,
        scale,
        noBasemap
      });

      this.close();
    } catch (error) {
      alert('내보내기 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '내보내기';
    }
  }

  /**
   * 모달 닫기
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const exportPanel = new ExportPanel();
