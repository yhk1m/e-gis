/**
 * ChoroplethTool - 단계구분도 (주제도) 도구
 * 속성값에 따라 피처 색상을 다르게 표현
 */

import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { layerManager } from "../core/LayerManager.js";
import { eventBus, Events } from "../utils/EventBus.js";
import { makeDraggable } from "../utils/DraggableElement.js";
import { isVectorLayer, collectNumericFields } from "../utils/layerSelect.js";
import { sampleColorRamp, lerpColor } from "../utils/colorRamp.js";
import { formatNumber } from "./legendModel.js";
import { syncLegendVisibility } from "./legendVisibility.js";
import { fillFor, tileDataUrl, onFillAssetsReady } from "./classFillCanvas.js";
import { normalizeFill, isSolid } from "./classFill.js";

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

    /** 범례 색 칸 클릭 훅 — labs/classFillBinding 이 실험이 켜졌을 때 심는다. null 이면 아무 일도 없다. */
    this.onLegendColorClick = null;

    // 이미지 채움 디코딩이 끝나면 그 이미지를 쓰는 레이어를 다시 그린다 (fillFor 는 동기라 기다릴 수 없다)
    onFillAssetsReady(() => {
      layerManager.getAllLayers().forEach((l) => {
        const fills = l._choroplethConfig && l._choroplethConfig.fills;
        if (fills && fills.some((f) => f && f.kind === 'image')) this.restyle(l.id);
      });
    });

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

  /**
   * 단계구분도를 적용할 수 있는 레이어 목록 (숫자형 속성이 있는 벡터 레이어)
   */
  getCompatibleLayers() {
    return layerManager.getAllLayers().filter(
      layer => isVectorLayer(layer) && this.getNumericAttributes(layer.id).length > 0
    );
  }

  getNumericAttributes(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.source) return [];
    return collectNumericFields(layerInfo.source.getFeatures());
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
      colors = this.sampleColorRamp(rampColors, numClasses);
    }

    // 색상 반전
    const selectedColors = reverse ? [...colors].reverse() : colors;

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
    const newOlLayer = new VectorLayer({ source: newSource });

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

    // 단계구분도 설정을 layerInfo에 심는다. 스타일 함수는 LayerManager.updateLayerStyle 한 곳이
    // 만든다(투명도·테두리·구간 채움이 모두 거기서 나온다).
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
      newLayerInfo.strokeWidth = 1;   // 예전 apply 의 스타일 함수와 같은 두께 (addLayer 기본은 2)
      layerManager.updateLayerStyle(newLayerId);
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

    this.renderLegendItems(legendEl, breaks, colors, unit, format, rounding, cfg.fills || null);

    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.appendChild(legendEl);
      this.legends.set(layerId, legendEl);
      makeDraggable(legendEl, () => mapContainer);
      this.attachLegendEditors(legendEl, layerId);
      // 복원처럼 숨긴 레이어의 범례를 만들 때도 레이어 가시성을 따른다
      syncLegendVisibility(layerId);
    }
  }

  /**
   * 범례 항목(색 칸 + 구간 라벨)을 그린다.
   * 색 칸은 data-class="i" 를 달고, 채움이 단색이 아니면 24px 패턴 타일을 배경 이미지로 깐다
   * (타일을 못 만들면 — 캔버스 없음·이미지 디코딩 전 — 기준색만 칠한다).
   */
  renderLegendItems(legendEl, breaks, colors, unit, format, rounding = 0, fills = null) {
    const itemsEl = legendEl.querySelector('.choropleth-legend-items');
    if (!itemsEl) return;
    let html = '';
    for (let i = 0; i < breaks.length - 1; i++) {
      const minVal = formatNumber(breaks[i], format, rounding);
      const maxVal = formatNumber(breaks[i + 1], format, rounding);
      const range = `${minVal} - ${maxVal}`;
      const fill = fills ? fills[i] : null;
      const tile = isSolid(fill) ? null : tileDataUrl(fill, colors[i], 24);
      const style = swatchStyle(fill, colors[i], tile);
      html += `
        <div class="choropleth-legend-item">
          <span class="choropleth-legend-color" data-class="${i}" style="${style}"></span>
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

    // 색 칸 클릭 → 훅. 항목이 다시 그려져도 살아 있도록 컨테이너에 위임한다.
    // 실험 켜짐 여부는 훅을 심는 쪽(labs 바인딩)이 판단한다 — 여기서는 labs 를 모른다.
    const itemsEl = legendEl.querySelector('.choropleth-legend-items');
    if (itemsEl) {
      itemsEl.addEventListener('click', (e) => {
        const swatch = e.target.closest && e.target.closest('.choropleth-legend-color');
        if (!swatch || typeof this.onLegendColorClick !== 'function') return;
        this.onLegendColorClick({ layerId, classIndex: Number(swatch.dataset.class), anchor: swatch });
      });
    }

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

    const rerenderItems = () => this.refreshLegendItems(layerId);

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

  /** 레이어의 단계구분도 설정 (없으면 null) */
  configOf(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    return (layerInfo && layerInfo._choroplethConfig) || null;
  }

  /** 범례 항목만 설정대로 다시 그린다 */
  refreshLegendItems(layerId) {
    const legendEl = this.legends.get(layerId);
    const cfg = this.configOf(layerId);
    if (!legendEl || !cfg) return;
    this.renderLegendItems(legendEl, cfg.breaks, cfg.colors, cfg.unit || '', cfg.format || 'comma', cfg.rounding || 0, cfg.fills || null);
  }

  /** 스타일 함수 재구성(LAYER_STYLE_CHANGED 발행 포함) + 범례 갱신 */
  restyle(layerId) {
    layerManager.updateLayerStyle(layerId);
    this.refreshLegendItems(layerId);
  }

  /**
   * 구간 하나의 채움 사양을 바꾼다 (실험 class-fill).
   * 전부 단색이면 fills 키를 지워 저장본을 예전 모양으로 되돌린다.
   * @returns {boolean}
   */
  setClassFill(layerId, classIndex, spec) {
    const cfg = this.configOf(layerId);
    if (!cfg || !Number.isInteger(classIndex) || classIndex < 0 || classIndex >= cfg.colors.length) return false;
    const fills = cfg.fills ? cfg.fills.slice() : cfg.colors.map(() => ({ kind: 'solid' }));
    fills[classIndex] = normalizeFill(spec);
    if (fills.every(isSolid)) delete cfg.fills;
    else cfg.fills = fills;
    this.restyle(layerId);
    return true;
  }

  /** 구간 하나의 기준색을 바꾼다. colors 는 새 배열로(복제본과 공유하지 않게). */
  setClassColor(layerId, classIndex, hex) {
    const cfg = this.configOf(layerId);
    if (!cfg || !/^#[0-9a-fA-F]{6}$/.test(String(hex)) || !Number.isInteger(classIndex) || classIndex < 0 || classIndex >= cfg.colors.length) return false;
    const colors = cfg.colors.slice();
    colors[classIndex] = hex.toLowerCase();
    cfg.colors = colors;
    this.restyle(layerId);
    return true;
  }

  /** 모든 구간의 채움을 한꺼번에 (프리셋). null 이면 팔레트로 되돌린다. */
  setAllFills(layerId, fills) {
    const cfg = this.configOf(layerId);
    if (!cfg) return false;
    if (!Array.isArray(fills) || fills.every(isSolid)) delete cfg.fills;
    else cfg.fills = cfg.colors.map((_, i) => normalizeFill(fills[i]));
    this.restyle(layerId);
    return true;
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
   * 구간 하나의 채움 — LayerManager.updateLayerStyle 이 Fill.color 에 넣는다.
   * fills 가 없으면 지금처럼 rgba 문자열, 있으면 CanvasPattern(실험 class-fill).
   */
  classFillColor(cfg, classIndex, fillOpacity) {
    const base = cfg.colors[classIndex] || cfg.colors[0];
    // OL 은 벡터 캔버스를 기기 픽셀로 그리고 CanvasPattern 을 pixelRatio 로 키우지 않는다.
    // 타일을 DPR 배로 만들어야 화면 무늬가 범례·내보내기(CSS px 기준)와 같은 크기가 된다.
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    return fillFor(cfg.fills ? cfg.fills[classIndex] : undefined, base, fillOpacity, dpr);
  }

  /**
   * 팔레트에서 분류 수만큼 색을 고르게 뽑는다.
   *
   * 팔레트의 양 끝(가장 옅은 색 = 낮음, 가장 진한 색 = 높음)을 반드시 포함하고
   * 그 사이를 균등 보간한다. 예전에는 앞에서부터 한 칸씩 잘라 써서 분류 수가
   * 적으면 진한 쪽 색이 아예 안 나왔다(5분류 → 8색 중 앞 5색 언저리만 사용).
   *
   * @param {string[]} rampColors - 팔레트 색상 (낮음 → 높음 순)
   * @param {number} numClasses - 분류 수
   * @returns {string[]} 분류 수만큼의 색상
   */
  sampleColorRamp(rampColors, numClasses) {
    return sampleColorRamp(rampColors, numClasses);
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
    return lerpColor(color1, color2, t);
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

/**
 * 범례 색 칸의 인라인 스타일. 지도(planFill)의 배경 규칙을 그대로 따른다:
 * 패턴의 배경이 '없음'이면 구간 색을 깔지 않아 타일 아래가 비치고(지도에선 배경지도가 비친다),
 * 타일을 못 만들었을 때는 지도의 fallback 과 같이 — 없음이면 투명, 그 밖에는 구간 색.
 * @param {Object|null} fill  채움 사양(정규화 전이어도 됨)
 * @param {string} color      구간 색
 * @param {string|null} tileUrl  tileDataUrl 결과
 * @returns {string}
 */
export function swatchStyle(fill, color, tileUrl) {
  if (isSolid(fill)) return `background:${color}`;
  const f = normalizeFill(fill);
  const noBg = (f.kind === 'hatch' || f.kind === 'dots' || f.kind === 'cross') && f.background === 'none';
  if (!tileUrl) return `background:${noBg ? 'transparent' : color}`;
  return `background-color:${noBg ? 'transparent' : color};background-image:url(${tileUrl})`;
}

export const choroplethTool = new ChoroplethTool();
