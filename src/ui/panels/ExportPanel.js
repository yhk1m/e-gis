/**
 * ExportPanel - 지도 내보내기 설정 패널 (확장 버전)
 * 제목, 축척, 방위표, 범례, 텍스트 박스 기능 포함
 */

import { exportTool } from '../../tools/ExportTool.js';
import { mapManager } from '../../core/MapManager.js';
import { layerManager } from '../../core/LayerManager.js';

class ExportPanel {
  constructor() {
    this.modal = null;
    this.overlayElements = {
      title: { enabled: false, text: '지도 제목', x: 50, y: 30, fontSize: 24 },
      scale: { enabled: true, x: 20, y: 'bottom-20' },
      compass: { enabled: true, x: 'right-60', y: 60, size: 50 },
      legend: { enabled: false, x: 'right-20', y: 100 },
      textBoxes: []
    };
  }

  /**
   * 내보내기 패널 열기
   */
  show() {
    this.render();
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    const formats = exportTool.getFormats();

    this.modal = document.createElement('div');
    this.modal.className = 'export-modal';
    this.modal.innerHTML = this.getModalHTML(formats);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.addStyles();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(formats) {
    const formatOptions = formats.map(f =>
      '<option value="' + f.value + '">' + f.label + '</option>'
    ).join('');

    // 레이어 목록 (범례용)
    const layers = layerManager.getAllLayers().filter(l => l.type === 'vector');
    const layerCheckboxes = layers.map(l =>
      `<label class="legend-layer-item">
        <input type="checkbox" value="${l.id}" checked>
        <span class="layer-color" style="background: ${l.color || l.fillColor || '#4292c6'}"></span>
        <span>${l.name}</span>
      </label>`
    ).join('') || '<p class="no-layers">표시할 레이어가 없습니다</p>';

    return `
      <div class="export-content export-content-large">
        <div class="export-header">
          <h3>지도 내보내기</h3>
          <button class="export-close" id="export-close">&times;</button>
        </div>
        <div class="export-body-grid">
          <!-- 왼쪽: 옵션 -->
          <div class="export-options">
            <div class="export-section">
              <h4>기본 설정</h4>
              <div class="export-form-group">
                <label for="export-filename">파일 이름</label>
                <input type="text" id="export-filename" value="e-GIS_map" placeholder="파일 이름">
              </div>
              <div class="export-form-group">
                <label for="export-format">파일 형식</label>
                <select id="export-format">${formatOptions}</select>
              </div>
              <div class="export-form-group" id="quality-group" style="display:none;">
                <label for="export-quality">이미지 품질</label>
                <input type="range" id="export-quality" min="0.5" max="1" step="0.1" value="0.92">
                <span id="export-quality-value">92%</span>
              </div>
              <div class="export-form-group">
                <label for="export-scale">해상도 배율</label>
                <select id="export-scale">
                  <option value="1">1x (기본)</option>
                  <option value="2" selected>2x (고해상도)</option>
                  <option value="3">3x (초고해상도)</option>
                </select>
              </div>
            </div>

            <div class="export-section">
              <h4>지도 요소</h4>

              <!-- 제목 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-title">
                  <span>제목</span>
                </label>
                <div class="element-options" id="title-options" style="display:none;">
                  <input type="text" id="title-text" value="지도 제목" placeholder="제목 입력">
                  <div class="size-row">
                    <label>크기</label>
                    <input type="number" id="title-size" value="24" min="12" max="72">
                  </div>
                </div>
              </div>

              <!-- 축척 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-scale-bar" checked>
                  <span>축척 바</span>
                </label>
              </div>

              <!-- 방위표 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-compass" checked>
                  <span>방위표</span>
                </label>
                <div class="element-options" id="compass-options">
                  <div class="size-row">
                    <label>크기</label>
                    <input type="number" id="compass-size" value="50" min="30" max="100">
                  </div>
                </div>
              </div>

              <!-- 범례 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-legend">
                  <span>범례</span>
                </label>
                <div class="element-options legend-options" id="legend-options" style="display:none;">
                  <div class="legend-layers">
                    ${layerCheckboxes}
                  </div>
                </div>
              </div>

              <!-- 텍스트 박스 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-textbox">
                  <span>텍스트 박스</span>
                </label>
                <div class="element-options" id="textbox-options" style="display:none;">
                  <textarea id="textbox-content" rows="3" placeholder="추가할 텍스트 입력"></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- 오른쪽: 미리보기 -->
          <div class="export-preview-container">
            <h4>미리보기</h4>
            <div class="export-preview" id="export-preview">
              <div class="preview-placeholder">미리보기를 생성하려면 '미리보기' 버튼을 클릭하세요</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="refresh-preview">미리보기 새로고침</button>
          </div>
        </div>
        <div class="export-footer">
          <button class="btn btn-secondary" id="export-cancel">취소</button>
          <button class="btn btn-primary" id="export-apply">내보내기</button>
        </div>
      </div>
    `;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('export-close');
    const cancelBtn = document.getElementById('export-cancel');
    const applyBtn = document.getElementById('export-apply');
    const formatSelect = document.getElementById('export-format');
    const qualityInput = document.getElementById('export-quality');
    const qualityValue = document.getElementById('export-quality-value');
    const qualityGroup = document.getElementById('quality-group');
    const refreshBtn = document.getElementById('refresh-preview');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    // 포맷 변경 시 품질 옵션 표시/숨기기
    formatSelect.addEventListener('change', (e) => {
      qualityGroup.style.display = e.target.value === 'jpg' ? 'block' : 'none';
    });

    // 품질 슬라이더
    qualityInput.addEventListener('input', (e) => {
      qualityValue.textContent = Math.round(e.target.value * 100) + '%';
    });

    // 요소 토글
    const toggles = [
      { id: 'opt-title', options: 'title-options' },
      { id: 'opt-legend', options: 'legend-options' },
      { id: 'opt-textbox', options: 'textbox-options' }
    ];

    toggles.forEach(({ id, options }) => {
      const checkbox = document.getElementById(id);
      const optionsEl = document.getElementById(options);
      checkbox.addEventListener('change', () => {
        optionsEl.style.display = checkbox.checked ? 'block' : 'none';
      });
    });

    // 미리보기 새로고침
    refreshBtn.addEventListener('click', () => this.updatePreview());

    // 내보내기 버튼
    applyBtn.addEventListener('click', () => this.export());

    // 초기 미리보기 생성
    setTimeout(() => this.updatePreview(), 100);
  }

  /**
   * 미리보기 업데이트
   */
  async updatePreview() {
    const preview = document.getElementById('export-preview');
    preview.innerHTML = '<div class="preview-loading">생성 중...</div>';

    try {
      const mapElement = document.getElementById('map');
      const map = mapManager.getMap();

      // 간단한 미리보기용 캔버스 생성
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 미리보기 크기
      const previewWidth = 300;
      const previewHeight = 200;
      canvas.width = previewWidth;
      canvas.height = previewHeight;

      // 배경
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(0, 0, previewWidth, previewHeight);

      // 지도 영역 표시
      ctx.fillStyle = '#c5d8e8';
      ctx.fillRect(10, 10, previewWidth - 20, previewHeight - 20);

      // 선택된 요소들 그리기
      this.drawPreviewElements(ctx, previewWidth, previewHeight);

      preview.innerHTML = '';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      preview.appendChild(canvas);
    } catch (error) {
      preview.innerHTML = '<div class="preview-error">미리보기 생성 실패</div>';
    }
  }

  /**
   * 미리보기에 요소 그리기
   */
  drawPreviewElements(ctx, width, height) {
    const showTitle = document.getElementById('opt-title').checked;
    const showScale = document.getElementById('opt-scale-bar').checked;
    const showCompass = document.getElementById('opt-compass').checked;
    const showLegend = document.getElementById('opt-legend').checked;
    const showTextbox = document.getElementById('opt-textbox').checked;

    // 제목
    if (showTitle) {
      const titleText = document.getElementById('title-text').value || '지도 제목';
      const titleSize = parseInt(document.getElementById('title-size').value) || 24;
      ctx.fillStyle = '#333';
      ctx.font = `bold ${titleSize / 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(titleText, width / 2, 25);
    }

    // 축척 바
    if (showScale) {
      ctx.fillStyle = '#333';
      ctx.fillRect(15, height - 25, 60, 4);
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('축척', 15, height - 30);
    }

    // 방위표
    if (showCompass) {
      const cx = width - 30;
      const cy = 40;
      const size = 15;

      ctx.save();
      ctx.translate(cx, cy);

      // 원
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.strokeStyle = '#333';
      ctx.stroke();

      // N 표시
      ctx.fillStyle = '#d00';
      ctx.beginPath();
      ctx.moveTo(0, -size + 3);
      ctx.lineTo(-4, 3);
      ctx.lineTo(4, 3);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.fillText('N', 0, -size - 3);

      ctx.restore();
    }

    // 범례
    if (showLegend) {
      const legendX = width - 70;
      const legendY = 70;

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(legendX, legendY, 60, 50);
      ctx.strokeStyle = '#999';
      ctx.strokeRect(legendX, legendY, 60, 50);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('범례', legendX + 5, legendY + 12);

      ctx.fillStyle = '#4292c6';
      ctx.fillRect(legendX + 5, legendY + 20, 10, 10);
      ctx.fillStyle = '#333';
      ctx.font = '7px sans-serif';
      ctx.fillText('레이어', legendX + 18, legendY + 28);
    }

    // 텍스트 박스
    if (showTextbox) {
      const textContent = document.getElementById('textbox-content').value || '텍스트';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(15, height - 60, 80, 25);
      ctx.strokeStyle = '#999';
      ctx.strokeRect(15, height - 60, 80, 25);
      ctx.fillStyle = '#333';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(textContent.substring(0, 15), 20, height - 45);
    }
  }

  /**
   * 내보내기 실행
   */
  async export() {
    const filename = document.getElementById('export-filename').value.trim() || 'e-GIS_map';
    const format = document.getElementById('export-format').value;
    const quality = parseFloat(document.getElementById('export-quality').value);
    const scale = parseInt(document.getElementById('export-scale').value);

    const showTitle = document.getElementById('opt-title').checked;
    const showScale = document.getElementById('opt-scale-bar').checked;
    const showCompass = document.getElementById('opt-compass').checked;
    const showLegend = document.getElementById('opt-legend').checked;
    const showTextbox = document.getElementById('opt-textbox').checked;

    const overlayOptions = {
      title: showTitle ? {
        text: document.getElementById('title-text').value,
        fontSize: parseInt(document.getElementById('title-size').value)
      } : null,
      scaleBar: showScale,
      compass: showCompass ? {
        size: parseInt(document.getElementById('compass-size').value)
      } : null,
      legend: showLegend ? this.getLegendConfig() : null,
      textBox: showTextbox ? {
        text: document.getElementById('textbox-content').value
      } : null
    };

    const applyBtn = document.getElementById('export-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '내보내는 중...';

    try {
      await exportTool.exportMapWithOverlays({
        filename,
        format,
        quality,
        scale,
        overlays: overlayOptions
      });

      this.close();
    } catch (error) {
      alert('내보내기 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '내보내기';
    }
  }

  /**
   * 범례 설정 가져오기
   */
  getLegendConfig() {
    const checkboxes = document.querySelectorAll('#legend-options input[type="checkbox"]:checked');
    const layers = [];

    checkboxes.forEach(cb => {
      const layer = layerManager.getLayer(cb.value);
      if (layer) {
        layers.push({
          id: layer.id,
          name: layer.name,
          color: layer.color || layer.fillColor || '#4292c6'
        });
      }
    });

    return { layers };
  }

  /**
   * 스타일 추가
   */
  addStyles() {
    if (document.getElementById('export-panel-styles-v2')) return;

    const styles = document.createElement('style');
    styles.id = 'export-panel-styles-v2';
    styles.textContent = `
      .export-content-large {
        width: 700px !important;
        max-width: 90vw;
      }

      .export-body-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-lg);
        padding: var(--spacing-lg);
        max-height: 60vh;
        overflow-y: auto;
      }

      .export-section {
        margin-bottom: var(--spacing-md);
      }

      .export-section h4 {
        font-size: var(--font-size-sm);
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--spacing-sm);
        padding-bottom: var(--spacing-xs);
        border-bottom: 1px solid var(--border-color);
      }

