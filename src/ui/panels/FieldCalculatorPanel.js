/**
 * FieldCalculatorPanel - 필드 계산기 UI 패널
 */

import { fieldCalculatorTool } from '../../tools/FieldCalculatorTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId } from '../../utils/layerSelect.js';

class FieldCalculatorPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
  }

  /**
   * 필드 계산기 패널 열기
   */
  show(layerId = null) {
    const layers = fieldCalculatorTool.getCompatibleLayers();
    if (layers.length === 0) {
      alert('필드를 계산할 수 있는 레이어가 없습니다.\n(피처가 있는 벡터 레이어가 필요합니다)');
      return;
    }

    // 선택 중인 레이어가 필드 계산을 지원하면 미리 골라 준다.
    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || null;
    this.render(layers);
  }

  /**
   * 모달 렌더링
   */
  render(layers) {
    this.close();

    const functions = fieldCalculatorTool.getFunctions();
    const geoFunctions = fieldCalculatorTool.getGeoFunctions();

    this.modal = document.createElement('div');
    this.modal.className = 'field-calc-modal';
    this.modal.innerHTML = this.getModalHTML(layers, functions, geoFunctions);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateFieldWidgets();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layers, functions, geoFunctions) {
    const layerOptions = buildLayerOptions(layers, { selectedId: this.currentLayerId });

    const funcButtons = functions.map(f =>
      '<button class="func-btn" data-func="' + f.name + '" title="' + f.desc + '">' + f.name.split('(')[0] + '</button>'
    ).join('');

    const geoButtons = geoFunctions.map(f =>
      '<button class="geo-btn" data-func="' + f.name + '" title="' + f.desc + '">' + f.name + '</button>'
    ).join('');

    return '<div class="field-calc-content">' +
      '<div class="field-calc-header">' +
        '<h3>필드 계산기</h3>' +
        '<button class="field-calc-close" id="field-calc-close">&times;</button>' +
      '</div>' +
      '<div class="field-calc-body">' +
        '<div class="field-calc-row">' +
          '<div class="field-calc-col">' +
            '<label for="field-calc-layer">레이어</label>' +
            '<select id="field-calc-layer">' + layerOptions + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="field-calc-row">' +
          '<div class="field-calc-col">' +
            '<label>결과 필드명</label>' +
            '<input type="text" id="field-calc-name" placeholder="새 필드명 입력">' +
          '</div>' +
          '<div class="field-calc-col">' +
            '<label>' +
              '<input type="checkbox" id="field-calc-update"> 기존 필드 업데이트' +
            '</label>' +
            '<select id="field-calc-existing" disabled></select>' +
          '</div>' +
        '</div>' +
        '<div class="field-calc-section">' +
          '<label>계산 표현식</label>' +
          '<textarea id="field-calc-expr" rows="3" placeholder="예: [population] / [area] * 1000"></textarea>' +
        '</div>' +
        '<div class="field-calc-helpers">' +
          '<div class="helper-section">' +
            '<label>필드</label>' +
            '<div class="helper-buttons" id="field-calc-field-buttons"></div>' +
          '</div>' +
          '<div class="helper-section">' +
            '<label>지오메트리</label>' +
            '<div class="helper-buttons">' + geoButtons + '</div>' +
          '</div>' +
          '<div class="helper-section">' +
            '<label>함수</label>' +
            '<div class="helper-buttons">' + funcButtons + '</div>' +
          '</div>' +
          '<div class="helper-section">' +
            '<label>연산자</label>' +
            '<div class="helper-buttons">' +
              '<button class="op-btn" data-op="+">+</button>' +
              '<button class="op-btn" data-op="-">-</button>' +
              '<button class="op-btn" data-op="*">×</button>' +
              '<button class="op-btn" data-op="/">÷</button>' +
              '<button class="op-btn" data-op="(">(</button>' +
              '<button class="op-btn" data-op=")">)</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="field-calc-footer">' +
        '<button class="btn btn-secondary" id="field-calc-cancel">취소</button>' +
        '<button class="btn btn-primary" id="field-calc-apply">계산 실행</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const layerSelect = document.getElementById('field-calc-layer');
    const closeBtn = document.getElementById('field-calc-close');
    const cancelBtn = document.getElementById('field-calc-cancel');
    const applyBtn = document.getElementById('field-calc-apply');
    const updateCheckbox = document.getElementById('field-calc-update');
    const existingSelect = document.getElementById('field-calc-existing');
    const nameInput = document.getElementById('field-calc-name');
    const exprTextarea = document.getElementById('field-calc-expr');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    layerSelect.addEventListener('change', () => {
      this.currentLayerId = layerSelect.value || null;
      this.updateFieldWidgets();
    });

    // 기존 필드 업데이트 체크박스
    updateCheckbox.addEventListener('change', (e) => {
      existingSelect.disabled = !e.target.checked;
      nameInput.disabled = e.target.checked;
      if (e.target.checked && existingSelect.value) {
        nameInput.value = existingSelect.value;
      }
    });

    existingSelect.addEventListener('change', (e) => {
      if (updateCheckbox.checked) {
        nameInput.value = e.target.value;
      }
    });

    // 지오메트리 함수 버튼 클릭
    this.modal.querySelectorAll('.geo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.insertAtCursor(exprTextarea, btn.dataset.func);
      });
    });

    // 함수 버튼 클릭
    this.modal.querySelectorAll('.func-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.insertAtCursor(exprTextarea, btn.dataset.func);
      });
    });

    // 연산자 버튼 클릭
    this.modal.querySelectorAll('.op-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.insertAtCursor(exprTextarea, ' ' + btn.dataset.op + ' ');
      });
    });

    // 계산 실행
    applyBtn.addEventListener('click', () => this.calculate());
  }

  /**
   * 선택된 레이어의 필드로 필드 버튼과 '기존 필드' 목록을 다시 채운다.
   * 레이어가 안 골라졌으면 안내 문구만 둔다.
   */
  updateFieldWidgets() {
    const buttonsEl = document.getElementById('field-calc-field-buttons');
    const existingSelect = document.getElementById('field-calc-existing');
    if (!buttonsEl || !existingSelect) return;

    const fields = this.currentLayerId ? fieldCalculatorTool.getLayerFields(this.currentLayerId) : [];

    if (!this.currentLayerId) {
      buttonsEl.innerHTML = '<span class="no-fields">먼저 레이어를 선택하세요</span>';
    } else {
      buttonsEl.innerHTML = fields.map(f =>
        '<button class="field-btn" data-field="' + f + '">[' + f + ']</button>'
      ).join('') || '<span class="no-fields">필드 없음</span>';
    }

    // 필드 버튼은 레이어가 바뀔 때마다 새로 만들어지므로 여기서 다시 묶는다.
    const exprTextarea = document.getElementById('field-calc-expr');
    buttonsEl.querySelectorAll('.field-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.insertAtCursor(exprTextarea, '[' + btn.dataset.field + ']');
      });
    });

    existingSelect.innerHTML = '<option value="">필드 선택...</option>' +
      fields.map(f => '<option value="' + f + '">' + f + '</option>').join('');
  }

  /**
   * 커서 위치에 텍스트 삽입
   */
  insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  }

  /**
   * 계산 실행
   */
  calculate() {
    if (!this.currentLayerId) {
      alert('먼저 레이어를 선택해주세요.');
      return;
    }

    const fieldName = document.getElementById('field-calc-name').value.trim();
    const expression = document.getElementById('field-calc-expr').value.trim();
    const updateExisting = document.getElementById('field-calc-update').checked;

    if (!fieldName) {
      alert('결과 필드명을 입력해주세요.');
      return;
    }

    if (!expression) {
      alert('계산 표현식을 입력해주세요.');
      return;
    }

    try {
      const result = fieldCalculatorTool.calculate(
        this.currentLayerId,
        fieldName,
        expression,
        !updateExisting
      );

      alert(`계산 완료!\n성공: ${result.success}개\n실패: ${result.error}개`);

      if (result.success > 0) {
        this.close();
      }
    } catch (error) {
      alert('계산 오류: ' + error.message);
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

export const fieldCalculatorPanel = new FieldCalculatorPanel();
