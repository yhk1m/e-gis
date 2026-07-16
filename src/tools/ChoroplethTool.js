/**
 * ChoroplethTool - 단계구분도 (주제도) 도구
 * 속성값에 따라 피처 색상을 다르게 표현
 */

import { Style, Fill, Stroke } from "ol/style";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { layerManager } from "../core/LayerManager.js";
import { eventBus, Events } from "../utils/EventBus.js";
import { makeDraggable } from "../utils/DraggableElement.js";
import { formatNumber } from "./legendModel.js";

// 색상 팔레트 정의
const COLOR_RAMPS = {
  blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
  greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"],
  reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#99000d"],
  oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#8c2d04"],
  purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#4a1486"],
  spectral: ["#3288bd", "#66c2a5", "#abdda4", "#e6f598", "#fee08b", "#fdae61", "#f46d43", "#d53e4f"],
  viridis: ["#440154", "#482878", "#3e4a89", "#31688e", "#26828e", "#1f9e89", "#35b779", "#6ece58"],
  warm: ["#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"]
};

const CLASSIFICATION_METHODS = {
  equalInterval: "동일 간격",
  quantile: "분위수",
  naturalBreaks: "자연 구분점"
};

class ChoroplethTool {
  constructor() {
    this.currentLayerId = null;
    this.currentAttribute = null;
    this.currentColorRamp = "blues";
    this.currentMethod = "equalInterval";
    this.numClasses = 5;
    this.legends = new Map();              // derivedLayerId -> legend element
    this.derivedBySource = new Map();      // sourceLayerId -> derivedLayerId
    this.sourceByDerived = new Map();      // derivedLayerId -> sourceLayerId

    // 레이어 삭제 이벤트 리스너
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      this.onLayerRemoved(data.layerId);
    });

    // 레이어 이름 변경 → 범례 제목 동기화
    eventBus.on(Events.LAYER_RENAMED, (data) => {
      if (data) this.onLayerRenamed(data.layerId, data.name);
    });
  }

  /**
   * 파생(단계구분도) 레이어 이름 변경 시 범례 제목을 새 이름으로 갱신.
   * cfg.title에도 반영해 재생성·저장/복원 후에도 유지된다.
   */
  onLayerRenamed(layerId, name) {
    const legendEl = this.legends.get(layerId);
    if (!legendEl) return;
    const titleEl = legendEl.querySelector('.choropleth-legend-title');
    if (titleEl && titleEl.textContent !== name) titleEl.textContent = name;
    const layerInfo = layerManager.getLayer(layerId);
    if (layerInfo && layerInfo._choroplethConfig) layerInfo._choroplethConfig.title = name;
  }

  /**
   * 레이어 삭제 시 정리
   * - 파생(단계구분도) 레이어 삭제: 범례 제거
   * - 원본 레이어 삭제: 연결된 파생 레이어도 함께 제거
   */
  onLayerRemoved(layerId) {
    if (this.sourceByDerived.has(layerId)) {
      const sourceId = this.sourceByDerived.get(layerId);
      this.sourceByDerived.delete(layerId);
      if (this.derivedBySource.get(sourceId) === layerId) {
        this.derivedBySource.delete(sourceId);
      }
      this.removeLegend(layerId);
      return;
    }
    if (this.derivedBySource.has(layerId)) {
      const derivedId = this.derivedBySource.get(layerId);
      this.derivedBySource.delete(layerId);
      this.sourceByDerived.delete(derivedId);
      layerManager.removeLayer(derivedId);
    }
    if (this.currentLayerId === layerId) {
      this.currentLayerId = null;
      this.currentAttribute = null;
    }
  }

  getNumericAttributes(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];
    const features = layerInfo.source.getFeatures();
    if (features.length === 0) return [];
    const firstFeature = features[0];
    const properties = firstFeature.getProperties();
    const numericAttrs = [];
    for (const key in properties) {
      if (key === "geometry") continue;
      const value = properties[key];
      if (typeof value === "number" || (typeof value === "string" && !isNaN(parseFloat(value)))) {
        numericAttrs.push(key);
      }
    }
    return numericAttrs;
  }

  getAttributeValues(layerId, attribute) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];
    const features = layerInfo.source.getFeatures();
    const values = [];
    features.forEach(feature => {
      const val = feature.get(attribute);
      if (val !== null && val !== undefined) {
        const num = parseFloat(val);
        if (!isNaN(num)) values.push(num);
      }
    });
    return values.sort((a, b) => a - b);
  }

  calculateBreaks(values, numClasses, method) {
    if (values.length === 0) return [];
    const min = values[0];
    const max = values[values.length - 1];
    if (method === "equalInterval") return this.equalIntervalBreaks(min, max, numClasses);
    if (method === "quantile") return this.quantileBreaks(values, numClasses);
    if (method === "naturalBreaks") return this.naturalBreaks(values, numClasses);
    return this.equalIntervalBreaks(min, max, numClasses);
  }

  equalIntervalBreaks(min, max, numClasses) {
    const breaks = [min];
    const interval = (max - min) / numClasses;
    for (let i = 1; i <= numClasses; i++) breaks.push(min + interval * i);
    return breaks;
  }

  quantileBreaks(values, numClasses) {
    const breaks = [values[0]];
    const step = values.length / numClasses;
    for (let i = 1; i <= numClasses; i++) {
      const idx = Math.min(Math.floor(step * i), values.length - 1);
      breaks.push(values[idx]);
    }
    return breaks;
  }

  naturalBreaks(values, numClasses) {
    if (values.length <= numClasses) return [...values, values[values.length - 1]];
    const breaks = [values[0]];
    const step = Math.floor(values.length / numClasses);
    for (let i = 1; i < numClasses; i++) {
      const idx = i * step;
      let breakPoint = values[idx];
      for (let j = idx; j < Math.min(idx + step, values.length - 1); j++) {
        if (values[j] !== values[j + 1]) {
          breakPoint = (values[j] + values[j + 1]) / 2;
          break;
        }
      }
      breaks.push(breakPoint);
    }
    breaks.push(values[values.length - 1]);
    return breaks;
  }

  getColorIndex(value, breaks) {
    for (let i = 0; i < breaks.length - 1; i++) {
      if (value <= breaks[i + 1]) return i;
    }
    return breaks.length - 2;
  }

  apply(layerId, attribute, colorRamp, method, numClasses, options = {}) {
    const { reverse = false, customColors = null } = options;

    const sourceLayer = layerManager.getLayer(layerId);
    if (!sourceLayer) return false;

    this.currentLayerId = layerId;
    this.currentAttribute = attribute;
    this.currentColorRamp = colorRamp;
    this.currentMethod = method;
    this.numClasses = numClasses;

    const values = this.getAttributeValues(layerId, attribute);
    if (values.length === 0) return false;
    const breaks = this.calculateBreaks(values, numClasses, method);

    // 커스텀 색상 또는 팔레트 색상 사용
    let colors;
    if (customColors && customColors.length >= 2) {
      colors = this.interpolateColors(customColors, numClasses);
    } else {
      const rampColors = COLOR_RAMPS[colorRamp] || COLOR_RAMPS.blues;
      const colorStep = Math.floor(rampColors.length / numClasses);
      colors = [];
      for (let i = 0; i < numClasses; i++) {
        const colorIdx = Math.min(i * colorStep + colorStep - 1, rampColors.length - 1);
        colors.push(rampColors[colorIdx]);
      }
    }

    // 색상 반전
    const selectedColors = reverse ? [...colors].reverse() : colors;

    const self = this;
    const styleFunction = function(feature) {
      const val = parseFloat(feature.get(attribute));
      if (isNaN(val)) {
        return new Style({
          fill: new Fill({ color: "rgba(128, 128, 128, 0.5)" }),
          stroke: new Stroke({ color: "#666", width: 1 })
        });
      }
      const colorIdx = self.getColorIndex(val, breaks);
      const color = selectedColors[colorIdx] || selectedColors[0];
      return new Style({
        fill: new Fill({ color: self.hexToRgba(color, 0.7) }),
        stroke: new Stroke({ color: self.darkenColor(color), width: 1 })
      });
    };

    // 같은 원본에서 만든 기존 파생 레이어 제거 (재적용 시 교체)
    if (this.derivedBySource.has(layerId)) {
      const prevDerivedId = this.derivedBySource.get(layerId);
      this.derivedBySource.delete(layerId);
      this.sourceByDerived.delete(prevDerivedId);
      layerManager.removeLayer(prevDerivedId);
    }

    // 피처 복제 → 새 벡터 레이어로 등록
    const clonedFeatures = sourceLayer.source.getFeatures().map(f => f.clone());
    const newSource = new VectorSource({ features: clonedFeatures });
    const newOlLayer = new VectorLayer({ source: newSource, style: styleFunction });

    const newLayerId = layerManager.addLayer({
      name: `${sourceLayer.name}_단계구분_${attribute}`,
      type: 'choropleth',
      geometryType: sourceLayer.geometryType,
      olLayer: newOlLayer,
      source: newSource,
      visible: true
    });

    this.derivedBySource.set(layerId, newLayerId);
    this.sourceByDerived.set(newLayerId, layerId);

    // 단계구분도 설정을 layerInfo에 저장 → LayerManager가 투명도 변경 시 재구성
    const newLayerInfo = layerManager.getLayer(newLayerId);
    if (newLayerInfo) {
      newLayerInfo._choroplethConfig = {
        attribute,
        breaks,
        colors: selectedColors,
        tool: this,
        title: `${sourceLayer.name} (${attribute})`,
        unit: '',
        format: 'comma',
        rounding: 0
      };
      newLayerInfo.fillOpacity = 0.7;
    }

    // 범례는 파생 레이어 기준으로 생성
    this.createLegend(newLayerId, sourceLayer.name, attribute, breaks, selectedColors);

    return { breaks, colors: selectedColors, layerId: newLayerId };
  }

  /**
   * 범례 생성
   */
  createLegend(layerId, layerName, attribute, breaks, colors) {
    this.removeLegend(layerId);

    const layerInfo = layerManager.getLayer(layerId);
    const cfg = (layerInfo && layerInfo._choroplethConfig) || {};
    const title = cfg.title !== undefined ? cfg.title : `${layerName} (${attribute})`;
    const unit = cfg.unit || '';
    const format = cfg.format || 'comma';
    const rounding = cfg.rounding || 0;

    const legendEl = document.createElement('div');
    legendEl.className = 'choropleth-legend';
    legendEl.id = `choropleth-legend-${layerId}`;

    const controlsHidden = !!cfg.controlsHidden;

    let html = `<div class="choropleth-legend-title" contenteditable="plaintext-only" spellcheck="false" data-field="title">${this.escapeHtml(title)}</div>`;
    html += '<div class="choropleth-legend-items"></div>';
    html += `<div class="choropleth-legend-settings${controlsHidden ? ' hidden' : ''}">`;
    html += `<div class="choropleth-legend-unit-row">
      <label>형식</label>
      <select class="choropleth-legend-format">
        <option value="comma">1,234,567</option>
        <option value="short">1.2K / 1.5M</option>
        <option value="decimal2">소수점 2자리</option>
      </select>
    </div>`;
    html += `<div class="choropleth-legend-unit-row">
      <label>반올림</label>
      <select class="choropleth-legend-rounding">
        <option value="0">자동</option>
        <option value="1">1의 자리</option>
        <option value="10">10의 자리</option>
        <option value="100">100의 자리</option>
        <option value="1000">1,000의 자리</option>
        <option value="10000">10,000의 자리</option>
        <option value="100000">100,000의 자리</option>
        <option value="1000000">1,000,000의 자리</option>
      </select>
    </div>`;
    html += `<div class="choropleth-legend-unit-row">
      <label>단위</label>
      <input type="text" class="choropleth-legend-unit" value="${this.escapeHtml(unit)}" placeholder="예: 원, 명, %">
    </div>`;
    html += `</div>`;
    html += `<button class="choropleth-legend-toggle" title="형식·반올림·단위 설정 접기/펼치기">${controlsHidden ? '▾ 설정 펼치기' : '▴ 설정 접기'}</button>`;
    legendEl.innerHTML = html;

    const formatSel = legendEl.querySelector('.choropleth-legend-format');
    if (formatSel) formatSel.value = format;
    const roundingSel = legendEl.querySelector('.choropleth-legend-rounding');
    if (roundingSel) roundingSel.value = String(rounding);

    this.renderLegendItems(legendEl, breaks, colors, unit, format, rounding);

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.appendChild(legendEl);
      this.legends.set(layerId, legendEl);
      makeDraggable(legendEl, () => mapContainer);
      this.attachLegendEditors(legendEl, layerId);
    }
  }

  renderLegendItems(legendEl, breaks, colors, unit, format, rounding = 0) {
    const itemsEl = legendEl.querySelector('.choropleth-legend-items');
    if (!itemsEl) return;
    let html = '';
    for (let i = 0; i < breaks.length - 1; i++) {
      const minVal = formatNumber(breaks[i], format, rounding);
      const maxVal = formatNumber(breaks[i + 1], format, rounding);
      const range = `${minVal} - ${maxVal}`;
      html += `
        <div class="choropleth-legend-item">
          <span class="choropleth-legend-color" style="background:${colors[i]}"></span>
          <span class="choropleth-legend-label">${range}${unit ? ' ' + this.escapeHtml(unit) : ''}</span>
        </div>`;
    }
    itemsEl.innerHTML = html;
  }

  escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  attachLegendEditors(legendEl, layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    const persist = () => {
      eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
    };

    // 형식·반올림·단위 설정 숨기기/표시 토글
    const toggleBtn = legendEl.querySelector('.choropleth-legend-toggle');
    const settingsEl = legendEl.querySelector('.choropleth-legend-settings');
    if (toggleBtn && settingsEl) {
      toggleBtn.addEventListener('click', () => {
        const hidden = settingsEl.classList.toggle('hidden');
        toggleBtn.textContent = hidden ? '▾ 설정 펼치기' : '▴ 설정 접기';
        if (layerInfo._choroplethConfig) layerInfo._choroplethConfig.controlsHidden = hidden;
        persist();
      });
    }

    legendEl.querySelectorAll('[contenteditable]').forEach(el => {
      el.addEventListener('input', () => {
        const field = el.getAttribute('data-field');
        if (!layerInfo._choroplethConfig) return;
        layerInfo._choroplethConfig[field] = el.textContent;
        persist();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      });
      // 제목 편집 완료 → 레이어 이름에 반영(양방향 동기화). 빈 값이면 이름 유지.
      el.addEventListener('blur', () => {
        if (el.getAttribute('data-field') !== 'title') return;
        const name = el.textContent.trim();
        if (name && name !== layerInfo.name) layerManager.renameLayer(layerId, name);
      });
    });

    const rerenderItems = () => {
      const cfg = layerInfo._choroplethConfig;
      if (!cfg) return;
      this.renderLegendItems(legendEl, cfg.breaks, cfg.colors, cfg.unit || '', cfg.format || 'comma', cfg.rounding || 0);
    };

    const unitInput = legendEl.querySelector('.choropleth-legend-unit');
    if (unitInput) {
      unitInput.addEventListener('input', () => {
        if (!layerInfo._choroplethConfig) return;
        layerInfo._choroplethConfig.unit = unitInput.value;
        rerenderItems();
        persist();
      });
    }

    const formatSel = legendEl.querySelector('.choropleth-legend-format');
    if (formatSel) {
      formatSel.addEventListener('change', () => {
        if (!layerInfo._choroplethConfig) return;
        layerInfo._choroplethConfig.format = formatSel.value;
        rerenderItems();
        persist();
      });
    }

    const roundingSel = legendEl.querySelector('.choropleth-legend-rounding');
    if (roundingSel) {
      roundingSel.addEventListener('change', () => {
        if (!layerInfo._choroplethConfig) return;
        layerInfo._choroplethConfig.rounding = parseFloat(roundingSel.value) || 0;
        rerenderItems();
        persist();
      });
    }
  }

  /**
   * 범례 제거
   */
  removeLegend(layerId) {
    const legendEl = this.legends.get(layerId);
    if (legendEl) {
      legendEl.remove();
      this.legends.delete(layerId);
    }
  }

  reset(layerId) {
    // 원본 layerId 또는 파생 layerId 모두 허용
    let sourceId = layerId;
    let derivedId = this.derivedBySource.get(layerId);
    if (!derivedId && this.sourceByDerived.has(layerId)) {
      derivedId = layerId;
      sourceId = this.sourceByDerived.get(layerId);
    }
    if (!derivedId) return;

    this.derivedBySource.delete(sourceId);
    this.sourceByDerived.delete(derivedId);
    this.removeLegend(derivedId);
    layerManager.removeLayer(derivedId);

    if (this.currentLayerId === sourceId) {
      this.currentLayerId = null;
      this.currentAttribute = null;
    }
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  darkenColor(hex) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
  }

  /**
   * 커스텀 색상 보간
   * @param {string[]} colors - 기준 색상 배열 (최소 2개)
   * @param {number} numClasses - 생성할 색상 수
   * @returns {string[]} 보간된 색상 배열
   */
  interpolateColors(colors, numClasses) {
    if (colors.length === 0) return [];
    if (colors.length === 1) return Array(numClasses).fill(colors[0]);
    if (numClasses <= colors.length) {
      // 색상 수가 충분하면 균등하게 선택
      const result = [];
      for (let i = 0; i < numClasses; i++) {
        const idx = Math.round(i * (colors.length - 1) / (numClasses - 1));
        result.push(colors[idx]);
      }
      return result;
    }

    // 색상 보간
    const result = [];
    for (let i = 0; i < numClasses; i++) {
      const t = i / (numClasses - 1);
      const segment = t * (colors.length - 1);
      const idx = Math.floor(segment);
      const localT = segment - idx;

      if (idx >= colors.length - 1) {
        result.push(colors[colors.length - 1]);
      } else {
        result.push(this.lerpColor(colors[idx], colors[idx + 1], localT));
      }
    }
    return result;
  }

  /**
   * 두 색상 사이 보간
   */
  lerpColor(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
  }

  getColorRamps() { return Object.keys(COLOR_RAMPS); }
  getColorRampColors(name) { return COLOR_RAMPS[name] || COLOR_RAMPS.blues; }
  getClassificationMethods() { return CLASSIFICATION_METHODS; }

  getLegendData(breaks, colors) {
    const legend = [];
    for (let i = 0; i < breaks.length - 1; i++) {
      legend.push({ min: breaks[i].toFixed(2), max: breaks[i + 1].toFixed(2), color: colors[i] });
    }
    return legend;
  }
}

export const choroplethTool = new ChoroplethTool();
