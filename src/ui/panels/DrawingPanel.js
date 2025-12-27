/**
 * DrawingPanel - 그리기 도구 패널
 */

import { drawingTool } from '../../tools/DrawingTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { eventBus } from '../../utils/EventBus.js';

class DrawingPanel {
  constructor() {
    this.modal = null;
    this.drawingActive = false;
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

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay drawing-modal active';
    this.modal.innerHTML = this.getModalHTML();
    document.body.appendChild(this.modal);

    this.bindEvents();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML() {
    const layers = layerManager.getAllLayers().filter(l => l.type !== 'heatmap');
    let layerOptions = '<option value="">새 레이어로 생성</option>';
    layers.forEach(l => {
      layerOptions += `<option value="${l.id}">${l.name}</option>`;
    });

    return `<div class="modal-content drawing-content">
      <div class="modal-header">
        <h3>도형 그리기</h3>
        <button class="modal-close" id="drawing-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>도형 유형</label>
          <div class="geometry-type-grid">
            <button class="geo-type-btn" data-type="Point" title="포인트">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5"/>
              </svg>
              <span>포인트</span>
            </button>
            <button class="geo-type-btn" data-type="LineString" title="라인">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 20 L12 8 L20 16"/>
              </svg>
              <span>라인</span>
            </button>
            <button class="geo-type-btn" data-type="Polygon" title="폴리곤">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="2">
                <polygon points="12,3 22,20 2,20"/>
              </svg>
              <span>폴리곤</span>
            </button>
            <button class="geo-type-btn" data-type="MultiPoint" title="멀티포인트">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="6" cy="12" r="3"/>
                <circle cx="12" cy="6" r="3"/>
                <circle cx="18" cy="14" r="3"/>
              </svg>
              <span>멀티포인트</span>
            </button>
            <button class="geo-type-btn" data-type="MultiLineString" title="멀티라인">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 8 L8 4 L14 10"/>
                <path d="M10 20 L16 14 L22 18"/>
              </svg>
              <span>멀티라인</span>
            </button>
            <button class="geo-type-btn" data-type="MultiPolygon" title="멀티폴리곤">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="2">
                <polygon points="4,4 12,4 12,12 4,12"/>
                <polygon points="12,12 20,12 20,20 12,20"/>
              </svg>
              <span>멀티폴리곤</span>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="drawing-target-layer">대상 레이어</label>
          <select id="drawing-target-layer">${layerOptions}</select>
        </div>
        <div class="drawing-status" id="drawing-status" style="display:none">
          <div class="status-info">
            <span id="drawing-type-label">그리기 중...</span>
            <span id="drawing-count"></span>
          </div>
          <div class="status-actions">
            <button class="btn btn-small btn-secondary" id="drawing-undo">실행취소</button>
            <button class="btn btn-small btn-primary" id="drawing-finish">완료</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="drawing-cancel">닫기</button>
      </div>
    </div>`;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('drawing-close');
    const cancelBtn = document.getElementById('drawing-cancel');
    const undoBtn = document.getElementById('drawing-undo');
    const finishBtn = document.getElementById('drawing-finish');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    // 도형 유형 버튼
    this.modal.querySelectorAll('.geo-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.startDrawing(type);
      });
    });

    // 실행취소
    undoBtn.addEventListener('click', () => {
      drawingTool.undoLast();
    });

    // 완료
    finishBtn.addEventListener('click', () => {
      this.finishDrawing();
    });

    // 그리기 이벤트 리스너
    this.onFeatureAdded = (data) => {
      document.getElementById('drawing-count').textContent = `(${data.count}개)`;
    };

    this.onFeatureRemoved = (data) => {
      document.getElementById('drawing-count').textContent = data.count > 0 ? `(${data.count}개)` : '';
    };

    this.onDrawFinished = () => {
      this.hideDrawingStatus();
      this.drawingActive = false;
    };

    eventBus.on('draw:feature-added', this.onFeatureAdded);
    eventBus.on('draw:feature-removed', this.onFeatureRemoved);
    eventBus.on('draw:finished', this.onDrawFinished);
  }

  /**
   * 그리기 시작
   */
  startDrawing(type) {
    const targetLayer = document.getElementById('drawing-target-layer').value;

    // 버튼 활성화 표시
    this.modal.querySelectorAll('.geo-type-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.type === type) {
        btn.classList.add('active');
      }
    });

    // 그리기 시작
    drawingTool.startDrawing(type, targetLayer || null);
    this.drawingActive = true;

    // 상태 표시
    const isMulti = type.startsWith('Multi');
    if (isMulti) {
      this.showDrawingStatus(type);
    }
  }

  /**
   * 그리기 상태 표시
   */
  showDrawingStatus(type) {
    const statusEl = document.getElementById('drawing-status');
    const labelEl = document.getElementById('drawing-type-label');
    const countEl = document.getElementById('drawing-count');

    const typeNames = {
      'MultiPoint': '멀티포인트',
      'MultiLineString': '멀티라인',
      'MultiPolygon': '멀티폴리곤'
    };

    labelEl.textContent = `${typeNames[type] || type} 그리기 중`;
    countEl.textContent = '';
    statusEl.style.display = 'block';
  }

  /**
   * 그리기 상태 숨기기
   */
  hideDrawingStatus() {
    const statusEl = document.getElementById('drawing-status');
    if (statusEl) {
      statusEl.style.display = 'none';
    }

    this.modal.querySelectorAll('.geo-type-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  /**
   * 그리기 완료
   */
  finishDrawing() {
    const layerId = drawingTool.finishDrawing();
    if (layerId) {
      alert('도형이 추가되었습니다.');
    }
  }

  /**
   * 모달 닫기
   */
  close() {
    if (this.drawingActive) {
      drawingTool.stopDrawing();
      this.drawingActive = false;
    }

    // 이벤트 리스너 제거
    if (this.onFeatureAdded) {
      eventBus.off('draw:feature-added', this.onFeatureAdded);
    }
    if (this.onFeatureRemoved) {
      eventBus.off('draw:feature-removed', this.onFeatureRemoved);
    }
    if (this.onDrawFinished) {
      eventBus.off('draw:finished', this.onDrawFinished);
    }

    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const drawingPanel = new DrawingPanel();
