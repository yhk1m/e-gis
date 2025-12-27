/**
 * CoordinateImportPanel - 좌표 데이터를 포인트 레이어로 변환하는 패널
 */

import { tableLoader } from '../../loaders/TableLoader.js';

class CoordinateImportPanel {
  constructor() {
    this.modal = null;
  }

  /**
   * 패널 열기
   */
  show() {
    this.render();
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay coord-import-modal active';
    this.modal.innerHTML = this.getModalHTML();
    document.body.appendChild(this.modal);

    this.bindEvents();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML() {
    return '<div class="modal-content coord-import-content">' +
      '<div class="modal-header">' +
        '<h3>좌표 데이터 가져오기</h3>' +
        '<button class="modal-close" id="coord-import-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label>파일 선택</label>' +
          '<div class="file-upload-area" id="coord-file-area">' +
            '<input type="file" id="coord-file-input" accept=".csv,.txt,.xlsx,.xls" style="display:none">' +
            '<div class="upload-placeholder" id="coord-upload-placeholder">' +
              '<span class="upload-icon">📄</span>' +
              '<span>CSV 또는 Excel 파일을 선택하세요</span>' +
            '</div>' +
            '<div class="upload-success" id="coord-upload-success" style="display:none">' +
              '<span class="success-icon">✓</span>' +
              '<span id="coord-filename"></span>' +
              '<span id="coord-row-count"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="coord-settings" style="display:none">' +
          '<div class="form-group">' +
            '<label for="coord-lat-column">위도(Y) 컬럼</label>' +
            '<select id="coord-lat-column"><option value="">컬럼 선택</option></select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="coord-lon-column">경도(X) 컬럼</label>' +
            '<select id="coord-lon-column"><option value="">컬럼 선택</option></select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="coord-layer-name">레이어 이름</label>' +
            '<input type="text" id="coord-layer-name" placeholder="레이어 이름">' +
          '</div>' +
          '<div class="coord-preview" id="coord-preview">' +
            '<div class="preview-title">미리보기</div>' +
            '<div class="preview-info">' +
              '<span>유효 좌표: <strong id="valid-count">0</strong>개</span>' +
              '<span>잘못된 좌표: <strong id="invalid-count">0</strong>개</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" id="coord-import-cancel">취소</button>' +
        '<button class="btn btn-primary" id="coord-import-apply" disabled>레이어 생성</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('coord-import-close');
    const cancelBtn = document.getElementById('coord-import-cancel');
    const applyBtn = document.getElementById('coord-import-apply');
    const fileInput = document.getElementById('coord-file-input');
    const fileArea = document.getElementById('coord-file-area');
    const latSelect = document.getElementById('coord-lat-column');
    const lonSelect = document.getElementById('coord-lon-column');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    });

    // 파일 선택
    fileArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
    });

    // 드래그 앤 드롭
    fileArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileArea.classList.add('dragover');
    });

    fileArea.addEventListener('dragleave', () => {
      fileArea.classList.remove('dragover');
    });

    fileArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    // 컬럼 선택 변경 시 미리보기 업데이트
    latSelect.addEventListener('change', () => this.updatePreview());
    lonSelect.addEventListener('change', () => this.updatePreview());

    // 레이어 생성
    applyBtn.addEventListener('click', () => this.createLayer());
  }

  /**
   * 파일 처리
   */
  async handleFile(file) {
    try {
      await tableLoader.loadFile(file);

      // UI 업데이트
      document.getElementById('coord-upload-placeholder').style.display = 'none';
      document.getElementById('coord-upload-success').style.display = 'flex';
      document.getElementById('coord-filename').textContent = file.name;
      document.getElementById('coord-row-count').textContent = `(${tableLoader.data.length}행)`;

      // 설정 영역 표시
      document.getElementById('coord-settings').style.display = 'block';

      // 컬럼 옵션 업데이트
      this.updateColumnOptions();

      // 좌표 컬럼 자동 감지
      const detected = tableLoader.detectCoordinateColumns();
      if (detected.latColumn) {
        document.getElementById('coord-lat-column').value = detected.latColumn;
      }
      if (detected.lonColumn) {
        document.getElementById('coord-lon-column').value = detected.lonColumn;
      }

      // 레이어 이름 기본값
      document.getElementById('coord-layer-name').value = tableLoader.fileName;

      // 미리보기 업데이트
      this.updatePreview();

    } catch (error) {
      alert('파일 로드 실패: ' + error.message);
    }
  }

  /**
   * 컬럼 옵션 업데이트
   */
  updateColumnOptions() {
    const numericCols = tableLoader.getNumericColumns();
    const allCols = tableLoader.headers;

    const latSelect = document.getElementById('coord-lat-column');
    const lonSelect = document.getElementById('coord-lon-column');

    // 숫자형 컬럼 우선 표시
    let options = '<option value="">컬럼 선택</option>';

    if (numericCols.length > 0) {
      options += '<optgroup label="숫자형 컬럼">';
      numericCols.forEach(col => {
        options += `<option value="${col}">${col}</option>`;
      });
      options += '</optgroup>';
    }

    // 모든 컬럼도 표시
    options += '<optgroup label="모든 컬럼">';
    allCols.forEach(col => {
      if (!numericCols.includes(col)) {
        options += `<option value="${col}">${col}</option>`;
      }
    });
    options += '</optgroup>';

    latSelect.innerHTML = options;
    lonSelect.innerHTML = options;
  }

  /**
   * 미리보기 업데이트
   */
  updatePreview() {
    const latCol = document.getElementById('coord-lat-column').value;
    const lonCol = document.getElementById('coord-lon-column').value;
    const applyBtn = document.getElementById('coord-import-apply');

    if (!latCol || !lonCol || !tableLoader.data) {
      document.getElementById('valid-count').textContent = '0';
      document.getElementById('invalid-count').textContent = '0';
      applyBtn.disabled = true;
      return;
    }

    let validCount = 0;
    let invalidCount = 0;

    for (const row of tableLoader.data) {
      const lat = parseFloat(row[latCol]);
      const lon = parseFloat(row[lonCol]);

      if (!isNaN(lat) && !isNaN(lon) &&
          lat >= -90 && lat <= 90 &&
          lon >= -180 && lon <= 180) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    document.getElementById('valid-count').textContent = validCount;
    document.getElementById('invalid-count').textContent = invalidCount;
    applyBtn.disabled = validCount === 0;
  }

  /**
   * 레이어 생성
   */
  createLayer() {
    const latCol = document.getElementById('coord-lat-column').value;
    const lonCol = document.getElementById('coord-lon-column').value;
    const layerName = document.getElementById('coord-layer-name').value.trim();

    if (!latCol || !lonCol) {
      alert('위도와 경도 컬럼을 선택해주세요.');
      return;
    }

    const applyBtn = document.getElementById('coord-import-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '생성 중...';

    try {
      const result = tableLoader.createPointLayer(latCol, lonCol, layerName);

      alert(`레이어 생성 완료!\n- 레이어: ${result.layerName}\n- 포인트 수: ${result.featureCount}\n- 제외된 행: ${result.skippedCount}`);

      tableLoader.clear();
      this.close();
    } catch (error) {
      alert('레이어 생성 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '레이어 생성';
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
    tableLoader.clear();
  }
}

export const coordinateImportPanel = new CoordinateImportPanel();
