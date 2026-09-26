// © 2026 김용현
/**
 * TimeSeriesPanel - 시계열 단계구분도 설정 창 (실험실 `time-series`)
 *
 * ChoroplethPanel 과 같은 모달 규약(.choropleth-modal / .choropleth-content 스타일 재사용).
 * 레이어(폴리곤·숫자 필드 2개 이상) → 필드 체크 목록(속성 순서) + 연도 자동 선택 →
 * 분류 방법·구간 수·팔레트(기존 램프 + 커스텀) → 적용(timeSeriesTool.apply).
 * Esc·바깥 클릭·닫기 버튼으로 닫는다.
 * 안내 문구는 onMessage 로 보낸다 — configure({ onMessage }) 로 바꿀 수 있고, 기본은 alert.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「4단계」
 */
import { choroplethTool } from '../../tools/ChoroplethTool.js';
import { timeSeriesTool } from '../../tools/TimeSeriesTool.js';
import { detectYearFields, MAX_TIME_SERIES_FIELDS } from '../../tools/timeSeriesModel.js';
import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId, isVectorLayer } from '../../utils/layerSelect.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const DEFAULT_CUSTOM = ['#ffffcc', '#fd8d3c', '#800026'];
const MIN_CUSTOM_COLORS = 2;
const MAX_CUSTOM_COLORS = 8;

function defaultMessage(msg) {
  window.alert(msg);
}

function isPolygonLayer(layer) {
  return /Polygon$/.test(String(layer.geometryType || ''));
}

class TimeSeriesPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
    this._escHandler = null;
    this.onMessage = defaultMessage;
  }

  /** @param {{ onMessage?: ((msg: string) => void) | null }} options */
  configure({ onMessage } = {}) {
    this.onMessage = typeof onMessage === 'function' ? onMessage : defaultMessage;
  }

  /** 폴리곤이고 숫자 필드가 2개 이상인 벡터 레이어 */
  compatibleLayers() {
    return layerManager.getAllLayers().filter(
      (l) => isVectorLayer(l) && isPolygonLayer(l) && choroplethTool.getNumericAttributes(l.id).length >= 2
    );
  }

  show(layerId = null) {
    const layers = this.compatibleLayers();
    if (layers.length === 0) {
      this.onMessage('시계열 단계구분도를 적용할 수 있는 레이어가 없습니다.\n(숫자형 속성이 2개 이상인 면 레이어가 필요합니다)');
      return;
    }
    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || layers[0].id;
    this.render(layers);
  }

  render(layers) {
    this.close();
    const rampOptions = choroplethTool.getColorRamps()
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    const methodOptions = Object.entries(choroplethTool.getClassificationMethods())
      .map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(v)}</option>`).join('');

    this.modal = document.createElement('div');
    this.modal.className = 'choropleth-modal time-series-modal';
    this.modal.innerHTML = `
      <div class="choropleth-content time-series-content" role="dialog" aria-labelledby="ts-title">
        <div class="choropleth-header">
          <h3 id="ts-title">시계열 단계구분도</h3>
          <button class="choropleth-close" id="ts-close-panel" aria-label="닫기">&times;</button>
        </div>
        <div class="choropleth-body">
          <p class="time-series-intro">연도별 열을 골라 구간을 한 번만 계산해 고정합니다. 적용 뒤 지도 아래 슬라이더로 연도를 넘깁니다.</p>
          <div class="choropleth-form-group">
            <label for="ts-layer">레이어</label>
            <select id="ts-layer">${buildLayerOptions(layers, { selectedId: this.currentLayerId })}</select>
          </div>
          <div class="choropleth-form-group">
            <div class="time-series-fields-head">
              <label>필드 (순서 = 속성 순서, 최대 ${MAX_TIME_SERIES_FIELDS}개)</label>
              <button type="button" class="btn btn-sm btn-outline" id="ts-auto-years">연도 자동 선택</button>
            </div>
            <div class="time-series-fields" id="ts-fields"></div>
          </div>
          <div class="choropleth-form-group">
            <label for="ts-method">분류 방법</label>
            <select id="ts-method">${methodOptions}</select>
          </div>
          <div class="choropleth-form-group">
            <label for="ts-classes">분류 수</label>
            <input type="range" id="ts-classes" min="3" max="8" value="5">
            <span id="ts-classes-value">5</span>
          </div>
          <div class="choropleth-form-group">
            <label for="ts-ramp">색상 팔레트</label>
            <select id="ts-ramp">${rampOptions}<option value="custom">커스텀</option></select>
            <div class="color-ramp-preview-container">
              <div id="ts-ramp-preview" class="color-ramp-preview"></div>
              <div class="color-ramp-preview-labels"><span>낮음</span><span>높음</span></div>
            </div>
          </div>
          <div class="choropleth-form-group choropleth-reverse-group">
            <label class="checkbox-label"><input type="checkbox" id="ts-reverse"><span>색상 반전 (높은 값 → 낮은 색상)</span></label>
          </div>
          <div class="choropleth-form-group custom-colors-group" id="ts-custom-colors" style="display:none;">
            <label>커스텀 색상 (시작 → 끝)</label>
            <div class="custom-color-inputs" id="ts-custom-inputs">
              ${DEFAULT_CUSTOM.map((c) => `<input type="color" class="custom-color-input" value="${c}">`).join('')}
            </div>
            <div class="custom-color-actions">
              <button type="button" class="btn btn-sm" id="ts-add-color">+ 색상 추가</button>
              <button type="button" class="btn btn-sm" id="ts-remove-color">- 색상 제거</button>
            </div>
          </div>
        </div>
        <div class="choropleth-footer">
          <button class="btn btn-primary" id="ts-apply">적용</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.modal);
    this.bindEvents();
    this.renderFields();
    this.updatePreview();
  }

  bindEvents() {
    const q = (sel) => this.modal.querySelector(sel);
    q('#ts-close-panel').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    q('#ts-layer').addEventListener('change', (e) => {
      this.currentLayerId = e.target.value || null;
      this.renderFields();
    });
    q('#ts-auto-years').addEventListener('click', () => this.autoSelectYears());
    q('#ts-classes').addEventListener('input', (e) => {
      q('#ts-classes-value').textContent = e.target.value;
      this.updatePreview();
    });
    q('#ts-ramp').addEventListener('change', () => {
      q('#ts-custom-colors').style.display = q('#ts-ramp').value === 'custom' ? 'block' : 'none';
      this.updatePreview();
    });
    q('#ts-reverse').addEventListener('change', () => this.updatePreview());
    q('#ts-add-color').addEventListener('click', () => this.addCustomColor());
    q('#ts-remove-color').addEventListener('click', () => this.removeCustomColor());
    this.modal.querySelectorAll('#ts-custom-inputs .custom-color-input').forEach((input) => {
      input.addEventListener('input', () => this.updatePreview());
    });
    q('#ts-apply').addEventListener('click', () => this.apply());
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);
  }

  renderFields() {
    const box = this.modal.querySelector('#ts-fields');
    const fields = this.currentLayerId ? choroplethTool.getNumericAttributes(this.currentLayerId) : [];
    if (fields.length === 0) {
      box.innerHTML = '<p class="time-series-fields-empty">먼저 레이어를 선택하세요.</p>';
      return;
    }
    box.innerHTML = fields.map((f) => `
      <label class="time-series-field-row">
        <input type="checkbox" class="ts-field-check" value="${escapeHtml(f)}">
        <span>${escapeHtml(f)}</span>
      </label>`).join('');
  }

  autoSelectYears() {
    const years = new Set(detectYearFields(this.checkedOrder().all));
    this.modal.querySelectorAll('.ts-field-check').forEach((b) => { b.checked = years.has(b.value); });
  }

  /** 체크 목록을 속성 순서로 — all: 전부, checked: 체크된 것 */
  checkedOrder() {
    const boxes = Array.from(this.modal.querySelectorAll('.ts-field-check'));
    return { all: boxes.map((b) => b.value), checked: boxes.filter((b) => b.checked).map((b) => b.value) };
  }

  customColors() {
    return Array.from(this.modal.querySelectorAll('#ts-custom-inputs .custom-color-input')).map((i) => i.value);
  }

  addCustomColor() {
    const container = this.modal.querySelector('#ts-custom-inputs');
    if (container.querySelectorAll('.custom-color-input').length >= MAX_CUSTOM_COLORS) return;
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'custom-color-input';
    input.value = '#ff0000';
    input.addEventListener('input', () => this.updatePreview());
    container.appendChild(input);
    this.updatePreview();
  }

  removeCustomColor() {
    const container = this.modal.querySelector('#ts-custom-inputs');
    const inputs = container.querySelectorAll('.custom-color-input');
    if (inputs.length <= MIN_CUSTOM_COLORS) return;
    container.removeChild(inputs[inputs.length - 1]);
    this.updatePreview();
  }

  updatePreview() {
    const ramp = this.modal.querySelector('#ts-ramp').value;
    const reverse = this.modal.querySelector('#ts-reverse').checked;
    const n = parseInt(this.modal.querySelector('#ts-classes').value, 10) || 5;
    let colors;
    if (ramp === 'custom') {
      const custom = this.customColors();
      colors = custom.length >= 2 ? choroplethTool.interpolateColors(custom, n) : custom;
    } else {
      colors = choroplethTool.sampleColorRamp(choroplethTool.getColorRampColors(ramp), n);
    }
    // 미리보기는 실제 지도에 쓰일 색과 같아야 한다 — 분류 수만큼 뽑아 반전까지 반영한다.
    const shown = reverse ? [...colors].reverse() : colors;
    this.modal.querySelector('#ts-ramp-preview').innerHTML = shown
      .map((c) => `<div class="color-ramp-item" style="background:${escapeHtml(c)}"></div>`).join('');
  }

  apply() {
    if (!this.currentLayerId) { this.onMessage('먼저 레이어를 선택해주세요.'); return; }
    const { checked } = this.checkedOrder();
    if (checked.length < 2) { this.onMessage('필드를 2개 이상 선택해주세요.'); return; }
    if (checked.length > MAX_TIME_SERIES_FIELDS) {
      this.onMessage(`필드는 ${MAX_TIME_SERIES_FIELDS}개까지만 고를 수 있습니다. (지금 ${checked.length}개)`);
      return;
    }

    const ramp = this.modal.querySelector('#ts-ramp').value;
    const derivedId = timeSeriesTool.apply({
      layerId: this.currentLayerId,
      fields: checked,
      method: this.modal.querySelector('#ts-method').value,
      numClasses: parseInt(this.modal.querySelector('#ts-classes').value, 10) || 5,
      colorRamp: ramp,
      reverse: this.modal.querySelector('#ts-reverse').checked,
      customColors: ramp === 'custom' ? this.customColors() : null
    });
    if (!derivedId) { this.onMessage('시계열 단계구분도 적용에 실패했습니다. 선택한 필드에 숫자 값이 없습니다.'); return; }
    this.close();
  }

  close() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const timeSeriesPanel = new TimeSeriesPanel();
