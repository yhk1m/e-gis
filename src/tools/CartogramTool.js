/**
 * CartogramTool - 카토그램 생성 도구
 * Dorling (원형) 및 Non-contiguous (비연속) 카토그램 지원
 */

import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';
import Feature from 'ol/Feature';
import { Point, Polygon } from 'ol/geom';
import { getCenter } from 'ol/extent';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';

class CartogramTool {
  constructor() {
    this.colorSchemes = {
      blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
      reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
      greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
      oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'],
      purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486'],
      spectral: ['#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd']
    };
  }

  /**
   * Dorling 카토그램 생성 (원형)
   * @param {string} layerId - 원본 레이어 ID
   * @param {string} attribute - 크기를 결정할 속성
   * @param {Object} options - 옵션
   * @returns {string} 생성된 레이어 ID
   */
  createDorlingCartogram(layerId, attribute, options = {}) {
    const layer = layerManager.getLayer(layerId);
    if (!layer || !layer.source) {
      throw new Error('유효한 레이어를 선택해주세요.');
    }

    const features = layer.source.getFeatures();
    if (features.length === 0) {
      throw new Error('레이어에 객체가 없습니다.');
    }

    const {
      colorScheme = 'blues',
      minRadius = 5,
      maxRadius = 50,
      showLabels = false,
      iterations = 100
    } = options;

    // 속성값과 중심점 수집
    const data = [];
    let minVal = Infinity, maxVal = -Infinity;

    features.forEach(feature => {
      const value = parseFloat(feature.get(attribute));
      if (isNaN(value) || value <= 0) return;

      const geom = feature.getGeometry();
      if (!geom) return;

      const center = getCenter(geom.getExtent());

      data.push({
        feature,
        value,
        center,
        x: center[0],
        y: center[1],
        radius: 0
      });

      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;
    });

    if (data.length === 0) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    // 반지름 계산 (면적 비례)
    const valueRange = maxVal - minVal || 1;
    data.forEach(d => {
      const normalized = (d.value - minVal) / valueRange;
      // 면적이 값에 비례하도록 반지름 계산
      d.radius = minRadius + Math.sqrt(normalized) * (maxRadius - minRadius);
    });

    // Force-directed layout으로 원 겹침 해소
    this.applyForceLayout(data, iterations);

    // 색상 스케일
    const colors = this.colorSchemes[colorScheme] || this.colorSchemes.blues;

    // 새 피처 생성
    const newFeatures = data.map((d, index) => {
      const colorIndex = Math.floor((d.value - minVal) / valueRange * (colors.length - 1));
      const color = colors[Math.min(colorIndex, colors.length - 1)];

      // 속성 복사 (geometry 제외)
      const props = d.feature.getProperties();
      delete props.geometry;

      const circleFeature = new Feature({
        geometry: new Point([d.x, d.y]),
        ...props
      });

      // 스타일 설정
      const style = new Style({
        image: new CircleStyle({
          radius: d.radius,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: '#333', width: 1 })
        }),
        text: showLabels ? new Text({
          text: d.feature.get('name') || d.feature.get('NAME') || '',
          font: '11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
          offsetY: d.radius + 10
        }) : undefined
      });

      circleFeature.setStyle(style);
      return circleFeature;
    });

    // 새 레이어 생성
    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_Dorling_${attribute}`,
      type: 'vector',
      geometryType: 'Point',
      olLayer: vectorLayer,
      source: vectorSource
    });

    // 범례 추가
    this.addLegend(newLayerId, `Dorling: ${attribute}`, minVal, maxVal, colors);

    return newLayerId;
  }

  /**
   * Force-directed layout 적용
   */
  applyForceLayout(data, iterations) {
    const padding = 2;

    for (let iter = 0; iter < iterations; iter++) {
      let moved = false;

      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          const dx = data[j].x - data[i].x;
          const dy = data[j].y - data[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = data[i].radius + data[j].radius + padding;

          if (dist < minDist && dist > 0) {
            const overlap = (minDist - dist) / 2;
            const moveX = (dx / dist) * overlap;
            const moveY = (dy / dist) * overlap;

            data[i].x -= moveX;
            data[i].y -= moveY;
            data[j].x += moveX;
            data[j].y += moveY;
            moved = true;
          }
        }
      }

      // 원래 위치로 약간 당기기
      data.forEach(d => {
        d.x += (d.center[0] - d.x) * 0.01;
        d.y += (d.center[1] - d.y) * 0.01;
      });

      if (!moved) break;
    }
  }

  /**
   * Non-contiguous 카토그램 생성 (비연속)
   * @param {string} layerId - 원본 레이어 ID
   * @param {string} attribute - 크기를 결정할 속성
   * @param {Object} options - 옵션
   * @returns {string} 생성된 레이어 ID
   */
  createNonContiguousCartogram(layerId, attribute, options = {}) {
    const layer = layerManager.getLayer(layerId);
    if (!layer || !layer.source) {
      throw new Error('유효한 레이어를 선택해주세요.');
    }

    const features = layer.source.getFeatures();
    if (features.length === 0) {
      throw new Error('레이어에 객체가 없습니다.');
    }

    const {
      colorScheme = 'blues',
      minScale = 0.3,
      maxScale = 1.5,
      showLabels = false
    } = options;

    // 속성값 수집
    let minVal = Infinity, maxVal = -Infinity;
    const validFeatures = [];

    features.forEach(feature => {
      const value = parseFloat(feature.get(attribute));
      if (isNaN(value) || value <= 0) return;

      validFeatures.push({ feature, value });
      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;
    });

    if (validFeatures.length === 0) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    const valueRange = maxVal - minVal || 1;
    const colors = this.colorSchemes[colorScheme] || this.colorSchemes.blues;

    // 새 피처 생성 (스케일링된)
    const newFeatures = validFeatures.map(({ feature, value }) => {
      const geom = feature.getGeometry();
      if (!geom) return null;

      // 스케일 계산
      const normalized = (value - minVal) / valueRange;
      const scale = minScale + normalized * (maxScale - minScale);

      // 중심점 기준으로 스케일링
      const center = getCenter(geom.getExtent());
      const scaledGeom = this.scaleGeometry(geom.clone(), center, scale);

      // 색상 계산
      const colorIndex = Math.floor(normalized * (colors.length - 1));
      const color = colors[Math.min(colorIndex, colors.length - 1)];

      // 속성 복사 (geometry 제외)
      const props = feature.getProperties();
      delete props.geometry;

      const newFeature = new Feature({
        geometry: scaledGeom,
        ...props
      });

      const style = new Style({
        fill: new Fill({ color: this.hexToRgba(color, 0.7) }),
        stroke: new Stroke({ color: '#333', width: 1 }),
        text: showLabels ? new Text({
          text: feature.get('name') || feature.get('NAME') || '',
          font: '11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        }) : undefined
      });

      newFeature.setStyle(style);
      return newFeature;
    }).filter(f => f !== null);

    // 새 레이어 생성
    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_NonContig_${attribute}`,
      type: 'vector',
      geometryType: layer.geometryType,
      olLayer: vectorLayer,
      source: vectorSource
    });

    // 범례 추가
    this.addLegend(newLayerId, `Non-Contiguous: ${attribute}`, minVal, maxVal, colors);

    return newLayerId;
  }

  /**
   * Contiguous 카토그램 생성 (연속형 - 폴리곤 붙이기)
   * @param {string} layerId - 원본 레이어 ID
   * @param {string} attribute - 크기를 결정할 속성
   * @param {Object} options - 옵션
   * @returns {string} 생성된 레이어 ID
   */
  createContiguousCartogram(layerId, attribute, options = {}) {
    const layer = layerManager.getLayer(layerId);
    if (!layer || !layer.source) {
      throw new Error('유효한 레이어를 선택해주세요.');
    }

    const features = layer.source.getFeatures();
    if (features.length === 0) {
      throw new Error('레이어에 객체가 없습니다.');
    }

    const {
      colorScheme = 'blues',
      minScale = 0.5,
      maxScale = 1.5,
      showLabels = false,
      iterations = 50
    } = options;

    // 속성값 수집
    let minVal = Infinity, maxVal = -Infinity;
    const data = [];

    features.forEach(feature => {
      const value = parseFloat(feature.get(attribute));
      if (isNaN(value) || value <= 0) return;

      const geom = feature.getGeometry();
      if (!geom) return;

      const center = getCenter(geom.getExtent());

      data.push({
        feature,
        value,
        originalCenter: center,
        currentCenter: [...center],
        scale: 1,
        geom: geom.clone()
      });

      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;
    });

    if (data.length === 0) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    const valueRange = maxVal - minVal || 1;

    // 스케일 계산
    data.forEach(d => {
      const normalized = (d.value - minVal) / valueRange;
      d.scale = minScale + normalized * (maxScale - minScale);
    });

    // 전체 중심점 계산
    let totalX = 0, totalY = 0;
    data.forEach(d => {
      totalX += d.originalCenter[0];
      totalY += d.originalCenter[1];
    });
    const globalCenter = [totalX / data.length, totalY / data.length];

    // 스케일링 및 위치 조정 (전체 중심점 기준)
    data.forEach(d => {
      // 스케일링
      d.geom = this.scaleGeometry(d.geom, d.originalCenter, d.scale);

      // 전체 중심 방향으로 이동 (스케일에 반비례)
      const dx = globalCenter[0] - d.originalCenter[0];
      const dy = globalCenter[1] - d.originalCenter[1];
      const moveFactor = (1 - d.scale) * 0.3; // 작은 폴리곤은 더 많이 이동

      d.geom = this.translateGeometry(d.geom, dx * moveFactor, dy * moveFactor);
      const newExtent = d.geom.getExtent();
      d.currentCenter = getCenter(newExtent);
    });

    // Force-directed layout으로 폴리곤 밀착
    this.applyPolygonForceLayout(data, iterations);

    const colors = this.colorSchemes[colorScheme] || this.colorSchemes.blues;

    // 새 피처 생성
    const newFeatures = data.map(d => {
      const normalized = (d.value - minVal) / valueRange;
      const colorIndex = Math.floor(normalized * (colors.length - 1));
      const color = colors[Math.min(colorIndex, colors.length - 1)];

      const props = d.feature.getProperties();
      delete props.geometry;

      const newFeature = new Feature({
        geometry: d.geom,
        ...props
      });

      const style = new Style({
        fill: new Fill({ color: this.hexToRgba(color, 0.7) }),
        stroke: new Stroke({ color: '#333', width: 1 }),
        text: showLabels ? new Text({
          text: d.feature.get('name') || d.feature.get('NAME') || '',
          font: '11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        }) : undefined
      });

      newFeature.setStyle(style);
      return newFeature;
    });

    // 새 레이어 생성
    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_Contig_${attribute}`,
      type: 'vector',
      geometryType: layer.geometryType,
      olLayer: vectorLayer,
      source: vectorSource
    });

    // 범례 추가
    this.addLegend(newLayerId, `Contiguous: ${attribute}`, minVal, maxVal, colors);

    return newLayerId;
  }

  /**
   * 폴리곤 Force-directed layout 적용
   */
  applyPolygonForceLayout(data, iterations) {
    for (let iter = 0; iter < iterations; iter++) {
      let totalMove = 0;

      for (let i = 0; i < data.length; i++) {
        for (let j = i + 1; j < data.length; j++) {
          const d1 = data[i];
          const d2 = data[j];

          // 두 폴리곤 중심 간 거리
          const dx = d2.currentCenter[0] - d1.currentCenter[0];
          const dy = d2.currentCenter[1] - d1.currentCenter[1];
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 1) continue;

          // 두 폴리곤이 원래 인접했는지 확인 (중심 거리 기반 근사)
          const origDx = d2.originalCenter[0] - d1.originalCenter[0];
          const origDy = d2.originalCenter[1] - d1.originalCenter[1];
          const origDist = Math.sqrt(origDx * origDx + origDy * origDy);

          // 원래 인접했던 폴리곤들만 서로 당김
          const avgScale = (d1.scale + d2.scale) / 2;
          const targetDist = origDist * avgScale;

          if (dist > targetDist) {
            // 서로 당김
            const pull = (dist - targetDist) * 0.1;
            const moveX = (dx / dist) * pull;
            const moveY = (dy / dist) * pull;

            d1.geom = this.translateGeometry(d1.geom, moveX, moveY);
            d2.geom = this.translateGeometry(d2.geom, -moveX, -moveY);

            d1.currentCenter[0] += moveX;
            d1.currentCenter[1] += moveY;
            d2.currentCenter[0] -= moveX;
            d2.currentCenter[1] -= moveY;

            totalMove += Math.abs(pull);
          }
        }
      }

      // 수렴하면 종료
      if (totalMove < 1) break;
    }
  }

  /**
   * 지오메트리 이동
   */
  translateGeometry(geom, dx, dy) {
    const type = geom.getType();

    if (type === 'Polygon') {
      const coords = geom.getCoordinates();
      const translatedCoords = coords.map(ring =>
        ring.map(coord => [coord[0] + dx, coord[1] + dy])
      );
      geom.setCoordinates(translatedCoords);
    } else if (type === 'MultiPolygon') {
      const coords = geom.getCoordinates();
      const translatedCoords = coords.map(polygon =>
        polygon.map(ring =>
          ring.map(coord => [coord[0] + dx, coord[1] + dy])
        )
      );
      geom.setCoordinates(translatedCoords);
    }

    return geom;
  }

  /**
   * 지오메트리 스케일링
   */
  scaleGeometry(geom, center, scale) {
    const type = geom.getType();

    if (type === 'Polygon') {
      const coords = geom.getCoordinates();
      const scaledCoords = coords.map(ring =>
        ring.map(coord => [
          center[0] + (coord[0] - center[0]) * scale,
          center[1] + (coord[1] - center[1]) * scale
        ])
      );
      geom.setCoordinates(scaledCoords);
    } else if (type === 'MultiPolygon') {
      const coords = geom.getCoordinates();
      const scaledCoords = coords.map(polygon =>
        polygon.map(ring =>
          ring.map(coord => [
            center[0] + (coord[0] - center[0]) * scale,
            center[1] + (coord[1] - center[1]) * scale
          ])
        )
      );
      geom.setCoordinates(scaledCoords);
    } else if (type === 'Point') {
      const coord = geom.getCoordinates();
      geom.setCoordinates([
        center[0] + (coord[0] - center[0]) * scale,
        center[1] + (coord[1] - center[1]) * scale
      ]);
    } else if (type === 'LineString') {
      const coords = geom.getCoordinates();
      const scaledCoords = coords.map(coord => [
        center[0] + (coord[0] - center[0]) * scale,
        center[1] + (coord[1] - center[1]) * scale
      ]);
      geom.setCoordinates(scaledCoords);
    }

    return geom;
  }

  /**
   * HEX를 RGBA로 변환
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 범례 추가
   */
  addLegend(layerId, title, minVal, maxVal, colors) {
    // 기존 범례 제거
    const existingLegend = document.getElementById(`legend-${layerId}`);
    if (existingLegend) existingLegend.remove();

    const legendHtml = `
      <div class="cartogram-legend" id="legend-${layerId}">
        <div class="legend-title">${title}</div>
        <div class="legend-gradient" style="background: linear-gradient(to right, ${colors.join(', ')});"></div>
        <div class="legend-labels">
          <span>${minVal.toLocaleString()}</span>
          <span>${maxVal.toLocaleString()}</span>
        </div>
      </div>
    `;

    // 지도 컨테이너에 추가
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.insertAdjacentHTML('beforeend', legendHtml);
    }

    this.addLegendStyles();
  }

  /**
   * 범례 스타일 추가
   */
  addLegendStyles() {
    if (document.getElementById('cartogram-legend-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'cartogram-legend-styles';
    styles.textContent = `
      .cartogram-legend {
        position: absolute;
        bottom: 40px;
        right: 10px;
        background: var(--bg-panel);
        padding: 10px 12px;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        z-index: 100;
        min-width: 150px;
      }

      .cartogram-legend .legend-title {
        font-size: var(--font-size-sm);
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--text-primary);
      }

      .cartogram-legend .legend-gradient {
        height: 12px;
        border-radius: 2px;
        margin-bottom: 4px;
      }

      .cartogram-legend .legend-labels {
        display: flex;
        justify-content: space-between;
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * 범례 제거
   */
  removeLegend(layerId) {
    const legend = document.getElementById(`legend-${layerId}`);
    if (legend) legend.remove();
  }

  /**
   * 숫자 속성 목록 가져오기
   */
  getNumericAttributes(layerId) {
    const layer = layerManager.getLayer(layerId);
    if (!layer || !layer.source) return [];

    const features = layer.source.getFeatures();
    if (features.length === 0) return [];

    const attributes = new Set();
    const sampleFeature = features[0];
    const props = sampleFeature.getProperties();

    Object.keys(props).forEach(key => {
      if (key === 'geometry') return;

      // 숫자 값인지 확인
      const value = props[key];
      if (typeof value === 'number' || !isNaN(parseFloat(value))) {
        attributes.add(key);
      }
    });

    return Array.from(attributes);
  }
}

export const cartogramTool = new CartogramTool();
