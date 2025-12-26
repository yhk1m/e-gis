/**
 * ChoroplethPanel - 단계구분도 설정 패널
 */

import { choroplethTool } from "../../tools/ChoroplethTool.js";
import { layerManager } from "../../core/LayerManager.js";
import { eventBus, Events } from "../../utils/EventBus.js";

class ChoroplethPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
    this.legendData = null;
  }

  show(layerId) {
    if (!layerId) {
      layerId = layerManager.getSelectedLayerId();
    }
    if (!layerId) {
      alert("먼저 레이어를 선택해주세요.");
      return;
    }

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    this.currentLayerId = layerId;
    this.render(layerInfo);
  }

  render(layerInfo) {
    this.close();

    const attributes = choroplethTool.getNumericAttributes(this.currentLayerId);
    const colorRamps = choroplethTool.getColorRamps();
    const methods = choroplethTool.getClassificationMethods();

    if (attributes.length === 0) {
      alert("이 레이어에는 숫자형 속성이 없습니다.");
      return;
    }

    this.modal = document.createElement("div");
    this.modal.className = "choropleth-modal";
    this.modal.innerHTML = this.getModalHTML(layerInfo.name, attributes, colorRamps, methods);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateColorRampPreview();
  }

  getModalHTML(layerName, attributes, colorRamps, methods) {
    const attrOptions = attributes.map(a => '<option value="' + a + '">' + a + '</option>').join("");
    const rampOptions = colorRamps.map(r => '<option value="' + r + '">' + r + '</option>').join("");
    const methodOptions = Object.entries(methods).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join("");

    return '<div class="choropleth-content">' +
      '<div class="choropleth-header">' +
        '<h3>단계구분도 설정</h3>' +
        '<button class="choropleth-close" id="choropleth-close">&times;</button>' +
      '</div>' +
      '<div class="choropleth-body">' +
        '<div class="choropleth-form-group">' +
          '<label>레이어</label>' +
          '<div class="choropleth-layer-name">' + layerName + '</div>' +
        '</div>' +
        '<div class="choropleth-form-group">' +
          '<label for="choropleth-attr">속성 필드</label>' +
          '<select id="choropleth-attr">' + attrOptions + '</select>' +
        '</div>' +
        '<div class="choropleth-form-group">' +
          '<label for="choropleth-ramp">색상 팔레트</label>' +
          '<select id="choropleth-ramp">' + rampOptions + '<option value="custom">커스텀</option></select>' +
          '<div class="color-ramp-preview-container">' +
            '<div id="color-ramp-preview" class="color-ramp-preview"></div>' +
            '<div class="color-ramp-preview-labels">' +
              '<span>낮음</span>' +
              '<span>높음</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="choropleth-form-group choropleth-reverse-group">' +
          '<label class="checkbox-label">' +
            '<input type="checkbox" id="choropleth-reverse">' +
            '<span>색상 반전 (높은 값 → 낮은 색상)</span>' +
          '</label>' +
        '</div>' +
        '<div class="choropleth-form-group custom-colors-group" id="custom-colors-group" style="display:none;">' +
          '<label>커스텀 색상 (시작 → 끝)</label>' +
          '<div class="custom-color-inputs" id="custom-color-inputs">' +
            '<input type="color" class="custom-color-input" value="#ffffcc">' +
            '<input type="color" class="custom-color-input" value="#fd8d3c">' +
            '<input type="color" class="custom-color-input" value="#800026">' +
          '</div>' +
          '<div class="custom-color-actions">' +
            '<button type="button" class="btn btn-sm" id="add-color-btn">+ 색상 추가</button>' +
            '<button type="button" class="btn btn-sm" id="remove-color-btn">- 색상 제거</button>' +
          '</div>' +
        '</div>' +
        '<div class="choropleth-form-group">' +
          '<label for="choropleth-method">분류 방법</label>' +
          '<select id="choropleth-method">' + methodOptions + '</select>' +
        '</div>' +
        '<div class="choropleth-form-group">' +
          '<label for="choropleth-classes">분류 수</label>' +
          '<input type="range" id="choropleth-classes" min="3" max="8" value="5">' +
          '<span id="classes-value">5</span>' +
        '</div>' +
        '<div id="choropleth-legend" class="choropleth-preview-legend"></div>' +
      '</div>' +
      '<div class="choropleth-footer">' +
        '<button class="btn btn-secondary" id="choropleth-reset">초기화</button>' +
        '<button class="btn btn-primary" id="choropleth-apply">적용</button>' +
        '<button class="btn btn-primary" id="choropleth-ok">확인</button>' +
      '</div>' +
    '</div>';
  }

  bindEvents() {
    const closeBtn = document.getElementById("choropleth-close");
    const applyBtn = document.getElementById("choropleth-apply");
    const okBtn = document.getElementById("choropleth-ok");
    const resetBtn = document.getElementById("choropleth-reset");
    const rampSelect = document.getElementById("choropleth-ramp");
    const classesSlider = document.getElementById("choropleth-classes");
    const classesValue = document.getElementById("classes-value");
    const reverseCheckbox = document.getElementById("choropleth-reverse");
    const addColorBtn = document.getElementById("add-color-btn");
    const removeColorBtn = document.getElementById("remove-color-btn");

    closeBtn.addEventListener("click", () => this.close());
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.close();
    });

    applyBtn.addEventListener("click", () => this.apply());
    okBtn.addEventListener("click", () => {
      this.apply();
      this.close();
    });
    resetBtn.addEventListener("click", () => this.reset());

    rampSelect.addEventListener("change", () => {
      this.toggleCustomColors();
      this.updateColorRampPreview();
    });

    reverseCheckbox.addEventListener("change", () => this.updateColorRampPreview());

    classesSlider.addEventListener("input", () => {
      classesValue.textContent = classesSlider.value;
    });

    addColorBtn.addEventListener("click", () => this.addCustomColor());
    removeColorBtn.addEventListener("click", () => this.removeCustomColor());

    // 초기 커스텀 색상 입력에 이벤트 리스너 추가
    document.querySelectorAll("#custom-color-inputs .custom-color-input").forEach(input => {
      input.addEventListener("input", () => this.updateColorRampPreview());
    });
  }

  toggleCustomColors() {
    const rampSelect = document.getElementById("choropleth-ramp");
    const customGroup = document.getElementById("custom-colors-group");
    customGroup.style.display = rampSelect.value === "custom" ? "block" : "none";
  }

  addCustomColor() {
    const container = document.getElementById("custom-color-inputs");
    const inputs = container.querySelectorAll(".custom-color-input");
    if (inputs.length >= 8) return; // 최대 8개

    const newInput = document.createElement("input");
    newInput.type = "color";
    newInput.className = "custom-color-input";
    newInput.value = "#ff0000";
    newInput.addEventListener("input", () => this.updateColorRampPreview());
    container.appendChild(newInput);
    this.updateColorRampPreview();
  }

  removeCustomColor() {
    const container = document.getElementById("custom-color-inputs");
    const inputs = container.querySelectorAll(".custom-color-input");
    if (inputs.length <= 2) return; // 최소 2개

    container.removeChild(inputs[inputs.length - 1]);
    this.updateColorRampPreview();
  }

  getCustomColors() {
    const inputs = document.querySelectorAll("#custom-color-inputs .custom-color-input");
    return Array.from(inputs).map(input => input.value);
  }

  updateColorRampPreview() {
    const ramp = document.getElementById("choropleth-ramp").value;
    const reverse = document.getElementById("choropleth-reverse").checked;
    const preview = document.getElementById("color-ramp-preview");

    let colors;
    if (ramp === "custom") {
      colors = this.getCustomColors();
    } else {
      colors = choroplethTool.getColorRampColors(ramp);
    }

    // 반전 적용
    const displayColors = reverse ? [...colors].reverse() : colors;

    preview.innerHTML = displayColors.map(c => '<div class="color-ramp-item" style="background:' + c + '"></div>').join("");
  }

  apply() {
    const attribute = document.getElementById("choropleth-attr").value;
    const colorRamp = document.getElementById("choropleth-ramp").value;
    const method = document.getElementById("choropleth-method").value;
    const numClasses = parseInt(document.getElementById("choropleth-classes").value);
    const reverse = document.getElementById("choropleth-reverse").checked;

    const options = { reverse };

    // 커스텀 색상 사용시
    if (colorRamp === "custom") {
      options.customColors = this.getCustomColors();
    }

    const result = choroplethTool.apply(this.currentLayerId, attribute, colorRamp, method, numClasses, options);

    if (result) {
      this.legendData = choroplethTool.getLegendData(result.breaks, result.colors);
      this.renderLegend();
    } else {
      alert("단계구분도 적용에 실패했습니다.");
    }
  }

  renderLegend() {
    const legendEl = document.getElementById("choropleth-legend");
    if (!this.legendData || this.legendData.length === 0) {
      legendEl.innerHTML = "";
      return;
    }

    const attr = document.getElementById("choropleth-attr").value;
    let html = '<div class="legend-title">' + attr + ' 범례</div>';
    html += '<div class="legend-items">';

    this.legendData.forEach(item => {
      html += '<div class="legend-item">' +
        '<div class="legend-color" style="background:' + item.color + '"></div>' +
        '<div class="legend-range">' + item.min + ' ~ ' + item.max + '</div>' +
      '</div>';
    });

    html += '</div>';
    legendEl.innerHTML = html;
  }

  reset() {
    choroplethTool.reset(this.currentLayerId);
    document.getElementById("choropleth-legend").innerHTML = "";
    this.legendData = null;
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const choroplethPanel = new ChoroplethPanel();
