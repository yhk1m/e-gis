// © 2026 김용현
/**
 * GridPanel - 격자 만들기 패널
 *
 * 포인트 레이어를 정사각 격자로 묶어 칸마다 집계한 폴리곤 레이어를 만든다.
 * 공공데이터 화면의 「격자 집계」와 같은 산출물이다(같은 gridLayer 를 쓴다) —
 * 이미 지도에 올라와 있는 포인트 레이어에도 쓸 수 있게 밖으로 낸 것이다.
 */

import { layerManager } from '../../core/LayerManager.js';
import {
  buildLayerOptions, resolveInitialLayerValue, resolveMultiLayerIds, isVectorLayer,
  commonFields, MULTI_LAYER_VALUE
} from '../../utils/layerSelect.js';
import { createGridLayer } from '../../tools/gridLayer.js';
import {
  featuresToPoints, resolveCellSize, numericFields, CELL_SIZE_OPTIONS
} from '../../tools/gridPoints.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { showAlert } from '../../utils/dialogs.js';
import { runForEachLayer, reportBatch } from '../../utils/layerBatch.js';

class GridPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
    this.multiIds = [];
  }

  /** 격자로 묶을 수 있는 레이어 — 점이 있는 벡터 레이어만 */
  getCompatibleLayers() {
    return layerManager.getAllLayers().filter(layerInfo => {
      if (!isVectorLayer(layerInfo)) return false;
      return featuresToPoints(layerInfo.source.getFeatures()).length > 0;
    });
  }

  show(layerId = null) {
    const layers = this.getCompatibleLayers();
    if (layers.length === 0) {
      showAlert('격자로 묶을 수 있는 레이어가 없습니다.\n(점 피처가 있는 벡터 레이어가 필요합니다)');
      return;
    }

    // 여러 개를 골라 두었으면 「선택한 레이어 N개 모두」를 미리 고른다.
    const selectedIds = layerId ? [] : layerManager.getSelectedLayerIds();
    this.multiIds = resolveMultiLayerIds(layers, selectedIds);
    this.currentLayerId = resolveInitialLayerValue(layers, layerId || layerManager.getSelectedLayerId(), selectedIds) || null;
    this.render(layers);
  }

  render(layers) {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'grid-modal';
    this.modal.innerHTML = this.getModalHTML(layers);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.syncFields();
  }

  getModalHTML(layers) {
    const layerOptions = buildLayerOptions(layers, { selectedId: this.currentLayerId, multiIds: this.multiIds });
    const sizeOptions = CELL_SIZE_OPTIONS.map(option =>
      `<option value="${option.value}"${option.value === '1000' ? ' selected' : ''}>${option.label}</option>`
    ).join('');

    return `
      <div class="grid-content">
        <div class="grid-header">
          <h3>격자 만들기</h3>
          <button class="grid-close" id="grid-close">&times;</button>
        </div>
        <div class="grid-body">
          <div class="grid-form-group">
            <label for="grid-layer">포인트 레이어</label>
            <select id="grid-layer">${layerOptions}</select>
          </div>
          <div class="grid-form-group">
            <label for="grid-size">격자 크기</label>
            <select id="grid-size">${sizeOptions}</select>
          </div>
          <div class="grid-form-group" id="grid-size-custom-row" style="display:none;">
            <label for="grid-size-custom">직접 입력 (m)</label>
            <input type="number" id="grid-size-custom" value="2000" min="10" step="10">
          </div>
          <div class="grid-form-group">
            <label for="grid-method">집계 방식</label>
            <select id="grid-method">
              <option value="count">개수</option>
              <option value="sum">합계</option>
              <option value="avg">평균</option>
            </select>
          </div>
          <div class="grid-form-group" id="grid-field-row" style="display:none;">
            <label for="grid-field">값 필드</label>
            <select id="grid-field"></select>
          </div>
          <div class="grid-form-group">
            <label for="grid-empty">
              <input type="checkbox" id="grid-empty"> 데이터가 없는 칸도 표시
            </label>
          </div>
          <div class="grid-form-group">
            <label for="grid-name">레이어 이름</label>
            <input type="text" id="grid-name" value="">
          </div>
        </div>
        <div class="grid-footer">
          <button class="btn btn-secondary" id="grid-cancel">취소</button>
          <button class="btn btn-primary" id="grid-apply">만들기</button>
        </div>
      </div>`;
  }

  /** 「선택한 레이어 N개 모두」가 골라져 있는지 */
  isMulti() {
    return this.currentLayerId === MULTI_LAYER_VALUE;
  }

  /** 지금 고른 레이어의 점들 */
  points() {
    return this.isMulti() ? [] : this.pointsOf(this.currentLayerId);
  }

  /** 레이어 하나의 점들 */
  pointsOf(layerId) {
    const layerInfo = layerId ? layerManager.getLayer(layerId) : null;
    if (!layerInfo || !layerInfo.source) return [];
    return featuresToPoints(layerInfo.source.getFeatures());
  }

  /** 레이어·집계 방식에 따라 값 필드 목록과 기본 이름을 맞춘다 */
  syncFields() {
    const method = document.getElementById('grid-method').value;
    const sizeSelect = document.getElementById('grid-size');
    const customRow = document.getElementById('grid-size-custom-row');
    const fieldRow = document.getElementById('grid-field-row');
    const fieldSelect = document.getElementById('grid-field');

    customRow.style.display = sizeSelect.value === '' ? '' : 'none';

    const needsField = method === 'sum' || method === 'avg';
    fieldRow.style.display = needsField ? '' : 'none';

    if (needsField) {
      // 여러 레이어면 모든 레이어에 있는 숫자 속성만 고를 수 있다
      const fields = this.isMulti()
        ? commonFields(this.multiIds.map(id => numericFields(this.pointsOf(id))))
        : numericFields(this.points());
      fieldSelect.innerHTML = fields.length
        ? fields.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')
        : `<option value="">${this.isMulti() ? '(모든 레이어에 있는 숫자 속성 없음)' : '(숫자 속성 없음)'}</option>`;
    }

    this.syncName();
  }

  /** 레이어 이름 기본값 — 사용자가 손대면 건드리지 않는다 */
  syncName() {
    const nameInput = document.getElementById('grid-name');

    // 여러 레이어면 이름은 레이어마다 자동으로 붙는다
    nameInput.disabled = this.isMulti();
    if (this.isMulti()) {
      nameInput.value = '';
      nameInput.placeholder = '레이어마다 「레이어 이름 격자 크기」로 붙습니다';
      return;
    }
    nameInput.placeholder = '';
    if (nameInput.dataset.touched === '1') return;

    const layerInfo = this.currentLayerId ? layerManager.getLayer(this.currentLayerId) : null;
    const label = this.sizeLabel();
    nameInput.value = layerInfo ? `${layerInfo.name} 격자 ${label}` : `격자 ${label}`;
  }

  /** 격자 크기 글자 (예: 1km) */
  sizeLabel() {
    const sizeSelect = document.getElementById('grid-size');
    return sizeSelect.value === ''
      ? `${document.getElementById('grid-size-custom').value}m`
      : (CELL_SIZE_OPTIONS.find(o => o.value === sizeSelect.value) || {}).label || '';
  }

  bindEvents() {
    const layerSelect = document.getElementById('grid-layer');
    const sizeSelect = document.getElementById('grid-size');
    const customInput = document.getElementById('grid-size-custom');
    const methodSelect = document.getElementById('grid-method');
    const nameInput = document.getElementById('grid-name');

    layerSelect.addEventListener('change', () => {
      this.currentLayerId = layerSelect.value || null;
      this.syncFields();
    });
    sizeSelect.addEventListener('change', () => this.syncFields());
    customInput.addEventListener('input', () => this.syncName());
    methodSelect.addEventListener('change', () => this.syncFields());
    nameInput.addEventListener('input', () => { nameInput.dataset.touched = '1'; });

    document.getElementById('grid-close').addEventListener('click', () => this.close());
    document.getElementById('grid-cancel').addEventListener('click', () => this.close());
    document.getElementById('grid-apply').addEventListener('click', () => this.apply());
  }

  apply() {
    if (!this.currentLayerId) {
      showAlert('먼저 포인트 레이어를 선택해주세요.');
      return;
    }

    const size = resolveCellSize(
      document.getElementById('grid-size').value,
      document.getElementById('grid-size-custom').value
    );
    if (size.error) {
      showAlert(size.error);
      return;
    }

    const method = document.getElementById('grid-method').value;
    const field = document.getElementById('grid-field').value;
    if ((method === 'sum' || method === 'avg') && !field) {
      showAlert('합계·평균으로 묶으려면 숫자 속성이 필요합니다.\n개수로 만들거나 다른 레이어를 골라 주세요.');
      return;
    }

    const includeEmpty = document.getElementById('grid-empty').checked;

    if (this.isMulti()) {
      this.applyToMany({ cellSize: size.cellSize, method, field, includeEmpty });
      return;
    }

    const name = (document.getElementById('grid-name').value || '').trim() || '격자';

    try {
      const points = this.points();
      const layerId = createGridLayer(name, points, {
        cellSize: size.cellSize, method, field, includeEmpty
      });
      const cells = layerManager.getLayer(layerId).source.getFeatures().length;

      showAlert(`격자를 만들었습니다.\n레이어: ${name}\n점 ${points.length.toLocaleString()}개 → ${cells.toLocaleString()}칸`);
      this.close();
    } catch (error) {
      showAlert('격자 만들기 실패: ' + error.message);
    }
  }

  /** 「선택한 레이어 N개 모두」: 레이어마다 따로 격자를 만든다 */
  async applyToMany(options) {
    const ids = this.multiIds.slice();
    const label = this.sizeLabel();
    this.close();
    const result = await runForEachLayer(ids, id => {
      const layerInfo = layerManager.getLayer(id);
      const points = this.pointsOf(id);
      if (points.length === 0) throw new Error('점 피처가 없습니다.');
      return createGridLayer(`${layerInfo.name} 격자 ${label}`, points, options);
    }, { getName: id => (layerManager.getLayer(id) || {}).name });
    await reportBatch(result, '격자 만들기');
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const gridPanel = new GridPanel();
