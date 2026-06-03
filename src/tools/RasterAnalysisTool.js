/**
 * RasterAnalysisTool - DEM 래스터 분석 도구
 * QGIS의 래스터 지형 분석 기능과 유사하게 구현
 */

import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { LineString } from 'ol/geom';
import { Style, Stroke } from 'ol/style';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { makeDraggable } from '../utils/DraggableElement.js';

class RasterAnalysisTool {
  constructor() {
    // 기본 태양 위치 (Hillshade용)
    this.defaultAzimuth = 315; // 북서쪽에서 빛
    this.defaultAltitude = 45; // 45도 고도각
    this.legends = new Map(); // layerId -> legend element

    // 레이어 삭제 시 범례도 삭제
    this.initEventListeners();
  }

  /**
   * 이벤트 리스너 초기화
   */
  initEventListeners() {
    eventBus.on(Events.LAYER_REMOVED, (data) => {
      if (data && data.layerId) {
        this.removeLegend(data.layerId);
      }
    });
  }

  /**
   * DEM 레이어 목록 가져오기
   */
  getDEMLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.type === 'raster' && layer.demData;
    });
  }

  /**
   * Hillshade (음영기복도) 생성
   * QGIS 알고리즘과 동일: Horn's method
   *
   * @param {string} layerId - DEM 레이어 ID
   * @param {Object} options - 옵션
   * @returns {string} 생성된 레이어 ID
   */
  createHillshade(layerId, options = {}) {
    const {
      azimuth = this.defaultAzimuth,
      altitude = this.defaultAltitude,
      zFactor = 1
    } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { data, width, height, extent, noDataValue } = demData;

    // 태양 위치를 라디안으로 변환
    const azimuthRad = (360 - azimuth + 90) * Math.PI / 180;
    const altitudeRad = altitude * Math.PI / 180;

    // 셀 크기 계산 (미터 단위 추정)
    const cellSizeX = (extent[2] - extent[0]) / width;
    const cellSizeY = (extent[3] - extent[1]) / height;

    // Hillshade 데이터 생성
    const hillshadeData = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // 3x3 이웃 픽셀 값 가져오기
        const z = this.getNeighborValues(data, width, height, x, y, noDataValue);

        if (z === null) {
          hillshadeData[idx] = noDataValue;
          continue;
        }

        // Horn's method로 경사 계산
        const dzdx = ((z[2] + 2 * z[5] + z[8]) - (z[0] + 2 * z[3] + z[6])) / (8 * cellSizeX * zFactor);
        const dzdy = ((z[6] + 2 * z[7] + z[8]) - (z[0] + 2 * z[1] + z[2])) / (8 * cellSizeY * zFactor);

        // 경사와 방향 계산
        const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);

        // Hillshade 계산
        let hillshade = Math.sin(altitudeRad) * Math.cos(slope) +
                        Math.cos(altitudeRad) * Math.sin(slope) * Math.cos(azimuthRad - aspect);

        hillshade = Math.max(0, Math.min(1, hillshade));
        hillshadeData[idx] = hillshade * 255;
      }
    }

    // 결과 레이어 생성
    return this.createResultLayer(
      `${layerInfo.name}_음영기복`,
      hillshadeData,
      width, height, extent, noDataValue,
      'grayscale'
    );
  }

  /**
   * 해발고도 색상(hypsometric tint) 시각화 생성
   * DEM 고도값을 색상 그라데이션으로 표현하고 범례에 실제 고도값(m) 표시
   * @param {string} layerId - DEM 레이어 ID
   * @returns {string} 생성된 레이어 ID
   */
  createElevation(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { data, width, height, extent, noDataValue } = demData;

    // 고도 최소/최대 (없으면 계산)
    let minVal = demData.minVal;
    let maxVal = demData.maxVal;
    if (minVal === undefined || maxVal === undefined) {
      minVal = Infinity; maxVal = -Infinity;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v === noDataValue || isNaN(v) || !isFinite(v)) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    // 고도값을 그대로 결과 데이터로 사용
    const elevData = Float32Array.from(data);

    return this.createResultLayer(
      `${layerInfo.name}_해발고도`,
      elevData,
      width, height, extent, noDataValue,
      'elevation',
      { minVal, maxVal }
    );
  }

  /**
   * 해발고도 + 음영기복 결합 시각화 (shaded relief)
   * 고도색 위에 음영을 곱해 입체 지형도를 만들고, 범례는 고도값(m) 표시
   * @param {string} layerId - DEM 레이어 ID
   * @param {Object} options - { azimuth, altitude, zFactor }
   * @returns {string} 생성된 레이어 ID
   */
  createTerrain(layerId, options = {}) {
    const {
      azimuth = this.defaultAzimuth,
      altitude = this.defaultAltitude,
      zFactor = 1
    } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { data, width, height, extent, noDataValue } = demData;

    // 고도 최소/최대
    let minVal = demData.minVal;
    let maxVal = demData.maxVal;
    if (minVal === undefined || maxVal === undefined) {
      minVal = Infinity; maxVal = -Infinity;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v === noDataValue || isNaN(v) || !isFinite(v)) continue;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    // 음영기복(0~1) 계산
    const azimuthRad = (360 - azimuth + 90) * Math.PI / 180;
    const altitudeRad = altitude * Math.PI / 180;
    const cellSizeX = (extent[2] - extent[0]) / width;
    const cellSizeY = (extent[3] - extent[1]) / height;
    const shadeData = new Float32Array(width * height).fill(1);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const z = this.getNeighborValues(data, width, height, x, y, noDataValue);
        if (z === null) { shadeData[idx] = 1; continue; }

        const dzdx = ((z[2] + 2 * z[5] + z[8]) - (z[0] + 2 * z[3] + z[6])) / (8 * cellSizeX * zFactor);
        const dzdy = ((z[6] + 2 * z[7] + z[8]) - (z[0] + 2 * z[1] + z[2])) / (8 * cellSizeY * zFactor);
        const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);
        let hs = Math.sin(altitudeRad) * Math.cos(slope) +
                 Math.cos(altitudeRad) * Math.sin(slope) * Math.cos(azimuthRad - aspect);
        shadeData[idx] = Math.max(0, Math.min(1, hs));
      }
    }

    // 결과 데이터는 고도값(색상·투명·범례 기준), 음영은 shadeData로 전달
    const elevData = Float32Array.from(data);

    return this.createResultLayer(
      `${layerInfo.name}_해발고도`,
      elevData,
      width, height, extent, noDataValue,
      'relief',
      { minVal, maxVal, shadeData }
    );
  }

  /**
   * 래스터 값 범위 필터 (래스터 계산기)
   * 선택한 기준(고도/경사/향)이 지정 범위에 드는 셀만 단색으로 표시
   * @param {string} layerId - DEM 레이어 ID
   * @param {Object} options - { metric, min, max, color }
   * @returns {string} 생성된 레이어 ID
   */
  createRasterFilter(layerId, options = {}) {
    const { metric = 'elevation', min = null, max = null, color = '#e3170a' } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { width, height, extent, noDataValue } = demData;

    const values = this.computeMetric(demData, metric);
    const lo = (min === null || min === undefined) ? -Infinity : min;
    const hi = (max === null || max === undefined) ? Infinity : max;
    // 향(aspect)에서 최소>최대면 0도를 가로지르는 범위(예: 북향 315~45)로 해석
    const wrap = metric === 'aspect' && lo !== -Infinity && hi !== Infinity && lo > hi;

    const out = new Float32Array(width * height);
    for (let i = 0; i < out.length; i++) {
      const v = values[i];
      let pass;
      if (v === noDataValue || isNaN(v) || !isFinite(v) || v === -1) {
        pass = false;
      } else if (wrap) {
        pass = (v >= lo || v <= hi);
      } else {
        pass = (v >= lo && v <= hi);
      }
      out[i] = pass ? 1 : noDataValue; // 통과=1(색칠), 아니면 투명
    }

    const rgb = this.hexToRgb(color);
    const metricLabel = this.getMetricLabel(metric);
    return this.createResultLayer(
      `${layerInfo.name}_필터(${metricLabel})`,
      out,
      width, height, extent, noDataValue,
      'filter',
      { fillColorRgb: rgb, color, metric, min, max }
    );
  }

  /**
   * 기준 지표 배열 계산 (고도/경사/향)
   * @returns {Float32Array} 데이터 없음/평탄면은 noDataValue
   */
  computeMetric(demData, metric) {
    const { data, width, height, extent, noDataValue } = demData;
    if (metric === 'elevation') return data;

    const cellSizeX = (extent[2] - extent[0]) / width;
    const cellSizeY = (extent[3] - extent[1]) / height;
    const out = new Float32Array(width * height).fill(noDataValue);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const z = this.getNeighborValues(data, width, height, x, y, noDataValue);
        if (z === null) { out[idx] = noDataValue; continue; }

        const dzdx = ((z[2] + 2 * z[5] + z[8]) - (z[0] + 2 * z[3] + z[6])) / (8 * cellSizeX);
        const dzdy = ((z[6] + 2 * z[7] + z[8]) - (z[0] + 2 * z[1] + z[2])) / (8 * cellSizeY);

        if (metric === 'slope') {
          out[idx] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI;
        } else { // aspect
          if (dzdx === 0 && dzdy === 0) {
            out[idx] = -1; // 평탄면
          } else {
            let a = Math.atan2(dzdy, -dzdx) * 180 / Math.PI;
            if (a < 0) a = 90 - a; else if (a > 90) a = 360 - a + 90; else a = 90 - a;
            out[idx] = a;
          }
        }
      }
    }
    return out;
  }

  getMetricLabel(metric) {
    if (metric === 'slope') return '경사도';
    if (metric === 'aspect') return '향';
    return '해발고도';
  }

  hexToRgb(hex) {
    const h = (hex || '#e3170a').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /**
   * Slope (경사도) 생성
   * QGIS 알고리즘과 동일
   *
   * @param {string} layerId - DEM 레이어 ID
   * @param {Object} options - 옵션
   * @returns {string} 생성된 레이어 ID
   */
  createSlope(layerId, options = {}) {
    const {
      unit = 'degree', // 'degree' or 'percent'
      zFactor = 1
    } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { data, width, height, extent, noDataValue } = demData;

    // 셀 크기 계산
    const cellSizeX = (extent[2] - extent[0]) / width;
    const cellSizeY = (extent[3] - extent[1]) / height;

    // Slope 데이터 생성
    const slopeData = new Float32Array(width * height);
    let minSlope = Infinity, maxSlope = -Infinity;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const z = this.getNeighborValues(data, width, height, x, y, noDataValue);

        if (z === null) {
          slopeData[idx] = noDataValue;
          continue;
        }

        // Horn's method
        const dzdx = ((z[2] + 2 * z[5] + z[8]) - (z[0] + 2 * z[3] + z[6])) / (8 * cellSizeX * zFactor);
        const dzdy = ((z[6] + 2 * z[7] + z[8]) - (z[0] + 2 * z[1] + z[2])) / (8 * cellSizeY * zFactor);

        let slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);

        if (unit === 'degree') {
          slope = Math.atan(slope) * 180 / Math.PI;
        } else {
          slope = slope * 100; // 퍼센트
        }

        slopeData[idx] = slope;
        if (slope !== noDataValue) {
          minSlope = Math.min(minSlope, slope);
          maxSlope = Math.max(maxSlope, slope);
        }
      }
    }

    // 결과 레이어 생성
    return this.createResultLayer(
      `${layerInfo.name}_Slope`,
      slopeData,
      width, height, extent, noDataValue,
      'slope',
      { minVal: minSlope, maxVal: maxSlope, unit }
    );
  }

  /**
   * Aspect (경사방향) 생성
   * QGIS 알고리즘과 동일
   *
   * @param {string} layerId - DEM 레이어 ID
   * @returns {string} 생성된 레이어 ID
   */
  createAspect(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { data, width, height, extent, noDataValue } = demData;

    // 셀 크기 계산
    const cellSizeX = (extent[2] - extent[0]) / width;
    const cellSizeY = (extent[3] - extent[1]) / height;

    // Aspect 데이터 생성
    const aspectData = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const z = this.getNeighborValues(data, width, height, x, y, noDataValue);

        if (z === null) {
          aspectData[idx] = noDataValue;
          continue;
        }

        // Horn's method
        const dzdx = ((z[2] + 2 * z[5] + z[8]) - (z[0] + 2 * z[3] + z[6])) / (8 * cellSizeX);
        const dzdy = ((z[6] + 2 * z[7] + z[8]) - (z[0] + 2 * z[1] + z[2])) / (8 * cellSizeY);

        // 평탄면 체크
        if (dzdx === 0 && dzdy === 0) {
          aspectData[idx] = -1; // 평탄면
        } else {
          // 방위각 계산 (북=0, 시계방향)
          let aspect = Math.atan2(dzdy, -dzdx) * 180 / Math.PI;

          // 0-360도로 변환
          if (aspect < 0) {
            aspect = 90 - aspect;
          } else if (aspect > 90) {
            aspect = 360 - aspect + 90;
          } else {
            aspect = 90 - aspect;
          }

          aspectData[idx] = aspect;
        }
      }
    }

    // 결과 레이어 생성
    return this.createResultLayer(
      `${layerInfo.name}_Aspect`,
      aspectData,
      width, height, extent, noDataValue,
      'aspect'
    );
  }

  /**
   * 등고선 생성
   * @param {string} layerId - DEM 레이어 ID
   * @param {Object} options - 옵션
   * @returns {string} 생성된 레이어 ID
   */
  createContour(layerId, options = {}) {
    const {
      interval = 100, // 등고선 간격 (미터)
      minElevation = null,
      maxElevation = null
    } = options;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.demData) {
      throw new Error('DEM 레이어를 찾을 수 없습니다.');
    }

    const demData = layerInfo.demData;
    const { data, width, height, extent, minVal, maxVal, noDataValue } = demData;

    // 등고선 범위 설정
    const startElev = minElevation !== null ? minElevation : Math.ceil(minVal / interval) * interval;
    const endElev = maxElevation !== null ? maxElevation : Math.floor(maxVal / interval) * interval;

    const features = [];
    const cellWidth = (extent[2] - extent[0]) / width;
    const cellHeight = (extent[3] - extent[1]) / height;

    // Marching Squares 알고리즘으로 등고선 생성
    for (let elev = startElev; elev <= endElev; elev += interval) {
      const lines = this.marchingSquares(data, width, height, elev, noDataValue);

      lines.forEach(line => {
        // 픽셀 좌표를 지도 좌표로 변환
        const coords = line.map(point => [
          extent[0] + point[0] * cellWidth,
          extent[3] - point[1] * cellHeight
        ]);

        if (coords.length >= 2) {
          const feature = new Feature({
            geometry: new LineString(coords),
            elevation: elev
          });
          features.push(feature);
        }
      });
    }

    // 초기 두께/색상 (주곡선/계곡선 비율 = 1.5/0.8 = 1.875)
    const minorWidth = 0.8;
    const majorRatio = 1.5 / 0.8;
    const baseColor = '#A0522D';

    const vectorSource = new VectorSource({ features });
    const styleFor = (color, mw) => (feature) => {
      const elev = feature.get('elevation');
      const isMajor = elev % (interval * 5) === 0;
      return new Style({
        stroke: new Stroke({
          color,
          width: isMajor ? mw * majorRatio : mw
        })
      });
    };
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: styleFor(baseColor, minorWidth)
    });

    const contourName = `${layerInfo.name}_등고선_${interval}m`;
    const contourLayerId = layerManager.addLayer({
      name: contourName,
      type: 'vector',
      olLayer: vectorLayer,
      source: vectorSource,
      geometryType: 'LineString',
      color: baseColor
    });

    // 사용자가 색상/두께를 바꿔도 LayerManager.updateLayerStyle이
    // 주곡선/계곡선 비율을 유지하도록 설정 보존
    const contourInfo = layerManager.getLayer(contourLayerId);
    if (contourInfo) {
      contourInfo._contourConfig = { interval, majorRatio };
      contourInfo.strokeColor = baseColor;
      contourInfo.strokeWidth = minorWidth;
    }

    // 등고선 범례
    this.createLegend(contourLayerId, contourName, 'contour', { interval });

    return contourLayerId;
  }

  /**
   * Marching Squares 알고리즘
   */
  marchingSquares(data, width, height, threshold, noDataValue) {
    const lines = [];
    const visited = new Set();

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        // 4개 코너 값 가져오기
        const tl = data[y * width + x];
        const tr = data[y * width + x + 1];
        const bl = data[(y + 1) * width + x];
        const br = data[(y + 1) * width + x + 1];

        // NoData 체크
        if (tl === noDataValue || tr === noDataValue ||
            bl === noDataValue || br === noDataValue) {
          continue;
        }

        // 4비트 인덱스 계산
        let index = 0;
        if (tl >= threshold) index |= 8;
        if (tr >= threshold) index |= 4;
        if (br >= threshold) index |= 2;
        if (bl >= threshold) index |= 1;

        // 경계가 없는 경우 스킵
        if (index === 0 || index === 15) continue;

        visited.add(key);

        // 선분 생성
        const segments = this.getContourSegments(index, x, y, tl, tr, bl, br, threshold);
        if (segments.length > 0) {
          lines.push(segments);
        }
      }
    }

    return lines;
  }

  /**
   * 등고선 세그먼트 생성
   */
  getContourSegments(index, x, y, tl, tr, bl, br, threshold) {
    const points = [];

    // 선형 보간으로 경계 위치 계산
    const lerp = (v1, v2, t) => {
      if (v2 === v1) return 0.5;
      return (t - v1) / (v2 - v1);
    };

    // 상단 변
    const topX = x + lerp(tl, tr, threshold);
    // 하단 변
    const bottomX = x + lerp(bl, br, threshold);
    // 좌측 변
    const leftY = y + lerp(tl, bl, threshold);
    // 우측 변
    const rightY = y + lerp(tr, br, threshold);

    // Marching squares 케이스별 처리
    switch (index) {
      case 1: case 14:
        points.push([x, leftY], [bottomX, y + 1]);
        break;
      case 2: case 13:
        points.push([bottomX, y + 1], [x + 1, rightY]);
        break;
      case 3: case 12:
        points.push([x, leftY], [x + 1, rightY]);
        break;
      case 4: case 11:
        points.push([topX, y], [x + 1, rightY]);
        break;
      case 5:
        points.push([x, leftY], [topX, y]);
        points.push([bottomX, y + 1], [x + 1, rightY]);
        break;
      case 6: case 9:
        points.push([topX, y], [bottomX, y + 1]);
        break;
      case 7: case 8:
        points.push([x, leftY], [topX, y]);
        break;
      case 10:
        points.push([topX, y], [x + 1, rightY]);
        points.push([x, leftY], [bottomX, y + 1]);
        break;
    }

    return points;
  }

  /**
   * 3x3 이웃 픽셀 값 가져오기
   */
  getNeighborValues(data, width, height, x, y, noDataValue) {
    const values = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          return null;
        }

        const val = data[ny * width + nx];
        if (val === noDataValue || isNaN(val) || !isFinite(val)) {
          return null;
        }

        values.push(val);
      }
    }

    return values;
  }

  /**
   * 결과 레이어 생성
   */
  createResultLayer(name, resultData, width, height, extent, noDataValue, colorScheme, metadata = {}) {
    const analysisData = {
      data: resultData,
      width,
      height,
      extent,
      noDataValue,
      colorScheme,
      ...metadata
    };

    return this.buildAnalysisLayer(analysisData, name);
  }

  /**
   * analysisData 객체로부터 분석 결과 래스터 레이어를 생성한다.
   * 분석 실행 시뿐 아니라 프로젝트(.egis) 복원 시에도 사용된다.
   * @param {Object} analysisData - { data, width, height, extent, noDataValue, colorScheme, ...metadata }
   * @param {string} name - 레이어 이름
   * @returns {string} 레이어 ID
   */
  buildAnalysisLayer(analysisData, name) {
    const { width, height, extent, colorScheme } = analysisData;

    // colorScheme/렌더링 외 부가 메타데이터만 추출 (범례용)
    const metadata = { ...analysisData };
    delete metadata.data;
    delete metadata.width;
    delete metadata.height;
    delete metadata.extent;
    delete metadata.noDataValue;
    delete metadata.colorScheme;

    const canvasSource = new ImageCanvasSource({
      canvasFunction: (viewExtent, resolution, pixelRatio, size) => {
        return this.renderAnalysisResult(analysisData, viewExtent, size);
      },
      ratio: 1
    });

    const olLayer = new ImageLayer({
      source: canvasSource,
      extent: extent,
      opacity: 0.9
    });

    const layerId = layerManager.addLayer({
      name: name,
      type: 'raster',
      olLayer: olLayer,
      source: null,
      geometryType: 'Raster'
    });

    const layerInfo = layerManager.getLayer(layerId);
    if (layerInfo) {
      layerInfo.analysisData = analysisData;
      layerInfo.featureCount = `${width}×${height}`;
    }

    // 범례 생성
    this.createLegend(layerId, name, colorScheme, metadata);

    return layerId;
  }

  /**
   * 분석 결과 렌더링
   */
  renderAnalysisResult(analysisData, viewExtent, size) {
    // size는 OL이 부동소수점으로 전달할 수 있음 → 정수로 고정 (Uint8ClampedArray 비정수 인덱스 쓰기 무시 회피)
    const w = Math.round(size[0]);
    const h = Math.round(size[1]);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const { data, width, height, extent, noDataValue, colorScheme, minVal, maxVal } = analysisData;

    const demWidth = extent[2] - extent[0];
    const demHeight = extent[3] - extent[1];
    const viewWidth = viewExtent[2] - viewExtent[0];
    const viewHeight = viewExtent[3] - viewExtent[1];

    const imageData = ctx.createImageData(w, h);
    const pixels = imageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const mapX = viewExtent[0] + (x / w) * viewWidth;
        const mapY = viewExtent[3] - (y / h) * viewHeight;

        const demX = Math.floor(((mapX - extent[0]) / demWidth) * width);
        const demY = Math.floor(((extent[3] - mapY) / demHeight) * height);

        const pixelIndex = (y * w + x) * 4;

        if (demX >= 0 && demX < width && demY >= 0 && demY < height) {
          const dataIndex = demY * width + demX;
          const value = data[dataIndex];

          if (value !== noDataValue && !isNaN(value) && isFinite(value) && value !== -1) {
            let color;
            if (colorScheme === 'filter') {
              color = analysisData.fillColorRgb || [227, 23, 10];
            } else if (colorScheme === 'relief') {
              // 고도색 위에 음영(0~1)을 곱해 입체감 부여
              const base = this.getColorForScheme(value, 'elevation', minVal, maxVal);
              let s = analysisData.shadeData ? analysisData.shadeData[dataIndex] : 1;
              if (!isFinite(s)) s = 1;
              const shade = 0.35 + 0.65 * Math.max(0, Math.min(1, s));
              color = [
                Math.round(base[0] * shade),
                Math.round(base[1] * shade),
                Math.round(base[2] * shade)
              ];
            } else {
              color = this.getColorForScheme(value, colorScheme, minVal, maxVal);
            }
            pixels[pixelIndex] = color[0];
            pixels[pixelIndex + 1] = color[1];
            pixels[pixelIndex + 2] = color[2];
            pixels[pixelIndex + 3] = 255;
          } else {
            pixels[pixelIndex + 3] = 0;
          }
        } else {
          pixels[pixelIndex + 3] = 0;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * 색상 스킴에 따른 색상 반환
   */
  getColorForScheme(value, scheme, minVal = 0, maxVal = 255) {
    switch (scheme) {
      case 'grayscale':
        const gray = Math.round(value);
        return [gray, gray, gray];

      case 'elevation': {
        // 해발고도 색상: 저지대(녹) → 황 → 갈 → 고지대(백)
        const range = (maxVal - minVal) || 1;
        let t = (value - minVal) / range;
        t = Math.max(0, Math.min(1, t));
        return this.hypsometricColor(t);
      }

      case 'slope':
        // 녹색(완만) -> 노랑 -> 빨강(급경사)
        const normalized = (value - minVal) / (maxVal - minVal);
        if (normalized < 0.33) {
          const t = normalized / 0.33;
          return [Math.round(t * 255), Math.round(128 + t * 127), Math.round(0)];
        } else if (normalized < 0.66) {
          const t = (normalized - 0.33) / 0.33;
          return [255, Math.round(255 - t * 128), 0];
        } else {
          const t = (normalized - 0.66) / 0.34;
          return [Math.round(255 - t * 128), Math.round(127 - t * 127), 0];
        }

      case 'aspect':
        // 방향별 색상 (8방위)
        // 북=빨강, 동=녹색, 남=파랑, 서=노랑
        const hue = (value / 360) * 360;
        return this.hslToRgb(hue, 70, 50);

      default:
        return [128, 128, 128];
    }
  }

  /**
   * 해발고도 색상(hypsometric) — t(0~1)에 따른 RGB
   * 범례의 그라데이션과 동일한 색상 정지점 사용
   */
  hypsometricColor(t) {
    const stops = [
      [0.0, [38, 115, 0]],     // 진녹 (저지대)
      [0.25, [128, 180, 60]],  // 연녹
      [0.5, [240, 220, 130]],  // 황
      [0.75, [160, 110, 60]],  // 갈
      [1.0, [245, 245, 245]]   // 백 (고지대/설선)
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i];
      const [t1, c1] = stops[i + 1];
      if (t <= t1) {
        const f = (t1 - t0) === 0 ? 0 : (t - t0) / (t1 - t0);
        return [
          Math.round(c0[0] + (c1[0] - c0[0]) * f),
          Math.round(c0[1] + (c1[1] - c0[1]) * f),
          Math.round(c0[2] + (c1[2] - c0[2]) * f)
        ];
      }
    }
    return stops[stops.length - 1][1];
  }

  /**
   * HSL to RGB 변환
   */
  hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }

  /**
   * 범례 생성
   * @param {string} layerId - 레이어 ID
   * @param {string} layerName - 레이어 이름
   * @param {string} colorScheme - 색상 스킴
   * @param {Object} metadata - 메타데이터
   */
  createLegend(layerId, layerName, colorScheme, metadata = {}) {
    // 기존 범례 제거
    this.removeLegend(layerId);

    const legendEl = document.createElement('div');
    legendEl.className = 'raster-analysis-legend';
    legendEl.id = `raster-legend-${layerId}`;

    let legendHTML = '';

    switch (colorScheme) {
      case 'grayscale':
        legendHTML = this.getHillshadeLegendHTML(layerName);
        break;
      case 'elevation':
      case 'relief':
        legendHTML = this.getElevationLegendHTML(layerName, metadata);
        break;
      case 'slope':
        legendHTML = this.getSlopeLegendHTML(layerName, metadata);
        break;
      case 'aspect':
        legendHTML = this.getAspectLegendHTML(layerName);
        break;
      case 'filter':
        legendHTML = this.getFilterLegendHTML(layerName, metadata);
        break;
      case 'contour':
        legendHTML = this.getContourLegendHTML(layerName, metadata);
        break;
      default:
        return;
    }

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
   * Hillshade 범례 HTML
   */
  getHillshadeLegendHTML(layerName) {
    return `
      <div class="raster-legend-title">${layerName}</div>
      <div class="raster-legend-content">
        <div class="hillshade-gradient"></div>
        <div class="raster-legend-labels">
          <span>어두움</span>
          <span>밝음</span>
        </div>
      </div>
    `;
  }

  /**
   * 해발고도 범례 HTML (고도값 표시)
   */
  getElevationLegendHTML(layerName, metadata) {
    const { minVal = 0, maxVal = 0 } = metadata;
    const mid = (minVal + maxVal) / 2;
    const grad = 'linear-gradient(to right, rgb(38,115,0), rgb(128,180,60), rgb(240,220,130), rgb(160,110,60), rgb(245,245,245))';
    return `
      <div class="raster-legend-title">${layerName}</div>
      <div class="raster-legend-content">
        <div class="raster-legend-gradient" style="background:${grad}"></div>
        <div class="raster-legend-labels">
          <span>${Math.round(minVal)}m</span>
          <span>${Math.round(mid)}m</span>
          <span>${Math.round(maxVal)}m</span>
        </div>
      </div>
    `;
  }

  /**
   * 래스터 필터 범례 HTML (조건 표시)
   */
  getFilterLegendHTML(layerName, metadata) {
    const { color = '#e3170a', metric = 'elevation', min, max } = metadata;
    const label = this.getMetricLabel(metric);
    const unit = metric === 'elevation' ? 'm' : '°';
    const lo = (min === null || min === undefined) ? '-∞' : min;
    const hi = (max === null || max === undefined) ? '∞' : max;
    return `
      <div class="raster-legend-title">${layerName}</div>
      <div class="raster-legend-content">
        <div class="filter-legend-row">
          <span class="filter-legend-swatch" style="background:${color}"></span>
          <span>${label} ${lo} ~ ${hi}${unit}</span>
        </div>
      </div>
    `;
  }

  /**
   * Slope 범례 HTML
   */
  getSlopeLegendHTML(layerName, metadata) {
    const { minVal = 0, maxVal = 90, unit = 'degree' } = metadata;
    const unitLabel = unit === 'degree' ? '°' : '%';

    return `
      <div class="raster-legend-title">${layerName}</div>
      <div class="raster-legend-content">
        <div class="slope-legend-gradient"></div>
        <div class="raster-legend-labels">
          <span>${minVal.toFixed(1)}${unitLabel}</span>
          <span>${(maxVal / 2).toFixed(1)}${unitLabel}</span>
          <span>${maxVal.toFixed(1)}${unitLabel}</span>
        </div>
        <div class="slope-legend-desc">
          <span class="gentle">완만</span>
          <span class="steep">급경사</span>
        </div>
      </div>
    `;
  }

  /**
   * Aspect 범례 HTML
   */
  getAspectLegendHTML(layerName) {
    return `
      <div class="raster-legend-title">${layerName}</div>
      <div class="raster-legend-content">
        <div class="aspect-legend-compass">
          <div class="aspect-compass-label n">N</div>
          <div class="aspect-compass-label e">E</div>
          <div class="aspect-compass-label s">S</div>
          <div class="aspect-compass-label w">W</div>
          <div class="aspect-compass-ring"></div>
        </div>
        <div class="aspect-legend-items">
          <div class="aspect-item"><span class="aspect-color" style="background:hsl(0,70%,50%)"></span>북 (0°)</div>
          <div class="aspect-item"><span class="aspect-color" style="background:hsl(90,70%,50%)"></span>동 (90°)</div>
          <div class="aspect-item"><span class="aspect-color" style="background:hsl(180,70%,50%)"></span>남 (180°)</div>
          <div class="aspect-item"><span class="aspect-color" style="background:hsl(270,70%,50%)"></span>서 (270°)</div>
        </div>
      </div>
    `;
  }

  /**
   * Contour 범례 HTML (주곡선/계곡선)
   */
  getContourLegendHTML(layerName, metadata = {}) {
    const interval = metadata.interval || 100;
    const majorInterval = interval * 5;
    return `
      <div class="raster-legend-title">${layerName}</div>
      <div class="raster-legend-content">
        <div class="contour-legend-row">
          <span class="contour-legend-line major"></span>
          <span>주곡선 (${majorInterval}m 간격)</span>
        </div>
        <div class="contour-legend-row">
          <span class="contour-legend-line minor"></span>
          <span>계곡선 (${interval}m 간격)</span>
        </div>
      </div>
    `;
  }

  /**
   * 범례 제거
   * @param {string} layerId - 레이어 ID
   */
  removeLegend(layerId) {
    const legendEl = this.legends.get(layerId);
    if (legendEl) {
      legendEl.remove();
      this.legends.delete(layerId);
    }
  }

  /**
   * 모든 범례 제거
   */
  clearAllLegends() {
    this.legends.forEach((legendEl) => {
      legendEl.remove();
    });
    this.legends.clear();
  }
}

export const rasterAnalysisTool = new RasterAnalysisTool();
