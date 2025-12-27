/**
 * SpatialOperationsPanel - 공간 연산 설정 패널
 */

import { spatialOperationsTool } from '../../tools/SpatialOperationsTool.js';
import { layerManager } from '../../core/LayerManager.js';

class SpatialOperationsPanel {
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

    const polygonLayers = spatialOperationsTool.getPolygonLayers();
    const operations = spatialOperationsTool.getOperations();

    if (polygonLayers.length < 2) {
      alert('공간 연산을 수행하려면 최소 2개의 폴리곤 레이어가 필요합니다.');
      return;
    }

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay spatial-ops-modal active';
    this.modal.innerHTML = this.getModalHTML(polygonLayers, operations);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateDescription();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layers, operations) {
    const layerOptions = layers.map(l =>
      '<option value="' + l.id + '">' + l.name + ' (' + l.featureCount + ')</option>'
    ).join('');

    const operationOptions = operations.map(op =>
      '<option value="' + op.value + '">' + op.label + '</option>'
    ).join('');

    return '<div class="modal-content spatial-ops-content">' +
      '<div class="modal-header">' +
        '<h3>공간 연산</h3>' +
        '<button class="modal-close" id="spatial-ops-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label for="spatial-ops-operation">연산 유형</label>' +
          '<select id="spatial-ops-operation">' + operationOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label id="layer1-label">입력 레이어 1</label>' +
          '<select id="spatial-ops-layer1">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label id="layer2-label">입력 레이어 2</label>' +
          '<select id="spatial-ops-layer2">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="operation-description" id="operation-desc">' +
          '<p>두 레이어가 겹치는 영역을 추출합니다.</p>' +
        '</div>' +
        '<div class="operation-preview">' +
          '<div class="preview-diagram" id="preview-diagram">' +
            '<div class="preview-shape shape1"></div>' +
            '<div class="preview-shape shape2"></div>' +
            '<div class="preview-result"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" id="spatial-ops-cancel">취소</button>' +
        '<button class="btn btn-primary" id="spatial-ops-apply">연산 실행</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('spatial-ops-close');
    const cancelBtn = document.getElementById('spatial-ops-cancel');
    const applyBtn = document.getElementById('spatial-ops-apply');
    const operationSelect = document.getElementById('spatial-ops-operation');
    const layer1Select = document.getElementById('spatial-ops-layer1');
    const layer2Select = document.getElementById('spatial-ops-layer2');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    });

    // 연산 변경 시 설명 업데이트
    operationSelect.addEventListener('change', () => this.updateDescription());

    // 레이어 선택 변경 시 다른 선택 확인
    layer1Select.addEventListener('change', () => {
      if (layer1Select.value === layer2Select.value) {
        const options = layer2Select.options;
        for (let i = 0; i < options.length; i++) {
          if (options[i].value !== layer1Select.value) {
            layer2Select.value = options[i].value;
            break;
          }
        }
      }
    });

    // 연산 실행
    applyBtn.addEventListener('click', () => this.executeOperation());
  }

  /**
   * 연산 설명 업데이트
   */
  updateDescription() {
    const operationSelect = document.getElementById('spatial-ops-operation');
    const descEl = document.getElementById('operation-desc');
    const previewEl = document.getElementById('preview-diagram');
    const layer1Label = document.getElementById('layer1-label');
    const layer2Label = document.getElementById('layer2-label');

    const operation = operationSelect.value;

    const descriptions = {
      intersect: '두 레이어가 겹치는 영역만 추출합니다.',
      union: '두 레이어의 모든 영역을 하나로 합칩니다.',
      difference: '첫 번째 레이어에서 두 번째 레이어와 겹치는 영역을 제거합니다.',
      clip: '입력 레이어를 클립 레이어의 범위로 자릅니다.'
    };

    const labels = {
      intersect: { l1: '레이어 1', l2: '레이어 2' },
      union: { l1: '레이어 1', l2: '레이어 2' },
      difference: { l1: '입력 레이어 (유지)', l2: '제거할 레이어' },
      clip: { l1: '입력 레이어', l2: '클립 레이어' }
    };

    descEl.innerHTML = '<p>' + (descriptions[operation] || '') + '</p>';
    layer1Label.textContent = labels[operation]?.l1 || '레이어 1';
    layer2Label.textContent = labels[operation]?.l2 || '레이어 2';

    // 미리보기 다이어그램 업데이트
    previewEl.className = 'preview-diagram ' + operation;
  }

  /**
   * 연산 실행
   */
  executeOperation() {
    const operation = document.getElementById('spatial-ops-operation').value;
    const layerId1 = document.getElementById('spatial-ops-layer1').value;
    const layerId2 = document.getElementById('spatial-ops-layer2').value;

    if (layerId1 === layerId2) {
      alert('서로 다른 레이어를 선택해주세요.');
      return;
    }

    const applyBtn = document.getElementById('spatial-ops-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '처리 중...';

    try {
      let result;

      switch (operation) {
        case 'intersect':
          result = spatialOperationsTool.intersect(layerId1, layerId2);
          break;
        case 'union':
          result = spatialOperationsTool.union(layerId1, layerId2);
          break;
        case 'difference':
          result = spatialOperationsTool.difference(layerId1, layerId2);
          break;
        case 'clip':
          result = spatialOperationsTool.clip(layerId1, layerId2);
          break;
        default:
          throw new Error('알 수 없는 연산입니다.');
      }

      alert(`연산 완료!\n새 레이어: ${result.layerName}\n피처 수: ${result.featureCount}`);
      this.close();
    } catch (error) {
      alert('연산 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '연산 실행';
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

export const spatialOperationsPanel = new SpatialOperationsPanel();
