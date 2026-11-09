/**
 * HeatmapPanel - 히트맵 설정 패널
 */

import { heatmapTool } from '../../tools/HeatmapTool.js';
import { layerManager } from '../../core/LayerManager.js';
import {
  buildLayerOptions, resolveInitialLayerValue, resolveMultiLayerIds, commonFields, MULTI_LAYER_VALUE
} from '../../utils/layerSelect.js';
import { showAlert } from '../../utils/dialogs.js';
import { runForEachLayer, reportBatch } from '../../utils/layerBatch.js';

class HeatmapPanel {
  constructor() {
    this.modal = null;
    this.selectedLayerId = null;
    this.multiIds = [];
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

    const pointLayers = heatmapTool.getPointLayers();
    const gradients = heatmapTool.getGradients();

    if (pointLayers.length === 0) {
      showAlert('히트맵을 생성하려면 포인트 레이어가 필요합니다.');
      return;
    }

    // 선택 중인 레이어가 포인트 레이어면 미리 골라 준다.
    // 여러 개를 골라 두었으면 「선택한 레이어 N개 모두」를 미리 고른다.
    const selectedIds = layerManager.getSelectedLayerIds();
    this.multiIds = resolveMultiLayerIds(pointLayers, selectedIds);
    this.selectedLayerId = resolveInitialLayerValue(pointLayers, layerManager.getSelectedLayerId(), selectedIds) || null;

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay heatmap-modal active';
    this.modal.innerHTML = this.getModalHTML(pointLayers, gradients);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateWeightFields();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layers, gradients) {
    const layerOptions = buildLayerOptions(layers, { selectedId: this.selectedLayerId, showCount: true, multiIds: this.multiIds });

    const gradientOptions = gradients.map((g, i) =>
      '<option value="' + i + '">' + g.name + '</option>'
    ).join('');

    return '<div class="modal-content heatmap-content">' +
      '<div class="modal-header">' +
        '<h3>히트맵 생성</h3>' +
        '<button class="modal-close" id="heatmap-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label for="heatmap-layer">포인트 레이어</label>' +
          '<select id="heatmap-layer">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="heatmap-radius">반경: <span id="radius-value">10</span>px</label>' +
          '<input type="range" id="heatmap-radius" min="1" max="50" value="10">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="heatmap-blur">흐림: <span id="blur-value">15</span>px</label>' +
          '<input type="range" id="heatmap-blur" min="1" max="50" value="15">' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="heatmap-gradient">색상 그라디언트</label>' +
          '<select id="heatmap-gradient">' + gradientOptions + '</select>' +
          '<div class="gradient-preview-container">' +
            '<div class="gradient-preview" id="gradient-preview"></div>' +
            '<div class="gradient-preview-labels">' +
              '<span>낮음</span>' +
              '<span>높음</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="checkbox-label">' +
            '<input type="checkbox" id="heatmap-reverse">' +
            '<span>색상 반전</span>' +
          '</label>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="heatmap-weight">가중치 필드 (선택)</label>' +
          '<select id="heatmap-weight">' +
            '<option value="">없음</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>' +
            '<input type="checkbox" id="heatmap-hide-source"> 원본 레이어 숨기기' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" id="heatmap-cancel">취소</button>' +
        '<button class="btn btn-primary" id="heatmap-apply">히트맵 생성</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('heatmap-close');
    const cancelBtn = document.getElementById('heatmap-cancel');
    const applyBtn = document.getElementById('heatmap-apply');
    const layerSelect = document.getElementById('heatmap-layer');
    const radiusInput = document.getElementById('heatmap-radius');
    const blurInput = document.getElementById('heatmap-blur');
    const gradientSelect = document.getElementById('heatmap-gradient');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    // 레이어 변경 시 가중치 필드 업데이트
    layerSelect.addEventListener('change', () => {
      this.selectedLayerId = layerSelect.value || null;
      this.updateWeightFields();
    });

    // 슬라이더 값 표시
    radiusInput.addEventListener('input', (e) => {
      document.getElementById('radius-value').textContent = e.target.value;
    });

    blurInput.addEventListener('input', (e) => {
      document.getElementById('blur-value').textContent = e.target.value;
    });

    // 그라디언트 미리보기
    gradientSelect.addEventListener('change', () => this.updateGradientPreview());

    // 색상 반전 체크박스
    const reverseCheckbox = document.getElementById('heatmap-reverse');
    reverseCheckbox.addEventListener('change', () => this.updateGradientPreview());

    this.updateGradientPreview();

    // 히트맵 생성
    applyBtn.addEventListener('click', () => this.createHeatmap());
  }

