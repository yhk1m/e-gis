// © 2026 김용현
/**
 * GridPanel - 격자 만들기 패널
 *
 * 포인트 레이어를 정사각 격자로 묶어 칸마다 집계한 폴리곤 레이어를 만든다.
 * 공공데이터 화면의 「격자 집계」와 같은 산출물이다(같은 gridLayer 를 쓴다) —
 * 이미 지도에 올라와 있는 포인트 레이어에도 쓸 수 있게 밖으로 낸 것이다.
 */

import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId, isVectorLayer } from '../../utils/layerSelect.js';
import { createGridLayer } from '../../tools/gridLayer.js';
import {
  featuresToPoints, resolveCellSize, numericFields, CELL_SIZE_OPTIONS
} from '../../tools/gridPoints.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

class GridPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
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
      alert('격자로 묶을 수 있는 레이어가 없습니다.\n(점 피처가 있는 벡터 레이어가 필요합니다)');
      return;
    }

    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || null;
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
    const layerOptions = buildLayerOptions(layers, { selectedId: this.currentLayerId });
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

  /** 지금 고른 레이어의 점들 */
  points() {
    const layerInfo = this.currentLayerId ? layerManager.getLayer(this.currentLayerId) : null;
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
      const fields = numericFields(this.points());
      fieldSelect.innerHTML = fields.length
        ? fields.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')
        : '<option value="">(숫자 속성 없음)</option>';
    }

    this.syncName();
  }

  /** 레이어 이름 기본값 — 사용자가 손대면 건드리지 않는다 */
  syncName() {
    const nameInput = document.getElementById('grid-name');
    if (nameInput.dataset.touched === '1') return;

    const layerInfo = this.currentLayerId ? layerManager.getLayer(this.currentLayerId) : null;
    const sizeSelect = document.getElementById('grid-size');
    const label = sizeSelect.value === ''
      ? `${document.getElementById('grid-size-custom').value}m`
      : (CELL_SIZE_OPTIONS.find(o => o.value === sizeSelect.value) || {}).label || '';

    nameInput.value = layerInfo ? `${layerInfo.name} 격자 ${label}` : `격자 ${label}`;
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
      alert('먼저 포인트 레이어를 선택해주세요.');
      return;
    }

    const size = resolveCellSize(
      document.getElementById('grid-size').value,
      document.getElementById('grid-size-custom').value
    );
    if (size.error) {
      alert(size.error);
      return;
    }

    const method = document.getElementById('grid-method').value;
    const field = document.getElementById('grid-field').value;
    if ((method === 'sum' || method === 'avg') && !field) {
      alert('합계·평균으로 묶으려면 숫자 속성이 필요합니다.\n개수로 만들거나 다른 레이어를 골라 주세요.');
      return;
    }

    const name = (document.getElementById('grid-name').value || '').trim() || '격자';

    try {
      const points = this.points();
      const layerId = createGridLayer(name, points, { cellSize: size.cellSize, method, field });
      const cells = layerManager.getLayer(layerId).source.getFeatures().length;

      alert(`격자를 만들었습니다.\n레이어: ${name}\n점 ${points.length.toLocaleString()}개 → ${cells.toLocaleString()}칸`);
      this.close();
    } catch (error) {
      alert('격자 만들기 실패: ' + error.message);
    }
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const gridPanel = new GridPanel();
