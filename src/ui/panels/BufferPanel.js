/**
 * BufferPanel - 버퍼 분석 설정 패널
 */

import { bufferTool } from '../../tools/BufferTool.js';
import { layerManager } from '../../core/LayerManager.js';

class BufferPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
  }

  /**
   * 버퍼 패널 열기
   */
  show(layerId = null) {
    if (!layerId) {
      layerId = layerManager.getSelectedLayerId();
    }
    if (!layerId) {
      alert('먼저 레이어를 선택해주세요.');
      return;
    }

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    this.currentLayerId = layerId;
    this.render(layerInfo);
  }

  /**
   * 모달 렌더링
   */
  render(layerInfo) {
    this.close();

    const units = bufferTool.getUnits();

    this.modal = document.createElement('div');
    this.modal.className = 'buffer-modal';
    this.modal.innerHTML = this.getModalHTML(layerInfo.name, units);
    document.body.appendChild(this.modal);

    this.bindEvents();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layerName, units) {
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
          '<label>소스 레이어</label>' +
          '<div class="buffer-layer-name">' + layerName + '</div>' +
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
          '<label for="buffer-opacity">투명도</label>' +
          '<input type="range" id="buffer-opacity" min="0.1" max="1" step="0.1" value="0.3">' +
          '<span id="buffer-opacity-value">0.3</span>' +
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
    const closeBtn = document.getElementById('buffer-close');
    const cancelBtn = document.getElementById('buffer-cancel');
    const applyBtn = document.getElementById('buffer-apply');
    const opacityInput = document.getElementById('buffer-opacity');
    const opacityValue = document.getElementById('buffer-opacity-value');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    });

    opacityInput.addEventListener('input', (e) => {
      opacityValue.textContent = e.target.value;
    });

    applyBtn.addEventListener('click', () => this.apply());
  }

  /**
   * 버퍼 적용
   */
  apply() {
    const distance = parseFloat(document.getElementById('buffer-distance').value);
    const unit = document.getElementById('buffer-unit').value;
    const color = document.getElementById('buffer-color').value;
    const opacity = parseFloat(document.getElementById('buffer-opacity').value);
    const dissolve = document.getElementById('buffer-dissolve').checked;

    if (isNaN(distance) || distance <= 0) {
      alert('올바른 버퍼 거리를 입력해주세요.');
      return;
    }

    try {
      const result = bufferTool.createBuffer(this.currentLayerId, distance, unit, {
        color,
        opacity,
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
