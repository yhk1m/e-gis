/**
 * ChartMapTool - 도형표현도 도구
 * 피처 위치에 파이/막대 그래프를 표시
 */

import Overlay from 'ol/Overlay';
import { getCenter } from 'ol/extent';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';

class ChartMapTool {
  constructor() {
    this.overlays = new Map(); // layerId -> overlay[]
    this.legends = new Map(); // layerId -> legend element
    this.colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
      '#f97316', '#14b8a6', '#a855f7', '#f43f5e'
    ];
  }

  /**
   * 도형표현도 생성
   */
  createChartMap(layerId, options) {
    const {
      chartType = 'pie', // 'pie' or 'bar'
      fields = [],       // 표시할 숫자 필드들
      sizeField = null,  // 크기 기준 필드 (없으면 고정 크기)
      minSize = 20,
      maxSize = 60,
      showLabels = false
    } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    // 기존 차트 제거
    this.removeChartMap(layerId);

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();
    const map = mapManager.getMap();

    if (features.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    // 크기 범위 계산
    let minValue = Infinity, maxValue = -Infinity;
    if (sizeField) {
      features.forEach(f => {
        const val = parseFloat(f.get(sizeField));
        if (!isNaN(val)) {
          minValue = Math.min(minValue, val);
          maxValue = Math.max(maxValue, val);
        }
      });
    }

    // 막대 차트용 전체 최대값 계산 (각 필드별)
    const globalMaxValues = {};
    if (chartType === 'bar') {
      fields.forEach(field => {
        let fieldMax = 0;
        features.forEach(f => {
          const val = parseFloat(f.get(field)) || 0;
          if (val > fieldMax) fieldMax = val;
        });
        globalMaxValues[field] = fieldMax;
      });
    }

    const overlays = [];

    features.forEach((feature, idx) => {
      // 피처 중심점 계산
      const geometry = feature.getGeometry();
      let center;

      if (geometry.getType() === 'Point') {
        center = geometry.getCoordinates();
      } else {
        center = getCenter(geometry.getExtent());
      }

      // 필드 값 추출
      const values = fields.map(f => parseFloat(feature.get(f)) || 0);
      const total = values.reduce((a, b) => a + b, 0);

      if (total === 0) return; // 값이 없으면 스킵

      // 크기 계산
      let size = (minSize + maxSize) / 2;
      if (sizeField && maxValue > minValue) {
        const sizeVal = parseFloat(feature.get(sizeField)) || 0;
        const ratio = (sizeVal - minValue) / (maxValue - minValue);
        size = minSize + ratio * (maxSize - minSize);
      }

      // 차트 요소 생성
      const chartEl = document.createElement('div');
      chartEl.className = 'chart-overlay';
      chartEl.style.width = size + 'px';
      chartEl.style.height = size + 'px';

      if (chartType === 'pie') {
        chartEl.innerHTML = this.createPieChart(values, fields, size);
      } else {
        // 막대 차트는 전체 최대값 기준으로 높이 계산
        const maxVals = fields.map(f => globalMaxValues[f]);
        chartEl.innerHTML = this.createBarChart(values, fields, size, maxVals);
      }

      // 오버레이 생성
      const overlay = new Overlay({
        element: chartEl,
        position: center,
        positioning: 'center-center',
        stopEvent: false
      });

      map.addOverlay(overlay);
      overlays.push(overlay);
    });

    this.overlays.set(layerId, overlays);

    // 범례 생성
    this.createLegend(layerId, layerInfo.name, chartType, fields, globalMaxValues);

    return {
      layerId,
      chartCount: overlays.length,
      chartType
    };
  }

  /**
   * 범례 생성
   */
  createLegend(layerId, layerName, chartType, fields, globalMaxValues) {
    // 기존 범례 제거
    this.removeLegend(layerId);

    const legendEl = document.createElement('div');
    legendEl.className = 'chart-map-legend';
    legendEl.id = `chart-legend-${layerId}`;

    let legendHTML = `<div class="chart-legend-title">${layerName} - ${chartType === 'pie' ? '파이' : '막대'} 차트</div>`;
    legendHTML += '<div class="chart-legend-items">';

    fields.forEach((field, i) => {
      const color = this.colors[i % this.colors.length];
      let label = field;

      // 막대 차트인 경우 최대값 표시
      if (chartType === 'bar' && globalMaxValues && globalMaxValues[field]) {
        const maxVal = globalMaxValues[field];
        label += ` (최대: ${this.formatNumber(maxVal)})`;
      }

      legendHTML += `
        <div class="chart-legend-item">
          <span class="chart-legend-color" style="background:${color}"></span>
          <span class="chart-legend-label">${label}</span>
        </div>`;
    });

    legendHTML += '</div>';
    legendEl.innerHTML = legendHTML;

    // 지도 컨테이너에 추가
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
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
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

  /**
   * 파이 차트 SVG 생성
   */
  createPieChart(values, fields, size) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return '';

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    let paths = '';
    let startAngle = -Math.PI / 2;

    values.forEach((value, i) => {
      if (value <= 0) return;

      const angle = (value / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z"
                fill="${this.colors[i % this.colors.length]}"
                stroke="white" stroke-width="1"/>`;

      startAngle = endAngle;
    });

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
  }

  /**
   * 막대 차트 SVG 생성
   * @param {number[]} values - 각 필드의 값
   * @param {string[]} fields - 필드 이름 목록
   * @param {number} size - 차트 크기
   * @param {number[]} globalMaxValues - 각 필드의 전체 최대값 (선택)
   */
  createBarChart(values, fields, size, globalMaxValues = null) {
    // 전체 최대값이 제공되면 그것을 사용, 아니면 현재 값 중 최대값 사용
    const maxVals = globalMaxValues || values.map(() => Math.max(...values));
    const overallMax = Math.max(...maxVals);
    if (overallMax === 0) return '';

    // 막대 너비를 절반으로 줄이고 중앙 정렬
    const totalBarWidth = size / 2;
    const barWidth = totalBarWidth / values.length;
    const offsetX = (size - totalBarWidth) / 2;
    const maxHeight = size - 4;

    let bars = '';
    values.forEach((value, i) => {
      // 각 막대는 해당 필드의 전체 최대값 기준으로 높이 계산
      const fieldMax = globalMaxValues ? globalMaxValues[i] : overallMax;
      const height = fieldMax > 0 ? (value / fieldMax) * maxHeight : 0;
      const x = offsetX + i * barWidth;
      const y = size - height - 2;

      bars += `<rect x="${x + 1}" y="${y}" width="${barWidth - 2}" height="${height}"
               fill="${this.colors[i % this.colors.length]}"
               stroke="white" stroke-width="0.5"/>`;
    });

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="0" y="0" width="${size}" height="${size}" fill="rgba(255,255,255,0.8)" rx="2"/>
      ${bars}
    </svg>`;
  }

  /**
   * 도형표현도 제거
   */
  removeChartMap(layerId) {
    const overlays = this.overlays.get(layerId);
    if (overlays) {
      const map = mapManager.getMap();
      overlays.forEach(overlay => {
        map.removeOverlay(overlay);
      });
      this.overlays.delete(layerId);
    }

    // 범례도 제거
    this.removeLegend(layerId);
  }

  /**
   * 모든 도형표현도 제거
   */
  clearAll() {
    const map = mapManager.getMap();
    this.overlays.forEach((overlays) => {
      overlays.forEach(overlay => {
        map.removeOverlay(overlay);
      });
    });
    this.overlays.clear();

    // 모든 범례 제거
    this.legends.forEach((legendEl) => {
      legendEl.remove();
    });
    this.legends.clear();
  }

  /**
   * 폴리곤/포인트 레이어 목록 가져오기
   */
  getCompatibleLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.geometryType && layer.type !== 'heatmap';
    });
  }

  /**
   * 숫자 필드 목록 가져오기
   */
  getNumericFields(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();
    if (features.length === 0) return [];

    const props = features[0].getProperties();
    const numericFields = [];

    for (const key in props) {
      if (key === 'geometry') continue;
      if (typeof props[key] === 'number') {
        numericFields.push(key);
      }
    }

    return numericFields;
  }

  /**
   * 색상 팔레트 가져오기
   */
  getColors() {
    return this.colors;
  }
}

export const chartMapTool = new ChartMapTool();
