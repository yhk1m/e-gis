/**
 * LabelPanel - 라벨 설정 패널
 */

import { labelTool } from '../../tools/LabelTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { eventBus, Events } from '../../utils/EventBus.js';

class LabelPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
  }

  /**
   * 라벨 설정 패널 열기
   */
  open(layerId = null) {
    // 레이어 ID가 없으면 현재 선택된 레이어 사용
    if (!layerId) {
      const layers = layerManager.getAllLayers();
      if (layers.length === 0) {
        alert('레이어가 없습니다. 먼저 레이어를 추가해주세요.');
        return;
      }
      layerId = layers[0].id;
    }

    this.currentLayerId = layerId;
    this.createModal();
    this.show();
  }

  /**
   * 모달 생성
   */
  createModal() {
    // 기존 모달 제거
    if (this.modal) {
      this.modal.remove();
    }

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay';
    this.modal.innerHTML = `
      <div class="modal label-modal">
        <div class="modal-header">
          <h3>라벨 설정</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>레이어 선택</label>
            <select id="label-layer-select" class="form-control"></select>
          </div>
          <div class="form-group">
            <label>라벨 필드</label>
            <select id="label-field-select" class="form-control">
              <option value="">라벨 없음</option>
            </select>
          </div>
          <div class="form-group">
            <label>글자 크기</label>
            <input type="range" id="label-font-size" min="8" max="24" value="12" class="form-range">
            <span id="label-font-size-value">12px</span>
          </div>
          <div class="form-group">
            <label>글자 색상</label>
            <input type="color" id="label-font-color" value="#333333" class="form-control-color">
          </div>
          <div class="form-group">
            <label>테두리 색상</label>
            <input type="color" id="label-halo-color" value="#ffffff" class="form-control-color">
          </div>
          <div class="form-group">
            <label>테두리 두께</label>
            <input type="range" id="label-halo-width" min="0" max="5" value="2" class="form-range">
            <span id="label-halo-width-value">2px</span>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="label-remove-btn">라벨 제거</button>
          <button class="btn btn-info" id="label-edit-position-btn">위치 편집</button>
          <button class="btn btn-primary" id="label-apply-btn">적용</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
    this.populateLayers();
    this.loadCurrentConfig();
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 닫기 버튼
    this.modal.querySelector('.modal-close').addEventListener('click', () => this.close());

    // 레이어 선택 변경
    this.modal.querySelector('#label-layer-select').addEventListener('change', (e) => {
      this.currentLayerId = e.target.value;
      this.populateFields();
      this.loadCurrentConfig();
    });

    // 글자 크기 슬라이더
    const fontSizeInput = this.modal.querySelector('#label-font-size');
    fontSizeInput.addEventListener('input', (e) => {
      this.modal.querySelector('#label-font-size-value').textContent = e.target.value + 'px';
    });

    // 테두리 두께 슬라이더
    const haloWidthInput = this.modal.querySelector('#label-halo-width');
    haloWidthInput.addEventListener('input', (e) => {
      this.modal.querySelector('#label-halo-width-value').textContent = e.target.value + 'px';
    });

    // 적용 버튼
    this.modal.querySelector('#label-apply-btn').addEventListener('click', () => this.applyLabel());

    // 라벨 제거 버튼
    this.modal.querySelector('#label-remove-btn').addEventListener('click', () => this.removeLabel());

    // 위치 편집 버튼
    this.modal.querySelector('#label-edit-position-btn').addEventListener('click', () => this.toggleEditMode());
  }

  /**
   * 라벨 위치 편집 모드 토글
   */
  toggleEditMode() {
    if (!labelTool.hasLabel(this.currentLayerId)) {
      alert('먼저 라벨을 적용한 후 위치를 편집할 수 있습니다.');
      return;
    }

    if (labelTool.isEditMode()) {
      this.finishEditMode();
    } else {
      this.startEditModeUI();
    }
  }

  /**
   * 편집 모드 진입 - 모달이 지도를 덮어 드래그를 막으므로 모달을 숨기고 플로팅 바를 띄운다
   */
  startEditModeUI() {
    labelTool.startEditMode(this.currentLayerId);
    if (this.modal) this.modal.classList.remove('active'); // 모달 숨김 → 지도 조작 가능
    this.showEditBar();
  }

  /**
   * 편집 모드 종료 - 오프셋을 라벨에 반영하고 모달을 다시 표시
   */
  finishEditMode() {
    labelTool.stopEditMode();
    this.removeEditBar();
    if (this.modal) {
      this.modal.classList.add('active');
      const btn = this.modal.querySelector('#label-edit-position-btn');
      if (btn) {
        btn.textContent = '위치 편집';
        btn.classList.remove('active');
      }
    }
  }

  /**
   * 지도 위 플로팅 편집 바 (안내 + 위치 초기화 + 편집 완료)
   */
  showEditBar() {
    this.removeEditBar();
    const bar = document.createElement('div');
    bar.id = 'label-edit-bar';
    bar.className = 'label-edit-bar';
    bar.innerHTML = `
      <span class="label-edit-bar-hint">✋ 각 라벨을 드래그해 위치를 옮기세요</span>
      <button type="button" class="btn btn-sm" id="label-edit-reset">위치 초기화</button>
      <button type="button" class="btn btn-sm btn-primary" id="label-edit-done">편집 완료</button>
    `;
    document.body.appendChild(bar);
    this.editBar = bar;

    bar.querySelector('#label-edit-done').addEventListener('click', () => this.finishEditMode());
    bar.querySelector('#label-edit-reset').addEventListener('click', () => {
      // 오프셋 초기화 후 편집 포인트를 다시 만들어 반영
      labelTool.stopEditMode();
      labelTool.resetLabelOffsets(this.currentLayerId);
      labelTool.startEditMode(this.currentLayerId);
    });
  }

  removeEditBar() {
    if (this.editBar) {
      this.editBar.remove();
      this.editBar = null;
    }
    const existing = document.getElementById('label-edit-bar');
    if (existing) existing.remove();
  }

  /**
   * 레이어 목록 채우기
   */
  populateLayers() {
    const select = this.modal.querySelector('#label-layer-select');
    const layers = layerManager.getAllLayers();

    select.innerHTML = layers.map(layer =>
      `<option value="${layer.id}" ${layer.id === this.currentLayerId ? 'selected' : ''}>${layer.name}</option>`
    ).join('');

    this.populateFields();
  }

  /**
   * 필드 목록 채우기
   */
  populateFields() {
    const select = this.modal.querySelector('#label-field-select');
    const fields = labelTool.getLayerFields(this.currentLayerId);

    select.innerHTML = '<option value="">라벨 없음</option>' +
      fields.map(field => `<option value="${field}">${field}</option>`).join('');
  }

  /**
   * 현재 라벨 설정 로드
   */
  loadCurrentConfig() {
    const config = labelTool.getLabelConfig(this.currentLayerId);

    if (config) {
      this.modal.querySelector('#label-field-select').value = config.field || '';
      this.modal.querySelector('#label-font-size').value = config.fontSize || 12;
      this.modal.querySelector('#label-font-size-value').textContent = (config.fontSize || 12) + 'px';
      this.modal.querySelector('#label-font-color').value = config.fontColor || '#333333';
      this.modal.querySelector('#label-halo-color').value = config.haloColor || '#ffffff';
      this.modal.querySelector('#label-halo-width').value = config.haloWidth || 2;
      this.modal.querySelector('#label-halo-width-value').textContent = (config.haloWidth || 2) + 'px';
    } else {
      this.modal.querySelector('#label-field-select').value = '';
      this.modal.querySelector('#label-font-size').value = 12;
      this.modal.querySelector('#label-font-size-value').textContent = '12px';
      this.modal.querySelector('#label-font-color').value = '#333333';
      this.modal.querySelector('#label-halo-color').value = '#ffffff';
      this.modal.querySelector('#label-halo-width').value = 2;
      this.modal.querySelector('#label-halo-width-value').textContent = '2px';
    }
  }

  /**
   * 라벨 적용
   */
  applyLabel() {
    const field = this.modal.querySelector('#label-field-select').value;
    const fontSize = parseInt(this.modal.querySelector('#label-font-size').value);
    const fontColor = this.modal.querySelector('#label-font-color').value;
    const haloColor = this.modal.querySelector('#label-halo-color').value;
    const haloWidth = parseInt(this.modal.querySelector('#label-halo-width').value);

    labelTool.setLabel(this.currentLayerId, {
      field,
      fontSize,
      fontColor,
      haloColor,
      haloWidth
    });

    this.close();
  }

  /**
   * 라벨 제거
   */
  removeLabel() {
    labelTool.removeLabel(this.currentLayerId);
    this.close();
  }

  /**
   * 모달 표시
   */
  show() {
    this.modal.classList.add('active');
  }

  /**
   * 모달 닫기
   */
  close() {
    // 편집 모드 중 닫으면 편집 상태·플로팅 바 정리
    if (labelTool.isEditMode()) {
      labelTool.stopEditMode();
    }
    this.removeEditBar();
    if (this.modal) {
      this.modal.classList.remove('active');
      setTimeout(() => {
        if (this.modal) this.modal.remove();
        this.modal = null;
      }, 200);
    }
  }
}

export const labelPanel = new LabelPanel();
