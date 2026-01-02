/**
 * ChoroplethTool - 단계구분도 (주제도) 도구
 * 속성값에 따라 피처 색상을 다르게 표현
 */

import { Style, Fill, Stroke } from "ol/style";
import { layerManager } from "../core/LayerManager.js";
import { eventBus, Events } from "../utils/EventBus.js";

// 색상 팔레트 정의
const COLOR_RAMPS = {
  blues: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
  greens: ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"],
  reds: ["#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#99000d"],
  oranges: ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#f16913", "#d94801", "#8c2d04"],
  purples: ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#4a1486"],
  spectral: ["#d53e4f", "#f46d43", "#fdae61", "#fee08b", "#e6f598", "#abdda4", "#66c2a5", "#3288bd"],
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
    this.originalStyles = new Map();
    this.legends = new Map();

    // 레이어 삭제 이벤트 리스너
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      this.onLayerRemoved(data.layerId);
    });
  }

  /**
   * 레이어 삭제 시 범례 제거
   */
  onLayerRemoved(layerId) {
    this.removeLegend(layerId);
    this.originalStyles.delete(layerId);
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

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return false;
    if (!this.originalStyles.has(layerId)) {
      this.originalStyles.set(layerId, layerInfo.olLayer.getStyle());
    }
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

    layerInfo.olLayer.setStyle(styleFunction);
    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });

    // 범례 생성
    this.createLegend(layerId, layerInfo.name, attribute, breaks, selectedColors);

    return { breaks, colors: selectedColors };
  }

  /**
   * 범례 생성
   */
  createLegend(layerId, layerName, attribute, breaks, colors) {
    this.removeLegend(layerId);

    const legendEl = document.createElement('div');
    legendEl.className = 'choropleth-legend';
    legendEl.id = `choropleth-legend-${layerId}`;

    let legendHTML = `<div class="choropleth-legend-title">${layerName}</div>`;
    legendHTML += `<div class="choropleth-legend-subtitle">${attribute}</div>`;
    legendHTML += '<div class="choropleth-legend-items">';

    for (let i = 0; i < breaks.length - 1; i++) {
      const minVal = this.formatNumber(breaks[i]);
      const maxVal = this.formatNumber(breaks[i + 1]);
      legendHTML += `
        <div class="choropleth-legend-item">
          <span class="choropleth-legend-color" style="background:${colors[i]}"></span>
          <span class="choropleth-legend-label">${minVal} - ${maxVal}</span>
        </div>`;
    }

    legendHTML += '</div>';
    legendEl.innerHTML = legendHTML;

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.appendChild(legendEl);
      this.legends.set(layerId, legendEl);
    }
  }

  /**
   * 숫자 포맷
   */
  formatNumber(num) {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2);
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
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    if (this.originalStyles.has(layerId)) {
      layerInfo.olLayer.setStyle(this.originalStyles.get(layerId));
      this.originalStyles.delete(layerId);
    }
    if (this.currentLayerId === layerId) {
      this.currentLayerId = null;
      this.currentAttribute = null;
    }
    // 범례 제거
    this.removeLegend(layerId);
    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
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
