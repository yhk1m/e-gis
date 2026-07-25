/**
 * BufferPanel - 버퍼 분석 설정 패널
 */

import { bufferTool } from '../../tools/BufferTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId } from '../../utils/layerSelect.js';

class BufferPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
  }

  /**
   * 버퍼 패널 열기
   */
  show(layerId = null) {
    const layers = bufferTool.getCompatibleLayers();
    if (layers.length === 0) {
      alert('버퍼를 만들 수 있는 레이어가 없습니다.\n(피처가 있는 벡터 레이어가 필요합니다)');
      return;
    }

    // 선택 중인 레이어가 버퍼를 지원하면 미리 골라 준다.
    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || null;
    this.render(layers);
  }

  /**
   * 모달 렌더링
   */
  render(layers) {
    this.close();

    const units = bufferTool.getUnits();

    this.modal = document.createElement('div');
    this.modal.className = 'buffer-modal';
    this.modal.innerHTML = this.getModalHTML(layers, units);
    document.body.appendChild(this.modal);

    this.bindEvents();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layers, units) {
    const layerOptions = buildLayerOptions(layers, { selectedId: this.currentLayerId });
    const unitOptions = units.map(u =>
      '<option value="' + u.value + '">' + u.label + '</option>'
    ).join('');

    return '<div class="buffer-content">' +
      '<div class="buffer-header">' +
        '<h3>버퍼 분석</h3>' +
        '<button class="buffer-close" id="buffer-close">&times;</button>' +
      '</div>' +
      '<div class="buffer-body">' +
        '<div class="buffer-form-group">' +
          '<label for="buffer-layer">소스 레이어</label>' +
          '<select id="buffer-layer">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="buffer-form-group">' +
          '<label for="buffer-distance">버퍼 거리</label>' +
          '<input type="number" id="buffer-distance" value="100" min="1" step="1">' +
        '</div>' +
        '<div class="buffer-form-group">' +
          '<label for="buffer-unit">단위</label>' +
          '<select id="buffer-unit">' + unitOptions + '</select>' +
        '</div>' +
        '<div class="buffer-form-group">' +
          '<label for="buffer-color">버퍼 색상</label>' +
          '<input type="color" id="buffer-color" value="#3388ff">' +
        '</div>' +
        '<div class="buffer-form-group">' +
          '<label for="buffer-dissolve">' +
            '<input type="checkbox" id="buffer-dissolve"> 버퍼 병합 (Dissolve)' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="buffer-footer">' +
        '<button class="btn btn-secondary" id="buffer-cancel">취소</button>' +
        '<button class="btn btn-primary" id="buffer-apply">적용</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const layerSelect = document.getElementById('buffer-layer');
    const closeBtn = document.getElementById('buffer-close');
    const cancelBtn = document.getElementById('buffer-cancel');
    const applyBtn = document.getElementById('buffer-apply');

    layerSelect.addEventListener('change', () => {
      this.currentLayerId = layerSelect.value || null;
    });

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    applyBtn.addEventListener('click', () => this.apply());
  }

  /**
   * 버퍼 적용
   */
  apply() {
    if (!this.currentLayerId) {
      alert('먼저 소스 레이어를 선택해주세요.');
      return;
    }

    const distance = parseFloat(document.getElementById('buffer-distance').value);
    const unit = document.getElementById('buffer-unit').value;
    const color = document.getElementById('buffer-color').value;
    const dissolve = document.getElementById('buffer-dissolve').checked;

    if (isNaN(distance) || distance <= 0) {
      alert('올바른 버퍼 거리를 입력해주세요.');
      return;
    }

    try {
      // 투명도는 레이어 패널의 스타일 편집이 담당한다. 여기서 중복 제공하지 않는다.
      const result = bufferTool.createBuffer(this.currentLayerId, distance, unit, {
        color,
        dissolve
      });

      alert(`버퍼가 생성되었습니다!\n레이어: ${result.layerName}\n피처 수: ${result.featureCount}`);
      this.close();
    } catch (error) {
      alert('버퍼 생성 실패: ' + error.message);
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

export const bufferPanel = new BufferPanel();
