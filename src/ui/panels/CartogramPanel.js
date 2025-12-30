/**
 * CartogramPanel - 카토그램 생성 패널
 */

import { layerManager } from '../../core/LayerManager.js';
import { cartogramTool } from '../../tools/CartogramTool.js';
import { eventBus, Events } from '../../utils/EventBus.js';

class CartogramPanel {
  constructor() {
    this.modalElement = null;
    this.selectedLayerId = null;
    this.selectedAttribute = null;
  }

  /**
   * 패널 표시
   */
  show() {
    const layers = layerManager.getAllLayers().filter(l =>
      l.type === 'vector' && l.geometryType !== 'Point'
    );

    if (layers.length === 0) {
      alert('카토그램을 생성하려면 폴리곤 레이어가 필요합니다.');
      return;
    }

    this.createModal(layers);
  }

  /**
   * 모달 생성
   */
  createModal(layers) {
    this.hide();

    const layerOptions = layers.map(l =>
      `<option value="${l.id}">${l.name}</option>`
    ).join('');

    const modalHtml = `
      <div class="modal-overlay active" id="cartogram-modal">
        <div class="modal" style="width: 420px;">
          <div class="modal-header">
            <h3>카토그램 생성</h3>
            <button class="modal-close" id="cartogram-close">&times;</button>
          </div>
          <div class="modal-body" style="padding: var(--spacing-lg);">
            <div class="form-group">
              <label class="form-label">레이어 선택</label>
              <select class="form-select" id="cartogram-layer">
                <option value="">-- 레이어 선택 --</option>
                ${layerOptions}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">속성 선택 (크기 결정)</label>
              <select class="form-select" id="cartogram-attribute" disabled>
                <option value="">-- 먼저 레이어를 선택하세요 --</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">카토그램 유형</label>
              <div class="cartogram-type-options">
                <label class="cartogram-type-option">
                  <input type="radio" name="cartogram-type" value="dorling" checked>
                  <div class="type-content">
                    <div class="type-icon">
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="12" cy="12" r="8" fill="#4292c6" stroke="#333" stroke-width="1"/>
                        <circle cx="28" cy="15" r="12" fill="#2171b5" stroke="#333" stroke-width="1"/>
                        <circle cx="18" cy="30" r="6" fill="#6baed6" stroke="#333" stroke-width="1"/>
                      </svg>
                    </div>
                    <div class="type-info">
                      <strong>Dorling (원형)</strong>
                      <small>지역을 원으로 대체, 값에 따라 원 크기 조절</small>
                    </div>
                  </div>
                </label>
                <label class="cartogram-type-option">
                  <input type="radio" name="cartogram-type" value="noncontiguous">
                  <div class="type-content">
                    <div class="type-icon">
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <polygon points="5,20 15,5 25,8 20,20 25,35 10,30" fill="#4292c6" stroke="#333" stroke-width="1" transform="scale(0.6) translate(8,12)"/>
                        <polygon points="22,8 35,5 38,18 30,25 25,15" fill="#2171b5" stroke="#333" stroke-width="1" transform="scale(1.2) translate(2,2)"/>
                      </svg>
                    </div>
                    <div class="type-info">
                      <strong>Non-contiguous (비연속)</strong>
                      <small>원래 모양 유지, 값에 따라 크기만 조절</small>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">색상 스키마</label>
              <div class="color-scheme-options" id="color-schemes">
                <label class="color-scheme-option">
                  <input type="radio" name="color-scheme" value="blues" checked>
                  <div class="color-preview blues"></div>
                </label>
                <label class="color-scheme-option">
                  <input type="radio" name="color-scheme" value="reds">
                  <div class="color-preview reds"></div>
                </label>
                <label class="color-scheme-option">
                  <input type="radio" name="color-scheme" value="greens">
                  <div class="color-preview greens"></div>
                </label>
                <label class="color-scheme-option">
                  <input type="radio" name="color-scheme" value="oranges">
                  <div class="color-preview oranges"></div>
                </label>
                <label class="color-scheme-option">
                  <input type="radio" name="color-scheme" value="purples">
                  <div class="color-preview purples"></div>
                </label>
                <label class="color-scheme-option">
                  <input type="radio" name="color-scheme" value="spectral">
                  <div class="color-preview spectral"></div>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="cartogram-labels">
                <span>라벨 표시</span>
              </label>
            </div>
          </div>
          <div class="modal-footer" style="padding: var(--spacing-md) var(--spacing-lg); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: var(--spacing-sm);">
            <button class="btn btn-secondary btn-sm" id="cartogram-cancel">취소</button>
            <button class="btn btn-primary btn-sm" id="cartogram-create" disabled>생성</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modalElement = document.getElementById('cartogram-modal');

    this.bindEvents();
    this.addStyles();
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('cartogram-close');
    const cancelBtn = document.getElementById('cartogram-cancel');
    const createBtn = document.getElementById('cartogram-create');
    const layerSelect = document.getElementById('cartogram-layer');
    const attributeSelect = document.getElementById('cartogram-attribute');

    closeBtn.addEventListener('click', () => this.hide());
    cancelBtn.addEventListener('click', () => this.hide());

    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) this.hide();
    });

    // 레이어 선택 시 속성 목록 업데이트
    layerSelect.addEventListener('change', (e) => {
      this.selectedLayerId = e.target.value;
      this.updateAttributeList();
    });

    // 속성 선택 시 생성 버튼 활성화
    attributeSelect.addEventListener('change', (e) => {
      this.selectedAttribute = e.target.value;
      createBtn.disabled = !this.selectedAttribute;
    });

    // 카토그램 생성
    createBtn.addEventListener('click', () => this.createCartogram());
  }

  /**
   * 속성 목록 업데이트
   */
  updateAttributeList() {
    const attributeSelect = document.getElementById('cartogram-attribute');
    const createBtn = document.getElementById('cartogram-create');

    if (!this.selectedLayerId) {
      attributeSelect.innerHTML = '<option value="">-- 먼저 레이어를 선택하세요 --</option>';
      attributeSelect.disabled = true;
      createBtn.disabled = true;
      return;
    }

    const attributes = cartogramTool.getNumericAttributes(this.selectedLayerId);

    if (attributes.length === 0) {
      attributeSelect.innerHTML = '<option value="">숫자 속성이 없습니다</option>';
      attributeSelect.disabled = true;
      createBtn.disabled = true;
      return;
    }

    const options = attributes.map(attr =>
      `<option value="${attr}">${attr}</option>`
    );

    attributeSelect.innerHTML = '<option value="">-- 속성 선택 --</option>' + options.join('');
    attributeSelect.disabled = false;
    this.selectedAttribute = null;
    createBtn.disabled = true;
  }

  /**
   * 카토그램 생성
   */
  createCartogram() {
    if (!this.selectedLayerId || !this.selectedAttribute) {
      alert('레이어와 속성을 선택해주세요.');
      return;
    }

    const cartogramType = document.querySelector('input[name="cartogram-type"]:checked').value;
    const colorScheme = document.querySelector('input[name="color-scheme"]:checked').value;
    const showLabels = document.getElementById('cartogram-labels').checked;

    try {
      let newLayerId;

      if (cartogramType === 'dorling') {
        newLayerId = cartogramTool.createDorlingCartogram(
          this.selectedLayerId,
          this.selectedAttribute,
          { colorScheme, showLabels }
        );
      } else {
        newLayerId = cartogramTool.createNonContiguousCartogram(
          this.selectedLayerId,
          this.selectedAttribute,
          { colorScheme, showLabels }
        );
      }

      this.hide();

      // 레이어 삭제 시 범례도 제거
      const removeHandler = (data) => {
        if (data && data.layerId === newLayerId) {
          cartogramTool.removeLegend(newLayerId);
          eventBus.off(Events.LAYER_REMOVED, removeHandler);
        }
      };
      eventBus.on(Events.LAYER_REMOVED, removeHandler);

    } catch (error) {
      alert('카토그램 생성 실패: ' + error.message);
    }
  }

  /**
   * 스타일 추가
   */
  addStyles() {
    if (document.getElementById('cartogram-panel-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'cartogram-panel-styles';
    styles.textContent = `
      .cartogram-type-options {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .cartogram-type-option {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm);
        border: 2px solid var(--border-color);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .cartogram-type-option:hover {
        background: var(--bg-hover);
      }

      .cartogram-type-option input[type="radio"] {
        margin-top: 12px;
      }

      .cartogram-type-option input[type="radio"]:checked + .type-content {
        opacity: 1;
      }

      .cartogram-type-option input[type="radio"]:checked ~ .type-content .type-info strong {
        color: var(--color-primary);
      }

      .cartogram-type-option:has(input:checked) {
        border-color: var(--color-primary);
        background: var(--bg-selected);
      }

      .type-content {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        opacity: 0.7;
      }

      .type-icon {
        flex-shrink: 0;
      }

      .type-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .type-info strong {
        font-size: var(--font-size-sm);
      }

      .type-info small {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
      }

      .color-scheme-options {
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }

      .color-scheme-option {
        cursor: pointer;
      }

      .color-scheme-option input[type="radio"] {
        display: none;
      }

      .color-scheme-option .color-preview {
        width: 50px;
        height: 20px;
        border-radius: var(--radius-sm);
        border: 2px solid transparent;
        transition: border-color var(--transition-fast);
      }

      .color-scheme-option input[type="radio"]:checked + .color-preview {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--color-primary-light);
      }

      .color-preview.blues {
        background: linear-gradient(to right, #f7fbff, #deebf7, #9ecae1, #4292c6, #084594);
      }

      .color-preview.reds {
        background: linear-gradient(to right, #fff5f0, #fee0d2, #fc9272, #ef3b2c, #99000d);
      }

      .color-preview.greens {
        background: linear-gradient(to right, #f7fcf5, #e5f5e0, #a1d99b, #41ab5d, #005a32);
      }

      .color-preview.oranges {
        background: linear-gradient(to right, #fff5eb, #fee6ce, #fdae6b, #f16913, #8c2d04);
      }

      .color-preview.purples {
        background: linear-gradient(to right, #fcfbfd, #efedf5, #bcbddc, #807dba, #4a1486);
      }

      .color-preview.spectral {
        background: linear-gradient(to right, #d53e4f, #fdae61, #e6f598, #66c2a5, #3288bd);
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * 모달 숨기기
   */
  hide() {
    if (this.modalElement) {
      this.modalElement.classList.remove('active');
      setTimeout(() => {
        this.modalElement?.remove();
        this.modalElement = null;
      }, 200);
    }
  }
}

export const cartogramPanel = new CartogramPanel();