      .export-element-group {
        margin-bottom: var(--spacing-sm);
      }

      .export-toggle {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        cursor: pointer;
        font-size: var(--font-size-sm);
      }

      .element-options {
        margin-top: var(--spacing-xs);
        margin-left: var(--spacing-lg);
        padding: var(--spacing-sm);
        background: var(--bg-tertiary);
        border-radius: var(--radius-sm);
      }

      .element-options input[type="text"],
      .element-options textarea {
        width: 100%;
        padding: var(--spacing-xs) var(--spacing-sm);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        font-size: var(--font-size-sm);
        margin-bottom: var(--spacing-xs);
      }

      .size-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-size: var(--font-size-sm);
      }

      .size-row input[type="number"] {
        width: 60px;
        padding: var(--spacing-xs);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
      }

      .legend-layers {
        max-height: 120px;
        overflow-y: auto;
      }

      .legend-layer-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-xs) 0;
        font-size: var(--font-size-sm);
        cursor: pointer;
      }

      .layer-color {
        width: 14px;
        height: 14px;
        border-radius: 2px;
        border: 1px solid var(--border-color);
      }

      .export-preview-container {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
      }

      .export-preview-container h4 {
        font-size: var(--font-size-sm);
        font-weight: 600;
        margin: 0;
      }

      .export-preview {
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        background: var(--bg-tertiary);
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .preview-placeholder,
      .preview-loading,
      .preview-error {
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        text-align: center;
        padding: var(--spacing-md);
      }

      .no-layers {
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        margin: 0;
      }
    `;
    document.head.appendChild(styles);
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

export const exportPanel = new ExportPanel();