  /**
   * 가중치 필드 목록 업데이트
   */
  updateWeightFields() {
    const weightSelect = document.getElementById('heatmap-weight');
    // 여러 레이어면 모든 레이어에 있는 숫자 필드만 가중치로 고를 수 있다
    let fields = [];
    if (this.selectedLayerId === MULTI_LAYER_VALUE) {
      fields = commonFields(this.multiIds.map(id => heatmapTool.getNumericFields(id)));
    } else if (this.selectedLayerId) {
      fields = heatmapTool.getNumericFields(this.selectedLayerId);
    }

    let options = '<option value="">없음</option>';
    fields.forEach(field => {
      options += '<option value="' + field + '">' + field + '</option>';
    });

    weightSelect.innerHTML = options;
  }

  /**
   * 그라디언트 미리보기 업데이트
   */
  updateGradientPreview() {
    const gradientSelect = document.getElementById('heatmap-gradient');
    const reverseCheckbox = document.getElementById('heatmap-reverse');
    const previewEl = document.getElementById('gradient-preview');
    const gradients = heatmapTool.getGradients();

    const selectedGradient = gradients[parseInt(gradientSelect.value)];
    if (selectedGradient) {
      let colors = [...selectedGradient.value];
      if (reverseCheckbox.checked) {
        colors = colors.reverse();
      }
      const gradientCss = 'linear-gradient(to right, ' + colors.join(', ') + ')';
      previewEl.style.background = gradientCss;
    }
  }

  /**
   * 히트맵 생성
   */
  createHeatmap() {
    const layerId = document.getElementById('heatmap-layer').value;
    if (!layerId) {
      showAlert('먼저 포인트 레이어를 선택해주세요.');
      return;
    }

    const radius = parseInt(document.getElementById('heatmap-radius').value);
    const blur = parseInt(document.getElementById('heatmap-blur').value);
    const gradientIndex = parseInt(document.getElementById('heatmap-gradient').value);
    const reverse = document.getElementById('heatmap-reverse').checked;
    const weight = document.getElementById('heatmap-weight').value;
    const hideSource = document.getElementById('heatmap-hide-source').checked;

    const gradients = heatmapTool.getGradients();
    let gradient = gradients[gradientIndex]?.value;

    // 색상 반전 적용
    if (gradient && reverse) {
      gradient = [...gradient].reverse();
    }

    const options = { radius, blur, gradient, weight: weight || null, hideSource };

    if (layerId === MULTI_LAYER_VALUE) {
      this.applyToMany(options);
      return;
    }

    const applyBtn = document.getElementById('heatmap-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '생성 중...';

    try {
      heatmapTool.createHeatmap(layerId, options);

      showAlert('히트맵이 생성되었습니다.');
      this.close();
    } catch (error) {
      showAlert('히트맵 생성 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '히트맵 생성';
    }
  }

  /** 「선택한 레이어 N개 모두」: 레이어마다 따로 히트맵을 만든다 */
  async applyToMany(options) {
    const ids = this.multiIds.slice();
    this.close();
    const result = await runForEachLayer(ids,
      id => heatmapTool.createHeatmap(id, { ...options }),
      { getName: id => (layerManager.getLayer(id) || {}).name });
    await reportBatch(result, '히트맵 만들기');
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

export const heatmapPanel = new HeatmapPanel();
