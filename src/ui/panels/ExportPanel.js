/**
 * ExportPanel - 지도 내보내기 설정 패널 (확장 버전)
 * 제목, 축척, 방위표, 범례, 텍스트 박스 기능 포함
 * 드래그로 요소 위치 조정 및 텍스트 스타일링 지원
 */

import { exportTool } from '../../tools/ExportTool.js';
import { mapManager } from '../../core/MapManager.js';
import { layerManager } from '../../core/LayerManager.js';

class ExportPanel {
  constructor() {
    this.modal = null;
    this.previewCanvas = null;
    this.previewCtx = null;
    this.dragging = null;
    this.dragOffset = { x: 0, y: 0 };
    this.includeBasemap = true;
    this.mapPreviewCanvas = null;
    this.mapPreviewBasemap = null;
    this.capturingPreview = false;
    this.mapElements = {
      showLegend: true,
      showScaleBar: true,
      legendFontSize: 12
    };

    // 기본 위치 및 스타일 설정
    this.elements = {
      title: {
        enabled: false,
        text: '지도 제목',
        x: 0.5,
        y: 0.08,
        fontSize: 24,
        fontWeight: 'bold',
        fontFamily: 'Malgun Gothic',
        color: '#333333',
        background: true,
        backgroundColor: '#ffffff',
        backgroundOpacity: 0.85,
        shadow: false,
        shadowColor: '#000000',
        stroke: false,
        strokeColor: '#ffffff',
        strokeWidth: 2
      },
      compass: {
        enabled: true,
        x: 0.92,
        y: 0.12,
        size: 50
      },
      textBox: {
        enabled: false,
        text: '',
        x: 0.5,
        y: 0.85,
        fontSize: 12,
        fontWeight: 'normal',
        fontFamily: 'Malgun Gothic',
        color: '#333333',
        background: true,
        backgroundColor: '#ffffff',
        backgroundOpacity: 0.9,
        shadow: false,
        stroke: false,
        strokeColor: '#ffffff',
        strokeWidth: 1
      }
    };

    this.fonts = [
      { value: 'Malgun Gothic', label: '맑은 고딕' },
      { value: 'Nanum Gothic', label: '나눔고딕' },
      { value: 'Noto Sans KR', label: 'Noto Sans' },
      { value: 'Arial', label: 'Arial' },
      { value: 'Georgia', label: 'Georgia' },
      { value: 'Times New Roman', label: 'Times' }
    ];
  }

  show() {
    this.render();
    this.applyMapElements();
    this.refreshMapCapture();
  }

  /**
   * 지도 위 범례·축척바 DOM에 현재 설정 반영
   * (위치는 사용자가 지도에서 직접 드래그로 조정)
   */
  applyMapElements() {
    const legendSelector = '.choropleth-legend, .chart-map-legend, .heatmap-legend, .cartogram-legend';
    const legends = document.querySelectorAll(legendSelector);
    legends.forEach(el => {
      el.style.display = this.mapElements.showLegend ? '' : 'none';
      el.style.fontSize = this.mapElements.legendFontSize + 'px';
    });

    const scaleLines = document.querySelectorAll('.ol-scale-line, .ol-scale-bar');
    scaleLines.forEach(el => {
      el.style.display = this.mapElements.showScaleBar ? '' : 'none';
    });
  }

  async refreshMapCapture() {
    if (this.capturingPreview) return;
    this.capturingPreview = true;
    this.updatePreview();
    try {
      const canvas = await exportTool.captureMap({ scale: 0.4, includeBasemap: this.includeBasemap });
      this.mapPreviewCanvas = canvas;
      this.mapPreviewBasemap = this.includeBasemap;
    } catch (err) {
      console.warn('Map preview capture failed:', err);
    } finally {
      this.capturingPreview = false;
      this.updatePreview();
    }
  }

  render() {
    this.close();

    const formats = exportTool.getFormats();

    this.modal = document.createElement('div');
    this.modal.className = 'export-modal';
    this.modal.innerHTML = this.getModalHTML(formats);
    document.body.appendChild(this.modal);

    this.addStyles();
    this.syncUIFromElements();
    this.bindEvents();
  }

