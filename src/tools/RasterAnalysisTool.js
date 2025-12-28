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

class RasterAnalysisTool {
  constructor() {
    // 기본 태양 위치 (Hillshade용)
    this.defaultAzimuth = 315; // 북서쪽에서 빛
    this.defaultAltitude = 45; // 45도 고도각
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
      `${layerInfo.name}_Hillshade`,
      hillshadeData,
      width, height, extent, noDataValue,
      'grayscale'
    );
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

    // 벡터 레이어 생성
    const vectorSource = new VectorSource({ features });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => {
        const elev = feature.get('elevation');
        const isMajor = elev % (interval * 5) === 0;

        return new Style({
          stroke: new Stroke({
            color: isMajor ? '#8B4513' : '#A0522D',
            width: isMajor ? 1.5 : 0.8
          })
        });
      }
    });

    const contourLayerId = layerManager.addLayer({
      name: `${layerInfo.name}_등고선_${interval}m`,
      type: 'vector',
      olLayer: vectorLayer,
      source: vectorSource,
      geometryType: 'LineString'
    });

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

    return layerId;
  }

  /**
   * 분석 결과 렌더링
   */
  renderAnalysisResult(analysisData, viewExtent, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size[0];
    canvas.height = size[1];
    const ctx = canvas.getContext('2d');

    const { data, width, height, extent, noDataValue, colorScheme, minVal, maxVal } = analysisData;

    const demWidth = extent[2] - extent[0];
    const demHeight = extent[3] - extent[1];
    const viewWidth = viewExtent[2] - viewExtent[0];
    const viewHeight = viewExtent[3] - viewExtent[1];

    const imageData = ctx.createImageData(size[0], size[1]);
    const pixels = imageData.data;

    for (let y = 0; y < size[1]; y++) {
      for (let x = 0; x < size[0]; x++) {
        const mapX = viewExtent[0] + (x / size[0]) * viewWidth;
        const mapY = viewExtent[3] - (y / size[1]) * viewHeight;

        const demX = Math.floor(((mapX - extent[0]) / demWidth) * width);
        const demY = Math.floor(((extent[3] - mapY) / demHeight) * height);

        const pixelIndex = (y * size[0] + x) * 4;

        if (demX >= 0 && demX < width && demY >= 0 && demY < height) {
          const dataIndex = demY * width + demX;
          const value = data[dataIndex];

          if (value !== noDataValue && !isNaN(value) && isFinite(value) && value !== -1) {
            const color = this.getColorForScheme(value, colorScheme, minVal, maxVal);
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
}

export const rasterAnalysisTool = new RasterAnalysisTool();
