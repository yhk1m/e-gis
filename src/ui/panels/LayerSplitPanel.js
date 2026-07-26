// © 2026 김용현
/**
 * LayerSplitPanel - 한 레이어를 여러 레이어로 나누는 패널
 *
 * 속성값이 같은 것끼리 묶어 나누거나(예: 시도별), 객체 하나씩 나눈다.
 */

import { layerCombineTool, MAX_SPLIT_LAYERS } from '../../tools/LayerCombineTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId } from '../../utils/layerSelect.js';

class LayerSplitPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
  }

  show(layerId = null) {
    const layers = layerCombineTool.getCompatibleLayers();
    if (layers.length === 0) {
      alert('나눌 수 있는 레이어가 없습니다.\n(객체가 있는 벡터 레이어가 필요합니다)');
      return;
    }

    // 선택 중인 레이어를 미리 골라 준다
    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || null;
    this.render(layers);
  }

  render(layers) {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'choropleth-modal';
    this.modal.innerHTML = this.getModalHTML(layers);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateFieldOptions();
  }

  getModalHTML(layers) {
    const layerOptions = buildLayerOptions(layers, { selectedId: this.currentLayerId, showCount: true });

    return `<div class="choropleth-content" style="width: 420px;">
      <div class="choropleth-header">
        <h3>레이어 나누기</h3>
        <button class="choropleth-close" id="split-close">&times;</button>
      </div>
      <div class="choropleth-body">
        <div class="choropleth-form-group">
          <label for="split-layer">나눌 레이어</label>
          <select id="split-layer">${layerOptions}</select>
        </div>

        <div class="choropleth-form-group">
          <label for="split-mode">나누는 기준</label>
          <select id="split-mode">
            <option value="field" selected>속성값 기준 (같은 값끼리 묶기)</option>
            <option value="feature">객체별 (하나씩 나누기)</option>
          </select>
        </div>

        <div class="choropleth-form-group" id="split-field-group">
          <label for="split-field">기준 필드</label>
          <select id="split-field"></select>
        </div>

        <div class="choropleth-form-group" id="split-name-group" style="display:none">
          <label for="split-name-field">레이어 이름에 쓸 필드</label>
          <select id="split-name-field"></select>
        </div>

        <div class="join-preview" id="split-preview">
          <div class="preview-stats">
            <div class="stat-item"><span class="stat-label">만들어질 레이어:</span> <span id="split-count">-</span></div>
          </div>
        </div>

        <div class="choropleth-form-group">
          <label class="field-checkbox">
            <input type="checkbox" id="split-remove-source">
            <span>나눈 뒤 원본 레이어 삭제</span>
          </label>
        </div>
      </div>
      <div class="choropleth-footer">
        <button class="btn btn-secondary" id="split-cancel">취소</button>
        <button class="btn btn-primary" id="split-apply" disabled>나누기</button>
      </div>
    </div>`;
  }

  bindEvents() {
    const close = () => this.close();
    document.getElementById('split-close').addEventListener('click', close);
    document.getElementById('split-cancel').addEventListener('click', close);
    document.getElementById('split-apply').addEventListener('click', () => this.apply());

    const layerSelect = document.getElementById('split-layer');
    layerSelect.addEventListener('change', () => {
      this.currentLayerId = layerSelect.value || null;
      this.updateFieldOptions();
    });

    document.getElementById('split-mode').addEventListener('change', () => this.updateFieldOptions());
    document.getElementById('split-field').addEventListener('change', () => this.updatePreview());
  }

  /** 선택된 레이어의 필드로 기준·이름 목록을 채운다 */
  updateFieldOptions() {
    const mode = document.getElementById('split-mode').value;
    const fieldGroup = document.getElementById('split-field-group');
    const nameGroup = document.getElementById('split-name-group');
    const fieldSelect = document.getElementById('split-field');
    const nameSelect = document.getElementById('split-name-field');

    fieldGroup.style.display = mode === 'field' ? '' : 'none';
    nameGroup.style.display = mode === 'feature' ? '' : 'none';

    if (!this.currentLayerId) {
      fieldSelect.innerHTML = '<option value="">-- 먼저 레이어를 선택하세요 --</option>';
      nameSelect.innerHTML = '<option value="">-- 먼저 레이어를 선택하세요 --</option>';
      this.updatePreview();
      return;
    }

    const fields = layerCombineTool.getFields(this.currentLayerId);
    const options = fields.map(f => `<option value="${f}">${f}</option>`).join('');

    fieldSelect.innerHTML = options || '<option value="">속성 필드가 없습니다</option>';
    fieldSelect.disabled = fields.length === 0;
    nameSelect.innerHTML = '<option value="">번호 (1, 2, 3…)</option>' + options;

    this.updatePreview();
  }

  /** 몇 개의 레이어가 만들어지는지 미리 보여 준다 */
  updatePreview() {
    const countEl = document.getElementById('split-count');
    const applyBtn = document.getElementById('split-apply');
    const mode = document.getElementById('split-mode').value;

    if (!this.currentLayerId) {
      countEl.textContent = '-';
      applyBtn.disabled = true;
      return;
    }

    let count = 0;
    if (mode === 'feature') {
      const layerInfo = layerManager.getLayer(this.currentLayerId);
      count = layerInfo ? layerInfo.source.getFeatures().length : 0;
    } else {
      const field = document.getElementById('split-field').value;
      count = field ? layerCombineTool.countGroups(this.currentLayerId, field) : 0;
    }

    const tooMany = count > MAX_SPLIT_LAYERS;
    countEl.textContent = count > 0
      ? `${count}개${tooMany ? ` — 너무 많습니다 (최대 ${MAX_SPLIT_LAYERS}개)` : ''}`
      : '-';
    countEl.style.color = tooMany ? 'var(--color-danger)' : '';
    applyBtn.disabled = count === 0 || tooMany;
  }

  apply() {
    if (!this.currentLayerId) {
      alert('먼저 레이어를 선택해주세요.');
      return;
    }

    const mode = document.getElementById('split-mode').value;
    const removeSource = document.getElementById('split-remove-source').checked;

    try {
      const result = mode === 'feature'
        ? layerCombineTool.splitByFeature(this.currentLayerId, {
          removeSource,
          nameField: document.getElementById('split-name-field').value || null
        })
        : layerCombineTool.splitByField(
          this.currentLayerId,
          document.getElementById('split-field').value,
          { removeSource }
        );

      alert(`레이어를 나눴습니다.\n- 만들어진 레이어: ${result.groupCount}개`);
      this.close();
    } catch (error) {
      alert('나누기 실패: ' + error.message);
    }
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const layerSplitPanel = new LayerSplitPanel();