  getModalHTML(formats) {
    const formatOptions = formats.map(f =>
      '<option value="' + f.value + '">' + f.label + '</option>'
    ).join('');

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
              <div class="export-form-group basemap-toggle-group">
                <label class="basemap-toggle">
                  <input type="checkbox" id="opt-basemap" checked>
                  <span>웹 배경지도 포함</span>
                </label>
                <p class="basemap-hint">해제하면 OSM/카토 등 타일 배경 없이 업로드한 레이어만 내보냅니다.</p>
              </div>
            </div>

            <div class="export-section">
              <h4>지도 요소 <span class="help-text">(미리보기에서 드래그하여 위치 조정)</span></h4>

              <!-- 제목 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-title">
                  <span>제목</span>
                </label>
                <div class="element-options" id="title-options" style="display:none;">
                  <input type="text" id="title-text" placeholder="제목 입력">
                  ${this.getStyleOptionsHTML('title')}
                </div>
              </div>

              <!-- 방위표 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <input type="checkbox" id="opt-compass" checked>
                  <span>방위표</span>
                </label>
                <div class="element-options" id="compass-options">
                  <div class="style-row">
                    <label>크기</label>
                    <input type="number" id="compass-size" min="30" max="100">
                  </div>
                </div>
              </div>

              <!-- 지도 위 범례 / 축척바 -->
              <div class="export-element-group">
                <label class="export-toggle">
                  <span>지도 위 범례 · 축척바</span>
                </label>
                <p class="help-text" style="margin: 0 0 6px; font-weight: normal;">범례와 축척바는 지도 위에서 직접 드래그해 위치를 옮길 수 있습니다.</p>
                <div class="element-options" id="map-elements-options">
                  <div class="style-row">
                    <label class="checkbox-inline">
                      <input type="checkbox" id="opt-map-legend" checked>
                      <span>범례 표시</span>
                    </label>
                  </div>
                  <div class="style-row">
                    <label class="checkbox-inline">
                      <input type="checkbox" id="opt-map-scalebar" checked>
                      <span>축척바 표시</span>
                    </label>
                  </div>
                  <div class="style-row">
                    <label>범례 글자</label>
                    <input type="number" id="map-legend-fontsize" min="8" max="24">
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
                  ${this.getStyleOptionsHTML('textbox')}
                </div>
              </div>
            </div>
          </div>

          <!-- 오른쪽: 미리보기 -->
          <div class="export-preview-container">
            <h4>미리보기 <span class="help-text">(요소를 드래그하여 이동)</span></h4>
            <div class="export-preview" id="export-preview">
              <canvas id="preview-canvas"></canvas>
            </div>
            <div class="preview-actions">
              <button class="btn btn-secondary btn-sm" id="reset-positions">위치 초기화</button>
              <button class="btn btn-secondary btn-sm" id="refresh-preview">새로고침</button>
            </div>
          </div>
        </div>
        <div class="export-footer">
          <button class="btn btn-secondary" id="export-cancel">취소</button>
          <button class="btn btn-primary" id="export-apply">내보내기</button>
        </div>
      </div>
    `;
  }

  getStyleOptionsHTML(prefix) {
    const fontOptions = this.fonts.map(f =>
      `<option value="${f.value}">${f.label}</option>`
    ).join('');

    return `
      <div class="style-options">
        <div class="style-row">
          <label>글꼴</label>
          <select id="${prefix}-font">${fontOptions}</select>
        </div>
        <div class="style-row">
          <label>크기</label>
          <input type="number" id="${prefix}-size" min="8" max="72">
        </div>
        <div class="style-row">
          <label>굵기</label>
          <select id="${prefix}-weight">
            <option value="normal">보통</option>
            <option value="bold">굵게</option>
          </select>
        </div>
        <div class="style-row">
          <label>색상</label>
          <input type="color" id="${prefix}-color">
        </div>
        <div class="style-row">
          <label class="checkbox-inline">
            <input type="checkbox" id="${prefix}-background">
            <span>배경</span>
          </label>
          <input type="color" id="${prefix}-background-color" style="width:30px;">
          <input type="range" id="${prefix}-background-opacity" min="0" max="1" step="0.05" style="flex:1;">
          <span id="${prefix}-background-opacity-value" style="font-size:11px; width:30px; text-align:right;"></span>
        </div>
        <div class="style-row">
          <label class="checkbox-inline">
            <input type="checkbox" id="${prefix}-shadow">
            <span>그림자</span>
          </label>
          <input type="color" id="${prefix}-shadow-color" style="width:40px;">
        </div>
        <div class="style-row">
          <label class="checkbox-inline">
            <input type="checkbox" id="${prefix}-stroke">
            <span>테두리</span>
          </label>
          <input type="color" id="${prefix}-stroke-color" style="width:40px;">
          <input type="number" id="${prefix}-stroke-width" min="1" max="5" style="width:50px;">
        </div>
      </div>
    `;
  }

  getBasicStyleHTML(prefix) {
    const fontOptions = this.fonts.map(f =>
      `<option value="${f.value}">${f.label}</option>`
    ).join('');

    return `
      <div class="style-options">
        <div class="style-row">
          <label>글꼴</label>
          <select id="${prefix}-font">${fontOptions}</select>
        </div>
        <div class="style-row">
          <label>크기</label>
          <input type="number" id="${prefix}-size" min="8" max="24">
        </div>
        <div class="style-row">
          <label>색상</label>
          <input type="color" id="${prefix}-color">
        </div>
        <div class="style-row">
          <label class="checkbox-inline">
            <input type="checkbox" id="${prefix}-background">
            <span>배경</span>
          </label>
          <input type="color" id="${prefix}-background-color" style="width:30px;">
          <input type="range" id="${prefix}-background-opacity" min="0" max="1" step="0.05" style="flex:1;">
          <span id="${prefix}-background-opacity-value" style="font-size:11px; width:30px; text-align:right;"></span>
        </div>
      </div>
    `;
  }

  /**
   * UI 요소들을 this.elements 값으로 동기화
   */
  syncUIFromElements() {
    // 제목
    const titleEl = this.elements.title;
    this.setChecked('opt-title', titleEl.enabled);
    this.setValue('title-text', titleEl.text);
    this.setValue('title-font', titleEl.fontFamily);
    this.setValue('title-size', titleEl.fontSize);
    this.setValue('title-weight', titleEl.fontWeight);
    this.setValue('title-color', titleEl.color);
    this.setChecked('title-background', titleEl.background);
    this.setValue('title-background-color', titleEl.backgroundColor);
    this.setValue('title-background-opacity', titleEl.backgroundOpacity);
    this.updateOpacityLabel('title', titleEl.backgroundOpacity);
    this.toggleBgControls('title', titleEl.background);
    this.setChecked('title-shadow', titleEl.shadow);
    this.setValue('title-shadow-color', titleEl.shadowColor);
    this.setChecked('title-stroke', titleEl.stroke);
    this.setValue('title-stroke-color', titleEl.strokeColor);
    this.setValue('title-stroke-width', titleEl.strokeWidth);
    document.getElementById('title-options').style.display = titleEl.enabled ? 'block' : 'none';

    // 방위표
    const compassEl = this.elements.compass;
    this.setChecked('opt-compass', compassEl.enabled);
    this.setValue('compass-size', compassEl.size);

    // 지도 위 요소
    this.setChecked('opt-map-legend', this.mapElements.showLegend);
    this.setChecked('opt-map-scalebar', this.mapElements.showScaleBar);
    this.setValue('map-legend-fontsize', this.mapElements.legendFontSize);

    // 텍스트 박스
    const textBoxEl = this.elements.textBox;
    this.setChecked('opt-textbox', textBoxEl.enabled);
    this.setValue('textbox-content', textBoxEl.text);
    this.setValue('textbox-font', textBoxEl.fontFamily);
    this.setValue('textbox-size', textBoxEl.fontSize);
    this.setValue('textbox-weight', textBoxEl.fontWeight);
    this.setValue('textbox-color', textBoxEl.color);
    this.setChecked('textbox-background', textBoxEl.background);
    this.setValue('textbox-background-color', textBoxEl.backgroundColor);
    this.setValue('textbox-background-opacity', textBoxEl.backgroundOpacity);
    this.updateOpacityLabel('textbox', textBoxEl.backgroundOpacity);
    this.toggleBgControls('textbox', textBoxEl.background);
    this.setChecked('textbox-shadow', textBoxEl.shadow);
    this.setChecked('textbox-stroke', textBoxEl.stroke);
    this.setValue('textbox-stroke-color', textBoxEl.strokeColor);
    this.setValue('textbox-stroke-width', textBoxEl.strokeWidth);
    document.getElementById('textbox-options').style.display = textBoxEl.enabled ? 'block' : 'none';
  }

  setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  setChecked(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }

  toggleBgControls(prefix, enabled) {
    const color = document.getElementById(`${prefix}-background-color`);
    const opacity = document.getElementById(`${prefix}-background-opacity`);
    const label = document.getElementById(`${prefix}-background-opacity-value`);
    [color, opacity].forEach(el => {
      if (!el) return;
      el.disabled = !enabled;
      el.style.opacity = enabled ? '1' : '0.4';
    });
    if (label) label.style.opacity = enabled ? '1' : '0.4';
  }

  updateOpacityLabel(prefix, value) {
    const label = document.getElementById(`${prefix}-background-opacity-value`);
    if (label) label.textContent = Math.round(value * 100) + '%';
  }

  hexToRgba(hex, alpha) {
    const a = (alpha == null || isNaN(alpha)) ? 1 : alpha;
    if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  bindEvents() {
    const closeBtn = document.getElementById('export-close');
    const cancelBtn = document.getElementById('export-cancel');
    const applyBtn = document.getElementById('export-apply');
    const formatSelect = document.getElementById('export-format');
    const qualityInput = document.getElementById('export-quality');
    const qualityValue = document.getElementById('export-quality-value');
    const qualityGroup = document.getElementById('quality-group');
    const refreshBtn = document.getElementById('refresh-preview');
    const resetBtn = document.getElementById('reset-positions');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    formatSelect.addEventListener('change', (e) => {
      qualityGroup.style.display = e.target.value === 'jpg' ? 'block' : 'none';
    });

    qualityInput.addEventListener('input', (e) => {
      qualityValue.textContent = Math.round(e.target.value * 100) + '%';
    });

    // 배경지도 토글
    const basemapToggle = document.getElementById('opt-basemap');
    if (basemapToggle) {
      basemapToggle.checked = this.includeBasemap;
      basemapToggle.addEventListener('change', (e) => {
        this.includeBasemap = e.target.checked;
        this.refreshMapCapture();
      });
    }

    // 제목 토글
    document.getElementById('opt-title').addEventListener('change', (e) => {
      this.elements.title.enabled = e.target.checked;
      document.getElementById('title-options').style.display = e.target.checked ? 'block' : 'none';
      this.updatePreview();
    });

    // 방위표 토글
    document.getElementById('opt-compass').addEventListener('change', (e) => {
      this.elements.compass.enabled = e.target.checked;
      this.updatePreview();
    });

    // 지도 위 범례·축척바
    const mapLegendCb = document.getElementById('opt-map-legend');
    if (mapLegendCb) {
      mapLegendCb.addEventListener('change', (e) => {
        this.mapElements.showLegend = e.target.checked;
        this.applyMapElements();
        this.refreshMapCapture();
      });
    }
    const mapScaleCb = document.getElementById('opt-map-scalebar');
    if (mapScaleCb) {
      mapScaleCb.addEventListener('change', (e) => {
        this.mapElements.showScaleBar = e.target.checked;
        this.applyMapElements();
        this.refreshMapCapture();
      });
    }
    const mapLegendFs = document.getElementById('map-legend-fontsize');
    if (mapLegendFs) {
      mapLegendFs.addEventListener('change', (e) => {
        this.mapElements.legendFontSize = parseInt(e.target.value) || 12;
        this.applyMapElements();
        this.refreshMapCapture();
      });
    }

    // 텍스트 박스 토글
    document.getElementById('opt-textbox').addEventListener('change', (e) => {
      this.elements.textBox.enabled = e.target.checked;
      document.getElementById('textbox-options').style.display = e.target.checked ? 'block' : 'none';
      this.updatePreview();
    });

    // 제목 스타일
    this.bindInput('title-text', 'title', 'text');
    this.bindInput('title-font', 'title', 'fontFamily');
    this.bindInput('title-size', 'title', 'fontSize', true);
    this.bindInput('title-weight', 'title', 'fontWeight');
    this.bindInput('title-color', 'title', 'color');
    this.bindBackground('title');
    this.bindCheckbox('title-shadow', 'title', 'shadow');
    this.bindInput('title-shadow-color', 'title', 'shadowColor');
    this.bindCheckbox('title-stroke', 'title', 'stroke');
    this.bindInput('title-stroke-color', 'title', 'strokeColor');
    this.bindInput('title-stroke-width', 'title', 'strokeWidth', true);

    // 방위표 크기
    this.bindInput('compass-size', 'compass', 'size', true);

    // 텍스트 박스 스타일
    this.bindInput('textbox-content', 'textBox', 'text');
    this.bindInput('textbox-font', 'textBox', 'fontFamily');
    this.bindInput('textbox-size', 'textBox', 'fontSize', true);
    this.bindInput('textbox-weight', 'textBox', 'fontWeight');
    this.bindInput('textbox-color', 'textBox', 'color');
    this.bindBackground('textbox', 'textBox');
    this.bindCheckbox('textbox-shadow', 'textBox', 'shadow');
    this.bindCheckbox('textbox-stroke', 'textBox', 'stroke');
    this.bindInput('textbox-stroke-color', 'textBox', 'strokeColor');
    this.bindInput('textbox-stroke-width', 'textBox', 'strokeWidth', true);

    refreshBtn.addEventListener('click', () => this.refreshMapCapture());
    resetBtn.addEventListener('click', () => this.resetPositions());
    applyBtn.addEventListener('click', () => this.doExport());

    // 캔버스 드래그 이벤트
    this.setupDragEvents();

    // 초기 미리보기
    setTimeout(() => this.updatePreview(), 100);
  }

  bindInput(elementId, objKey, propKey, isNumber = false) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const handler = (e) => {
      this.elements[objKey][propKey] = isNumber ? parseInt(e.target.value) || 0 : e.target.value;
      this.updatePreview();
    };

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }

  bindBackground(prefix, objKey = prefix) {
    const checkbox = document.getElementById(`${prefix}-background`);
    const color = document.getElementById(`${prefix}-background-color`);
    const opacity = document.getElementById(`${prefix}-background-opacity`);

    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        this.elements[objKey].background = e.target.checked;
        this.toggleBgControls(prefix, e.target.checked);
        this.updatePreview();
      });
    }
    if (color) {
      color.addEventListener('input', (e) => {
        this.elements[objKey].backgroundColor = e.target.value;
        this.updatePreview();
      });
    }
    if (opacity) {
      opacity.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        this.elements[objKey].backgroundOpacity = v;
        this.updateOpacityLabel(prefix, v);
        this.updatePreview();
      });
    }
  }

  bindCheckbox(elementId, objKey, propKey) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.addEventListener('change', (e) => {
      this.elements[objKey][propKey] = e.target.checked;
      this.updatePreview();
    });
  }

  setupDragEvents() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', () => this.onMouseUp());
    canvas.addEventListener('mouseleave', () => this.onMouseUp());
  }

  onMouseDown(e) {
    const canvas = document.getElementById('preview-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const hitElement = this.hitTest(x, y);
    if (hitElement) {
      this.dragging = hitElement;
      this.dragOffset = {
        x: x - this.elements[hitElement].x * canvas.width,
        y: y - this.elements[hitElement].y * canvas.height
      };
      canvas.style.cursor = 'grabbing';
    }
  }

  onMouseMove(e) {
    const canvas = document.getElementById('preview-canvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (this.dragging) {
      this.elements[this.dragging].x = Math.max(0.05, Math.min(0.95, (x - this.dragOffset.x) / canvas.width));
      this.elements[this.dragging].y = Math.max(0.05, Math.min(0.95, (y - this.dragOffset.y) / canvas.height));
      this.updatePreview();
    } else {
      const hitElement = this.hitTest(x, y);
      canvas.style.cursor = hitElement ? 'grab' : 'default';
    }
  }

  onMouseUp() {
    const canvas = document.getElementById('preview-canvas');
    if (canvas) canvas.style.cursor = 'default';
    this.dragging = null;
  }

  hitTest(x, y) {
    const canvas = document.getElementById('preview-canvas');
    const w = canvas.width;
    const h = canvas.height;

    const elements = ['title', 'compass', 'textBox'];

    for (const key of elements) {
      const el = this.elements[key];
      if (!el.enabled) continue;

      const elX = el.x * w;
      const elY = el.y * h;
      let hitBox = { x: 0, y: 0, w: 0, h: 0 };

      switch (key) {
        case 'title':
          hitBox = { x: elX - 100, y: elY - 20, w: 200, h: 40 };
          break;
        case 'compass':
          const size = el.size * 0.4;
          hitBox = { x: elX - size, y: elY - size, w: size * 2, h: size * 2 };
          break;
        case 'textBox':
          hitBox = { x: elX - 50, y: elY - 25, w: 100, h: 50 };
          break;
      }

      if (x >= hitBox.x && x <= hitBox.x + hitBox.w &&
          y >= hitBox.y && y <= hitBox.y + hitBox.h) {
        return key;
      }
    }

    return null;
  }

  resetPositions() {
    this.elements.title.x = 0.5;
    this.elements.title.y = 0.08;
    this.elements.compass.x = 0.92;
    this.elements.compass.y = 0.12;
    this.elements.textBox.x = 0.5;
    this.elements.textBox.y = 0.85;
    this.updatePreview();
  }

  updatePreview() {
    const container = document.getElementById('export-preview');
    const canvas = document.getElementById('preview-canvas');
    if (!container || !canvas) return;

    const previewWidth = container.clientWidth - 10 || 300;
    const previewHeight = Math.round(previewWidth * 0.67);

    canvas.width = previewWidth;
    canvas.height = previewHeight;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    const mapX = 8;
    const mapY = 8;
    const mapW = previewWidth - 16;
    const mapH = previewHeight - 16;

    // 지도 영역 - 캡처된 지도 또는 fallback
    const hasCachedMap = this.mapPreviewCanvas && this.mapPreviewBasemap === this.includeBasemap;

    if (!this.includeBasemap) {
      // 투명 배경 표현 (체크무늬)
      const tile = 8;
      for (let y = mapY; y < mapY + mapH; y += tile) {
        for (let x = mapX; x < mapX + mapW; x += tile) {
          const isAlt = ((x + y) / tile) % 2 === 0;
          ctx.fillStyle = isAlt ? '#ffffff' : '#f0f0f0';
          ctx.fillRect(
            x,
            y,
            Math.min(tile, mapX + mapW - x),
            Math.min(tile, mapY + mapH - y)
          );
        }
      }
    } else {
      ctx.fillStyle = '#c5d8e8';
      ctx.fillRect(mapX, mapY, mapW, mapH);
    }

    if (hasCachedMap) {
      // 캡처된 지도 그리기 (aspect-fit)
      const src = this.mapPreviewCanvas;
      const srcRatio = src.width / src.height;
      const dstRatio = mapW / mapH;
      let dw, dh, dx, dy;
      if (srcRatio > dstRatio) {
        dw = mapW; dh = mapW / srcRatio;
        dx = mapX; dy = mapY + (mapH - dh) / 2;
      } else {
        dh = mapH; dw = mapH * srcRatio;
        dy = mapY; dx = mapX + (mapW - dw) / 2;
      }
      ctx.drawImage(src, dx, dy, dw, dh);
    } else if (this.capturingPreview) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = '12px "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('지도 캡처 중...', mapX + mapW / 2, mapY + mapH / 2);
    }

    // 요소 그리기
    this.drawPreviewElements(ctx, previewWidth, previewHeight);
  }

  drawPreviewElements(ctx, width, height) {
    if (this.elements.title.enabled) {
      this.drawPreviewTitle(ctx, width, height);
    }
    if (this.elements.compass.enabled) {
      this.drawPreviewCompass(ctx, width, height);
    }
    if (this.elements.textBox.enabled && this.elements.textBox.text) {
      this.drawPreviewTextBox(ctx, width, height);
    }
  }

  drawPreviewTitle(ctx, width, height) {
    const el = this.elements.title;
    const x = el.x * width;
    const y = el.y * height;
    const fontSize = Math.max(8, el.fontSize * 0.5);

    ctx.save();

    ctx.font = `${el.fontWeight} ${fontSize}px "${el.fontFamily}", sans-serif`;
    const textWidth = ctx.measureText(el.text || '지도 제목').width + 20;

    // 배경
    if (el.background) {
      ctx.fillStyle = this.hexToRgba(el.backgroundColor, el.backgroundOpacity);
      ctx.fillRect(x - textWidth / 2, y - fontSize, textWidth, fontSize * 1.8);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (el.shadow) {
      ctx.shadowColor = el.shadowColor;
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    if (el.stroke) {
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = el.strokeWidth * 0.5;
      ctx.strokeText(el.text || '지도 제목', x, y);
    }

    ctx.fillStyle = el.color;
    ctx.fillText(el.text || '지도 제목', x, y);

    ctx.restore();
  }

  drawPreviewScaleBar_unused(ctx, width, height) {
    const el = this.elements.scaleBar;
    const x = el.x * width;
    const y = el.y * height;
    const fontSize = Math.max(6, el.fontSize * 0.5);

    ctx.save();

    if (el.background) {
      ctx.fillStyle = this.hexToRgba(el.backgroundColor, el.backgroundOpacity);
      ctx.fillRect(x - 5, y - 20, 70, 30);
    }

    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, 50, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, 25, 4);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, 50, 4);

    ctx.font = `${fontSize}px "${el.fontFamily}", sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textAlign = 'center';
    ctx.fillText('0', x, y - 5);
    ctx.fillText('1km', x + 50, y - 5);

    ctx.restore();
  }

