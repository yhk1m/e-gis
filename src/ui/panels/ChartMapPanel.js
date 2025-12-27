/**
 * ChartMapPanel - 도형표현도 설정 패널
 */

import { chartMapTool } from '../../tools/ChartMapTool.js';

class ChartMapPanel {
  constructor() {
    this.modal = null;
    this.selectedLayerId = null;
    this.selectedFields = [];
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

    const layers = chartMapTool.getCompatibleLayers();

    if (layers.length === 0) {
      alert('도형표현도를 생성하려면 레이어가 필요합니다.');
      return;
    }

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay chart-map-modal active';
    this.modal.innerHTML = this.getModalHTML(layers);
    document.body.appendChild(this.modal);

    this.selectedLayerId = layers[0].id;
    this.selectedFields = [];
    this.bindEvents();
    this.updateFieldList();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layers) {
    const layerOptions = layers.map(l =>
      `<option value="${l.id}">${l.name} (${l.featureCount})</option>`
    ).join('');

    return `<div class="modal-content chart-map-content">
      <div class="modal-header">
        <h3>도형표현도</h3>
        <button class="modal-close" id="chart-map-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="chart-layer">레이어</label>
          <select id="chart-layer">${layerOptions}</select>
        </div>
        <div class="form-group">
          <label for="chart-type">차트 유형</label>
          <select id="chart-type">
            <option value="pie">파이 차트</option>
            <option value="bar">막대 차트</option>
          </select>
        </div>
        <div class="form-group">
          <label id="field-select-label">표시할 필드 (2개 이상 선택)</label>
          <div class="field-list" id="chart-field-list"></div>
        </div>
        <div class="form-group">
          <label for="chart-size-field">크기 기준 필드 (선택)</label>
          <select id="chart-size-field">
            <option value="">고정 크기</option>
          </select>
        </div>
        <div class="form-group">
          <label for="chart-min-size">최소 크기: <span id="min-size-value">20</span>px</label>
          <input type="range" id="chart-min-size" min="10" max="40" value="20">
        </div>
        <div class="form-group">
          <label for="chart-max-size">최대 크기: <span id="max-size-value">60</span>px</label>
          <input type="range" id="chart-max-size" min="30" max="100" value="60">
        </div>
        <div class="chart-preview" id="chart-preview">
          <div class="preview-title">미리보기</div>
          <div class="preview-legend" id="chart-legend"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="chart-map-clear">차트 제거</button>
        <button class="btn btn-secondary" id="chart-map-cancel">취소</button>
        <button class="btn btn-primary" id="chart-map-apply" disabled>적용</button>
      </div>
    </div>`;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('chart-map-close');
    const cancelBtn = document.getElementById('chart-map-cancel');
    const applyBtn = document.getElementById('chart-map-apply');
    const clearBtn = document.getElementById('chart-map-clear');
    const layerSelect = document.getElementById('chart-layer');
    const chartTypeSelect = document.getElementById('chart-type');
    const minSizeInput = document.getElementById('chart-min-size');
    const maxSizeInput = document.getElementById('chart-max-size');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    layerSelect.addEventListener('change', () => {
      this.selectedLayerId = layerSelect.value;
      this.selectedFields = [];
      this.updateFieldList();
    });

    chartTypeSelect.addEventListener('change', () => {
      this.updateFieldLabel();
      this.updateSelection();
    });

    minSizeInput.addEventListener('input', (e) => {
      document.getElementById('min-size-value').textContent = e.target.value;
    });

    maxSizeInput.addEventListener('input', (e) => {
      document.getElementById('max-size-value').textContent = e.target.value;
    });

    applyBtn.addEventListener('click', () => this.apply());
    clearBtn.addEventListener('click', () => this.clearCharts());
  }

