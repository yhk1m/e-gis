/**
 * ChartMapTool - 도형표현도 도구
 * 피처 위치에 파이/막대 그래프를 표시
 */

import Overlay from 'ol/Overlay';
import { getCenter } from 'ol/extent';
import { fromLonLat } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import * as turf from '@turf/turf';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { makeDraggable } from '../utils/DraggableElement.js';

class ChartMapTool {
  constructor() {
    this.overlays = new Map();          // derivedLayerId -> overlay[]
    this.legends = new Map();           // derivedLayerId -> legend element
    this.derivedBySource = new Map();   // sourceLayerId -> derivedLayerId
    this.sourceByDerived = new Map();   // derivedLayerId -> sourceLayerId
    this.geoJSONFormat = new GeoJSON(); // 무게중심 계산용 (OL ↔ turf)
    this.colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
      '#f97316', '#14b8a6', '#a855f7', '#f43f5e'
    ];

    this.initEventListeners();
  }

  /**
   * 이벤트 리스너 초기화
   * - 파생 레이어 삭제: 오버레이/범례 제거
   * - 원본 레이어 삭제: 연결된 파생 레이어도 제거
   * - 파생 레이어 가시성 토글: 오버레이 표시/숨김
   */
  initEventListeners() {
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      if (!data || !data.layerId) return;
      const { layerId } = data;

      if (this.sourceByDerived.has(layerId)) {
        // 파생 레이어가 삭제됨 → 오버레이 정리
        const sourceId = this.sourceByDerived.get(layerId);
        this.sourceByDerived.delete(layerId);
        if (this.derivedBySource.get(sourceId) === layerId) {
          this.derivedBySource.delete(sourceId);
        }
        this.cleanupOverlays(layerId);
      } else if (this.derivedBySource.has(layerId)) {
        // 원본이 삭제됨 → 파생 레이어도 제거
        const derivedId = this.derivedBySource.get(layerId);
        this.derivedBySource.delete(layerId);
        this.sourceByDerived.delete(derivedId);
        layerManager.removeLayer(derivedId);
      }
    });

    eventBus.on(Events.LAYER_VISIBILITY_CHANGED, (data) => {
      if (!data || !data.layerId) return;
      const overlays = this.overlays.get(data.layerId);
      if (overlays) {
        overlays.forEach(o => {
          const el = o.getElement();
          if (el) el.style.display = data.visible ? '' : 'none';
        });
      }
    });
  }

  cleanupOverlays(derivedLayerId) {
    const overlays = this.overlays.get(derivedLayerId);
    if (overlays) {
      const map = mapManager.getMap();
      overlays.forEach(o => map && map.removeOverlay(o));
      this.overlays.delete(derivedLayerId);
    }
    this.removeLegend(derivedLayerId);
  }

  /**
   * 도형표현도 생성
   */
  createChartMap(layerId, options) {
    const config = {
      chartType: options.chartType || 'pie', // 'pie' | 'bar' | '100bar'
      fields: options.fields || [],          // 표시할 숫자 필드들
      sizeField: options.sizeField || null,  // 크기 기준 필드 (없으면 고정 크기)
      minSize: options.minSize !== undefined ? options.minSize : 20,
      maxSize: options.maxSize !== undefined ? options.maxSize : 60,
      showLabels: options.showLabels || false
    };

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error('레이어를 찾을 수 없습니다.');
    }

    const features = layerInfo.olLayer.getSource().getFeatures();
    if (features.length === 0) {
      throw new Error('레이어에 피처가 없습니다.');
    }

    // 같은 원본에서 만든 기존 파생 레이어 제거 (재적용 시 교체)
    this.removeChartMap(layerId);

    // 파생 레이어 등록 (가시성/삭제 제어용 placeholder)
    const placeholderSource = new VectorSource();
    const placeholderLayer = new VectorLayer({ source: placeholderSource });

    const derivedLayerId = layerManager.addLayer({
      name: `${layerInfo.name}_도형표현_${this.getChartTypeLabel(config.chartType)}`,
      type: 'chartmap',
      geometryType: 'Point',
      olLayer: placeholderLayer,
      source: placeholderSource,
      visible: true
    });

    // 설정을 파생 레이어에 보관 (복원용 직렬화 대상)
    const derivedLayer = layerManager.getLayer(derivedLayerId);
    if (derivedLayer) {
      derivedLayer._chartMapConfig = { sourceLayerId: layerId, ...config };
    }

    this.derivedBySource.set(layerId, derivedLayerId);
    this.sourceByDerived.set(derivedLayerId, layerId);

    // 오버레이/범례 렌더링
    const chartCount = this.renderChartMap(derivedLayerId, layerId, config);

    return {
      layerId: derivedLayerId,
      sourceLayerId: layerId,
      chartCount,
      chartType: config.chartType
    };
  }

  /**
   * 저장된 도형표현도 복원 (파생 레이어는 이미 추가된 상태)
   * @param {string} derivedLayerId - 복원된 파생 레이어 ID
   * @param {string} sourceLayerId - 원본 레이어 ID
   * @param {object} config - 저장된 차트 설정
   */
  restoreChartMap(derivedLayerId, sourceLayerId, config) {
    const sourceInfo = layerManager.getLayer(sourceLayerId);
    if (!sourceInfo) return 0; // 원본이 없으면 복원 불가

    const derivedLayer = layerManager.getLayer(derivedLayerId);
    if (derivedLayer) {
      derivedLayer._chartMapConfig = { sourceLayerId, ...config };
    }

    this.derivedBySource.set(sourceLayerId, derivedLayerId);
    this.sourceByDerived.set(derivedLayerId, sourceLayerId);

    return this.renderChartMap(derivedLayerId, sourceLayerId, config);
  }

  /**
   * 차트 오버레이 + 범례 렌더링 (생성/복원 공통)
   * @returns {number} 생성된 차트 수
   */
  renderChartMap(derivedLayerId, sourceLayerId, config) {
    const { chartType, fields, sizeField, minSize, maxSize } = config;

    const sourceInfo = layerManager.getLayer(sourceLayerId);
    if (!sourceInfo) return 0;

    const features = sourceInfo.olLayer.getSource().getFeatures();
    const map = mapManager.getMap();

    // 기존 오버레이가 있으면 정리 (재렌더 대비)
    this.cleanupOverlays(derivedLayerId);

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

    features.forEach((feature) => {
      // 피처 위치 계산 (폴리곤은 무게중심)
      const center = this.getChartPosition(feature);

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
      } else if (chartType === '100bar') {
        // 100% 누적 막대: 피처별 합계를 100%로 정규화
        chartEl.innerHTML = this.createStackedBar100Chart(values, fields, size);
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

    this.overlays.set(derivedLayerId, overlays);

    // 범례 생성 (파생 레이어 기준)
    this.createLegend(derivedLayerId, sourceInfo.name, chartType, fields, globalMaxValues);

    // 파생 레이어가 숨김 상태면 오버레이·범례도 숨김
    const derivedLayer = layerManager.getLayer(derivedLayerId);
    if (derivedLayer && derivedLayer.visible === false) {
      overlays.forEach(o => {
        const el = o.getElement();
        if (el) el.style.display = 'none';
      });
      const legendEl = this.legends.get(derivedLayerId);
      if (legendEl) legendEl.style.display = 'none';
    }

    return overlays.length;
  }

  /**
   * 차트를 표시할 위치 계산
   * - 포인트: 좌표 그대로
   * - 폴리곤: 면적가중 무게중심(center of mass)
   * - 멀티폴리곤(본토+섬 등): 면적이 가장 큰 덩어리(본토)의 무게중심
   *   → 흩어진 섬들 때문에 무게중심이 바다로 빠지는 것을 방지
   * - 무게중심이 폴리곤 밖(오목/구멍)에 떨어지면 표면 위 점으로 보정
   * 실패 시 경계상자 중심으로 폴백.
   * @returns {number[]} 지도 좌표(EPSG:3857)
   */
  getChartPosition(feature) {
    const geometry = feature.getGeometry();
    const type = geometry.getType();

    if (type === 'Point') {
      return geometry.getCoordinates();
    }

    try {
      // OL(EPSG:3857) → GeoJSON(EPSG:4326)
      const geoJSONGeom = this.geoJSONFormat.writeGeometryObject(geometry, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      });

      // 멀티폴리곤이면 면적이 가장 큰 폴리곤(본토)만 사용
      let target = geoJSONGeom;
      if (geoJSONGeom.type === 'MultiPolygon') {
        target = this.largestPolygon(geoJSONGeom) || geoJSONGeom;
      }

      const com = turf.centerOfMass(target);
      let coords = com && com.geometry && com.geometry.coordinates;

      // 무게중심이 폴리곤 밖이면 표면 위 점으로 보정
      try {
        if (target.type === 'Polygon' && (!coords || !turf.booleanPointInPolygon(com, target))) {
          const pof = turf.pointOnFeature(target);
          coords = pof.geometry.coordinates;
        }
      } catch (e) {
        // booleanPointInPolygon 등 실패 시 com 좌표 유지
      }

      if (coords && isFinite(coords[0]) && isFinite(coords[1])) {
        return fromLonLat(coords); // 다시 EPSG:3857로
      }
    } catch (e) {
      // 폴백
    }

    return getCenter(geometry.getExtent());
  }

  /**
   * 멀티폴리곤에서 면적이 가장 큰 폴리곤 반환 (GeoJSON Polygon)
   */
  largestPolygon(multiPolygon) {
    let best = null;
    let bestArea = -Infinity;
    multiPolygon.coordinates.forEach(rings => {
      try {
        const poly = turf.polygon(rings);
        const area = turf.area(poly);
        if (area > bestArea) {
          bestArea = area;
          best = poly.geometry;
        }
      } catch (e) {
        // 잘못된 링은 스킵
      }
    });
    return best;
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

    let legendHTML = `<div class="chart-legend-title">${layerName} - ${this.getChartTypeLabel(chartType)} 차트</div>`;
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
      makeDraggable(legendEl, () => mapContainer);
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

    const baselineY = size - 2;

    let bars = '';
    values.forEach((value, i) => {
      // 각 막대는 해당 필드의 전체 최대값 기준으로 높이 계산
      const fieldMax = globalMaxValues ? globalMaxValues[i] : overallMax;
      const height = fieldMax > 0 ? (value / fieldMax) * maxHeight : 0;
      const x = offsetX + i * barWidth;
      const y = baselineY - height;

      bars += `<rect x="${x + 1}" y="${y}" width="${barWidth - 2}" height="${height}"
               fill="${this.colors[i % this.colors.length]}"
               stroke="white" stroke-width="2" stroke-linejoin="round"/>`;
    });

    // 하단 가로축
    const axis = `<line x1="${offsetX - 1}" y1="${baselineY}" x2="${offsetX + totalBarWidth + 1}" y2="${baselineY}"
               stroke="#333" stroke-width="1.5"/>`;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${axis}
      ${bars}
    </svg>`;
  }

  /**
   * 100% 누적 막대 차트 SVG 생성
   * 피처별 합계를 100%로 정규화하여 각 필드의 구성비를 한 막대에 누적 표시.
   * @param {number[]} values - 각 필드의 값
   * @param {string[]} fields - 필드 이름 목록
   * @param {number} size - 차트 크기
   */
  createStackedBar100Chart(values, fields, size) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return '';

    const barWidth = size / 3; // 기존 0.5*size 대비 약 2/3로 축소
    const offsetX = (size - barWidth) / 2;
    const maxHeight = size - 4;

    const baselineY = 2 + maxHeight; // 막대 하단

    let segments = '';
    let yTop = 2; // 위에서부터 아래로 누적
    values.forEach((value, i) => {
      if (value <= 0) return;
      const h = (value / total) * maxHeight;
      segments += `<rect x="${offsetX}" y="${yTop}" width="${barWidth}" height="${h}"
               fill="${this.colors[i % this.colors.length]}"
               stroke="white" stroke-width="2" stroke-linejoin="round"/>`;
      yTop += h;
    });

    // 하단 가로축
    const axis = `<line x1="${offsetX - 2}" y1="${baselineY}" x2="${offsetX + barWidth + 2}" y2="${baselineY}"
               stroke="#333" stroke-width="1.5"/>`;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${axis}
      ${segments}
    </svg>`;
  }

  /**
   * 차트 유형 표시 라벨
   */
  getChartTypeLabel(chartType) {
    if (chartType === 'pie') return '파이';
    if (chartType === '100bar') return '100% 막대';
    return '막대';
  }

  /**
   * 도형표현도 제거 — 원본 또는 파생 layerId 모두 허용
   */
  removeChartMap(layerId) {
    let derivedId = this.derivedBySource.get(layerId);
    if (!derivedId && this.sourceByDerived.has(layerId)) {
      derivedId = layerId;
    }
    if (!derivedId) return;

    // LayerManager에서 제거하면 이벤트 리스너가 오버레이/범례 정리
    layerManager.removeLayer(derivedId);
  }

  /**
   * 모든 도형표현도 제거
   */
  clearAll() {
    const derivedIds = Array.from(this.sourceByDerived.keys());
    derivedIds.forEach(id => layerManager.removeLayer(id));
  }

  /**
   * 폴리곤/포인트 레이어 목록 가져오기
   */
  getCompatibleLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.geometryType && layer.type !== 'heatmap' && layer.type !== 'chartmap';
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