  drawPreviewCompass(ctx, width, height) {
    const el = this.elements.compass;
    const cx = el.x * width;
    const cy = el.y * height;
    const size = el.size * 0.3;

    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 북쪽 화살표
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.7);
    ctx.lineTo(cx - size * 0.2, cy);
    ctx.lineTo(cx, cy - size * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#d32f2f';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.7);
    ctx.lineTo(cx + size * 0.2, cy);
    ctx.lineTo(cx, cy - size * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#b71c1c';
    ctx.fill();

    // 남쪽 화살표
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.7);
    ctx.lineTo(cx - size * 0.2, cy);
    ctx.lineTo(cx, cy + size * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.7);
    ctx.lineTo(cx + size * 0.2, cy);
    ctx.lineTo(cx, cy + size * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#eee';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = `bold ${size * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - size - 3);

    ctx.restore();
  }

  drawPreviewLegend_unused(ctx, width, height) {
    const el = this.elements.legend;
    const x = el.x * width;
    const y = el.y * height;
    const fontSize = Math.max(6, el.fontSize * 0.5);

    ctx.save();

    if (el.background) {
      ctx.fillStyle = this.hexToRgba(el.backgroundColor, el.backgroundOpacity);
      ctx.fillRect(x, y, 70, 55);
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, 70, 55);
    }

    ctx.fillStyle = el.color;
    ctx.font = `bold ${fontSize}px "${el.fontFamily}", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('범례', x + 5, y + 12);

    const colors = ['#4292c6', '#41ab5d', '#fd8d3c'];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(x + 5, y + 18 + i * 12, 10, 10);
      ctx.fillStyle = el.color;
      ctx.font = `${fontSize - 1}px sans-serif`;
      ctx.fillText('레이어', x + 18, y + 26 + i * 12);
    });

    ctx.restore();
  }

  drawPreviewTextBox(ctx, width, height) {
    const el = this.elements.textBox;
    const x = el.x * width;
    const y = el.y * height;
    const fontSize = Math.max(6, el.fontSize * 0.5);
    const lines = el.text.split('\n').slice(0, 3).map(l => l.substring(0, 20));

    ctx.save();

    ctx.font = `${el.fontWeight} ${fontSize}px "${el.fontFamily}", sans-serif`;
    const lineHeight = fontSize + 4;
    const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxWidth = maxLineWidth + 16;
    const boxHeight = lines.length * lineHeight + 8;
    const boxX = x - boxWidth / 2;
    const boxY = y - boxHeight / 2;

    if (el.background) {
      ctx.fillStyle = this.hexToRgba(el.backgroundColor, el.backgroundOpacity);
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (el.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }

    const firstLineY = y - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, i) => {
      const lineY = firstLineY + i * lineHeight;

      if (el.stroke) {
        ctx.strokeStyle = el.strokeColor;
        ctx.lineWidth = el.strokeWidth * 0.3;
        ctx.strokeText(line, x, lineY);
      }

      ctx.fillStyle = el.color;
      ctx.fillText(line, x, lineY);
    });

    ctx.restore();
  }

  async doExport() {
    const filename = document.getElementById('export-filename').value.trim() || 'e-GIS_map';
    const format = document.getElementById('export-format').value;
    const quality = parseFloat(document.getElementById('export-quality').value);
    const scale = parseInt(document.getElementById('export-scale').value);

    const overlayOptions = {
      title: this.elements.title.enabled ? { ...this.elements.title } : null,
      compass: this.elements.compass.enabled ? { ...this.elements.compass } : null,
      textBox: (this.elements.textBox.enabled && this.elements.textBox.text)
        ? { ...this.elements.textBox }
        : null
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
        overlays: overlayOptions,
        includeBasemap: this.includeBasemap
      });

      this.close();
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '내보내기';
    }
  }


  addStyles() {
    if (document.getElementById('export-panel-styles-v4')) return;

    const styles = document.createElement('style');
    styles.id = 'export-panel-styles-v4';
    styles.textContent = `
      .export-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .export-content {
        background: var(--bg-panel, #fff);
        border-radius: var(--radius-lg, 8px);
        box-shadow: var(--shadow-lg, 0 4px 20px rgba(0,0,0,0.15));
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .export-content-large {
        width: 850px;
        max-width: 95vw;
      }

      .export-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .export-header h3 {
        margin: 0;
        font-size: var(--font-size-lg, 16px);
      }

      .export-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--text-secondary, #666);
      }

      .export-body-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-lg, 16px);
        padding: var(--spacing-lg, 16px);
        max-height: 65vh;
        overflow-y: auto;
      }