  /**
   * 필드 선택 레이블 업데이트
   */
  updateFieldLabel() {
    const chartType = document.getElementById('chart-type').value;
    const labelEl = document.getElementById('field-select-label');
    if (chartType === 'bar') {
      labelEl.textContent = '표시할 필드 (1개 이상 선택)';
    } else {
      labelEl.textContent = '표시할 필드 (2개 이상 선택)';
    }
  }

  /**
   * 필드 목록 업데이트
   */
  updateFieldList() {
    const fieldListEl = document.getElementById('chart-field-list');
    const sizeFieldSelect = document.getElementById('chart-size-field');
    const fields = chartMapTool.getNumericFields(this.selectedLayerId);
    const colors = chartMapTool.getColors();

    // 필드 체크박스 목록
    let fieldHTML = '';
    fields.forEach((field, i) => {
      const color = colors[i % colors.length];
      fieldHTML += `
        <label class="field-checkbox">
          <input type="checkbox" value="${field}" data-color="${color}">
          <span class="color-box" style="background:${color}"></span>
          ${field}
        </label>`;
    });
    fieldListEl.innerHTML = fieldHTML || '<div class="no-fields">숫자 필드가 없습니다</div>';

    // 크기 필드 옵션
    let sizeOptions = '<option value="">고정 크기</option>';
    fields.forEach(field => {
      sizeOptions += `<option value="${field}">${field}</option>`;
    });
    sizeFieldSelect.innerHTML = sizeOptions;

    // 체크박스 이벤트
    fieldListEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => this.updateSelection());
    });

    this.updateSelection();
  }

  /**
   * 선택 상태 업데이트
   */
  updateSelection() {
    const checkboxes = document.querySelectorAll('#chart-field-list input:checked');
    this.selectedFields = Array.from(checkboxes).map(cb => cb.value);

    const chartType = document.getElementById('chart-type').value;
    const minFields = chartType === 'bar' ? 1 : 2;

    const applyBtn = document.getElementById('chart-map-apply');
    applyBtn.disabled = this.selectedFields.length < minFields;

    this.updateLegend();
  }

  /**
   * 범례 업데이트
   */
  updateLegend() {
    const legendEl = document.getElementById('chart-legend');
    const colors = chartMapTool.getColors();

    if (this.selectedFields.length === 0) {
      legendEl.innerHTML = '<div class="no-selection">필드를 선택하세요</div>';
      return;
    }

    let html = '';
    this.selectedFields.forEach((field, i) => {
      const color = colors[i % colors.length];
      html += `<div class="legend-item">
        <span class="legend-color" style="background:${color}"></span>
        <span class="legend-label">${field}</span>
      </div>`;
    });

    legendEl.innerHTML = html;
  }

  /**
   * 도형표현도 적용
   */
  apply() {
    const chartType = document.getElementById('chart-type').value;
    const sizeField = document.getElementById('chart-size-field').value;
    const minSize = parseInt(document.getElementById('chart-min-size').value);
    const maxSize = parseInt(document.getElementById('chart-max-size').value);

    const minFields = chartType === 'bar' ? 1 : 2;
    if (this.selectedFields.length < minFields) {
      alert(chartType === 'bar' ? '최소 1개 이상의 필드를 선택해주세요.' : '최소 2개 이상의 필드를 선택해주세요.');
      return;
    }

    const applyBtn = document.getElementById('chart-map-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '적용 중...';

    try {
      const result = chartMapTool.createChartMap(this.selectedLayerId, {
        chartType,
        fields: this.selectedFields,
        sizeField: sizeField || null,
        minSize,
        maxSize
      });

      alert(`도형표현도 생성 완료!\n차트 수: ${result.chartCount}`);
      this.close();
    } catch (error) {
      alert('도형표현도 생성 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '적용';
    }
  }

  /**
   * 차트 제거
   */
  clearCharts() {
    chartMapTool.removeChartMap(this.selectedLayerId);
    alert('차트가 제거되었습니다.');
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

export const chartMapPanel = new ChartMapPanel();