      .export-options {
        overflow-y: auto;
        max-height: 100%;
        padding-right: var(--spacing-sm, 8px);
      }

      .export-section {
        margin-bottom: var(--spacing-md, 12px);
      }

      .export-section h4 {
        font-size: var(--font-size-sm, 13px);
        font-weight: 600;
        color: var(--text-primary, #333);
        margin-bottom: var(--spacing-sm, 8px);
        padding-bottom: var(--spacing-xs, 4px);
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 8px);
      }

      .help-text {
        font-size: var(--font-size-xs, 11px);
        font-weight: normal;
        color: var(--text-secondary, #666);
      }

      .export-form-group {
        margin-bottom: var(--spacing-sm, 8px);
      }

      .export-form-group label {
        display: block;
        font-size: var(--font-size-sm, 13px);
        margin-bottom: 4px;
      }

      .export-form-group input,
      .export-form-group select {
        width: 100%;
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-size-sm, 13px);
      }

      .basemap-toggle-group {
        background: var(--bg-tertiary, #f5f5f5);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        padding: var(--spacing-sm, 8px);
      }

      .basemap-toggle-group label.basemap-toggle {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 8px);
        cursor: pointer;
        font-size: var(--font-size-sm, 13px);
        font-weight: 500;
        margin-bottom: 4px;
      }

      .basemap-toggle-group .basemap-toggle input[type="checkbox"] {
        width: auto;
        margin: 0;
      }

      .basemap-toggle-group .basemap-hint {
        margin: 0 0 0 22px;
        font-size: var(--font-size-xs, 11px);
        color: var(--text-secondary, #666);
        line-height: 1.4;
      }

      .export-element-group {
        margin-bottom: var(--spacing-sm, 8px);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        padding: var(--spacing-sm, 8px);
      }

      .export-toggle {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 8px);
        cursor: pointer;
        font-size: var(--font-size-sm, 13px);
        font-weight: 500;
      }

      .element-options {
        margin-top: var(--spacing-sm, 8px);
        padding: var(--spacing-sm, 8px);
        background: var(--bg-tertiary, #f5f5f5);
        border-radius: var(--radius-sm, 4px);
      }

      .element-options input[type="text"],
      .element-options textarea {
        width: 100%;
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-size-sm, 13px);
        margin-bottom: var(--spacing-xs, 4px);
      }

      .style-options {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs, 4px);
      }

      .style-row {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 8px);
        font-size: var(--font-size-xs, 11px);
      }

      .style-row > label:first-child {
        width: 45px;
        flex-shrink: 0;
      }

      .style-row select,
      .style-row input[type="number"] {
        flex: 1;
        padding: 2px 4px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-size-xs, 11px);
      }

      .style-row input[type="color"] {
        width: 30px;
        height: 22px;
        padding: 0;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        cursor: pointer;
      }

      .checkbox-inline {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        white-space: nowrap;
      }

      .legend-layers {
        max-height: 100px;
        overflow-y: auto;
        margin-bottom: var(--spacing-sm, 8px);
      }

      .legend-layer-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 8px);
        padding: 2px 0;
        font-size: var(--font-size-xs, 11px);
        cursor: pointer;
      }

      .layer-color {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .export-preview-container {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm, 8px);
      }

      .export-preview-container h4 {
        font-size: var(--font-size-sm, 13px);
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-sm, 8px);
      }

      .export-preview {
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-sm, 4px);
        background: var(--bg-tertiary, #f5f5f5);
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .export-preview canvas {
        max-width: 100%;
        height: auto;
      }

      .preview-actions {
        display: flex;
        gap: var(--spacing-sm, 8px);
        justify-content: flex-end;
      }

      .export-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-sm, 8px);
        padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
        border-top: 1px solid var(--border-color, #e0e0e0);
      }

      .no-layers {
        color: var(--text-secondary, #666);
        font-size: var(--font-size-xs, 11px);
        margin: 0;
      }
    `;
    document.head.appendChild(styles);
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const exportPanel = new ExportPanel();
