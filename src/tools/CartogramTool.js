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
   * Contiguous 카토그램 생성 (Gastner-Newman 스타일)
   * 공간 자체를 왜곡하여 면적이 값에 비례하도록 변형
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
      showLabels = false,
      iterations = 50  // 더 많은 반복
    } = options;

    // 속성값 수집
    let minVal = Infinity, maxVal = -Infinity;
    let totalValue = 0;
    const data = [];

    features.forEach(feature => {
      const value = parseFloat(feature.get(attribute));
      if (isNaN(value) || value <= 0) return;

      const geom = feature.getGeometry();
      if (!geom) return;

      const area = this.calculateGeometryArea(geom);
      if (area <= 0) return;

      data.push({
        feature,
        value,
        originalArea: area,
        geom: geom.clone()
      });

      totalValue += value;
      if (value < minVal) minVal = value;
      if (value > maxVal) maxVal = value;
    });

    if (data.length === 0) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    // 총 면적 계산
    const totalArea = data.reduce((sum, d) => sum + d.originalArea, 0);

    // 목표 면적 계산 (값에 비례)
    data.forEach(d => {
      d.targetArea = (d.value / totalValue) * totalArea;
      d.desiredRadius = Math.sqrt(d.targetArea / Math.PI);
    });

    // 전체 바운딩 박스 계산
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.forEach(d => {
      const ext = d.geom.getExtent();
      minX = Math.min(minX, ext[0]);
      minY = Math.min(minY, ext[1]);
      maxX = Math.max(maxX, ext[2]);
      maxY = Math.max(maxY, ext[3]);
    });
    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;

    // 강력한 Gastner-Newman 스타일 변형 적용
    for (let iter = 0; iter < iterations; iter++) {
      // 현재 상태 업데이트
      data.forEach(d => {
        d.currentArea = this.calculateGeometryArea(d.geom);
        d.center = this.calculateCentroid(d.geom);
        d.currentRadius = Math.sqrt(d.currentArea / Math.PI);
        // 면적 비율 계산
        d.sizeRatio = Math.sqrt(d.targetArea / Math.max(d.currentArea, 0.0001));
      });

      // 점진적 강도 (처음엔 강하게, 나중엔 약하게)
      const strength = 0.4 * (1 - iter / iterations * 0.7);

      // 모든 정점에 대해 변형 적용
      data.forEach((d, idx) => {
        const type = d.geom.getType();

        if (type === 'Polygon') {
          const coords = d.geom.getCoordinates();
          const newCoords = coords.map(ring =>
            this.transformRingGastner(ring, data, idx, strength, mapWidth, mapHeight)
          );
          d.geom.setCoordinates(newCoords);
        } else if (type === 'MultiPolygon') {
          const coords = d.geom.getCoordinates();
          const newCoords = coords.map(polygon =>
            polygon.map(ring =>
              this.transformRingGastner(ring, data, idx, strength, mapWidth, mapHeight)
            )
          );
          d.geom.setCoordinates(newCoords);
        }
      });

      // 중첩 해소 단계
      this.resolveOverlaps(data, strength * 0.5);
    }

    // 최종 스무딩 (부드러운 블롭 형태로)
    for (let s = 0; s < 3; s++) {
      data.forEach(d => {
        d.geom = this.smoothPolygonAdvanced(d.geom, 0.3);
      });
    }

    // 색상 적용 및 피처 생성
    const valueRange = maxVal - minVal || 1;
    const colors = this.colorSchemes[colorScheme] || this.colorSchemes.blues;

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
        fill: new Fill({ color: this.hexToRgba(color, 0.8) }),
        stroke: new Stroke({ color: '#333', width: 1.5 }),
        text: showLabels ? new Text({
          text: d.feature.get('name') || d.feature.get('NAME') || '',
          font: 'bold 11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 3 })
        }) : undefined
      });

      newFeature.setStyle(style);
      return newFeature;
    });

    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_Contig_${attribute}`,
      type: 'vector',
      geometryType: layer.geometryType,
      olLayer: vectorLayer,
      source: vectorSource
    });

    this.addLegend(newLayerId, `Contiguous: ${attribute}`, minVal, maxVal, colors);

    return newLayerId;
  }

  /**
   * Gastner-Newman 스타일 링 변형
   * 각 정점을 폴리곤 면적 비율에 따라 이동
   */
  transformRingGastner(ring, data, selfIdx, strength, mapWidth, mapHeight) {
    const newRing = [];
    const self = data[selfIdx];

    for (let i = 0; i < ring.length; i++) {
      const vertex = ring[i];
      let dx = 0;
      let dy = 0;

      // 자기 자신의 폴리곤에 대한 스케일링 (가장 강한 영향)
      const selfCx = self.center[0];
      const selfCy = self.center[1];
      const selfDistX = vertex[0] - selfCx;
      const selfDistY = vertex[1] - selfCy;

      // 자기 폴리곤의 스케일링
      const selfScale = self.sizeRatio - 1;
      dx += selfDistX * selfScale * strength * 1.5;
      dy += selfDistY * selfScale * strength * 1.5;

      // 다른 폴리곤들의 영향 (밀어내기/당기기)
      for (let j = 0; j < data.length; j++) {
        if (j === selfIdx) continue;

        const other = data[j];
        const cx = other.center[0];
        const cy = other.center[1];

        const distX = vertex[0] - cx;
        const distY = vertex[1] - cy;
        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < 0.0001) continue;

        // 영향력: 폴리곤 반경 기반으로 거리에 따라 감소
        const influenceRadius = other.currentRadius * 2;
        const influence = Math.max(0, 1 - dist / influenceRadius);

        if (influence <= 0) continue;

        // 다른 폴리곤의 스케일링에 따른 공간 왜곡
        const otherScale = other.sizeRatio - 1;
        const forceMagnitude = otherScale * influence * influence * strength;

        // 방향 벡터 (중심에서 멀어지는 방향)
        const nx = distX / dist;
        const ny = distY / dist;

        dx += nx * forceMagnitude * other.currentRadius;
        dy += ny * forceMagnitude * other.currentRadius;
      }

      newRing.push([
        vertex[0] + dx,
        vertex[1] + dy
      ]);
    }

    return newRing;
  }

  /**
   * 폴리곤 중첩 해소
   */
  resolveOverlaps(data, strength) {
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        const ext1 = data[i].geom.getExtent();
        const ext2 = data[j].geom.getExtent();

        // 바운딩 박스 중첩 확인
        const overlapX = Math.min(ext1[2], ext2[2]) - Math.max(ext1[0], ext2[0]);
        const overlapY = Math.min(ext1[3], ext2[3]) - Math.max(ext1[1], ext2[1]);

        if (overlapX > 0 && overlapY > 0) {
          // 중첩 발생 - 밀어내기
          const c1 = data[i].center;
          const c2 = data[j].center;

          const dx = c2[0] - c1[0];
          const dy = c2[1] - c1[1];
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // 중첩 크기에 비례하여 밀어내기
          const overlap = Math.sqrt(overlapX * overlapY);
          const pushForce = overlap * strength;

          const nx = dx / dist;
          const ny = dy / dist;

          // 두 폴리곤을 반대 방향으로 이동
          data[i].geom = this.translateGeometry(data[i].geom, -nx * pushForce, -ny * pushForce);
          data[j].geom = this.translateGeometry(data[j].geom, nx * pushForce, ny * pushForce);

          // 중심 업데이트
          data[i].center = this.calculateCentroid(data[i].geom);
          data[j].center = this.calculateCentroid(data[j].geom);
        }
      }
    }
  }

  /**
   * 고급 폴리곤 스무딩 (블롭 형태)
   */
  smoothPolygonAdvanced(geom, factor) {
    const type = geom.getType();

    if (type === 'Polygon') {
      const coords = geom.getCoordinates();
      const smoothedCoords = coords.map(ring => this.smoothRingAdvanced(ring, factor));
      geom.setCoordinates(smoothedCoords);
    } else if (type === 'MultiPolygon') {
      const coords = geom.getCoordinates();
      const smoothedCoords = coords.map(poly =>
        poly.map(ring => this.smoothRingAdvanced(ring, factor))
      );
      geom.setCoordinates(smoothedCoords);
    }

    return geom;
  }

  /**
   * 고급 링 스무딩 (Chaikin 알고리즘 변형)
   */
  smoothRingAdvanced(ring, factor) {
    if (ring.length < 4) return ring;

    const n = ring.length - 1;
    const smoothed = [];

    for (let i = 0; i < n; i++) {
      const prev = ring[(i - 1 + n) % n];
      const curr = ring[i];
      const next = ring[(i + 1) % n];
      const next2 = ring[(i + 2) % n];

      // 4점 평균으로 더 부드럽게
      const weight = factor;
      smoothed.push([
        curr[0] * (1 - weight) + (prev[0] + next[0]) * (weight / 2),
        curr[1] * (1 - weight) + (prev[1] + next[1]) * (weight / 2)
      ]);
    }

    // 폐합
    smoothed.push([...smoothed[0]]);

    return smoothed;
  }

  /**
   * 폴리곤 중심점 계산 (무게중심)
   */
  calculateCentroid(geom) {
    const type = geom.getType();
    let sumX = 0, sumY = 0, sumArea = 0;

    if (type === 'Polygon') {
      const coords = geom.getCoordinates()[0];
      const result = this.calculateRingCentroid(coords);
      return result.centroid;
    } else if (type === 'MultiPolygon') {
      const polys = geom.getCoordinates();
      polys.forEach(poly => {
        const result = this.calculateRingCentroid(poly[0]);
        const area = Math.abs(result.area);
        sumX += result.centroid[0] * area;
        sumY += result.centroid[1] * area;
        sumArea += area;
      });
      return sumArea > 0 ? [sumX / sumArea, sumY / sumArea] : getCenter(geom.getExtent());
    }

    return getCenter(geom.getExtent());
  }

  /**
   * 링의 무게중심 계산
   */
  calculateRingCentroid(ring) {
    let signedArea = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = ring[i][0];
      const y0 = ring[i][1];
      const x1 = ring[i + 1][0];
      const y1 = ring[i + 1][1];

      const a = x0 * y1 - x1 * y0;
      signedArea += a;
      cx += (x0 + x1) * a;
      cy += (y0 + y1) * a;
    }

    signedArea *= 0.5;
    const factor = 1 / (6 * signedArea);

    return {
      centroid: [cx * factor, cy * factor],
      area: signedArea
    };
  }

  /**
   * 지오메트리 면적 계산
   */
  calculateGeometryArea(geom) {
    const type = geom.getType();
    if (type === 'Polygon') {
      return Math.abs(this.calculatePolygonArea(geom.getCoordinates()[0]));
    } else if (type === 'MultiPolygon') {
      return geom.getCoordinates().reduce((sum, polygon) => {
        return sum + Math.abs(this.calculatePolygonArea(polygon[0]));
      }, 0);
    }
    return 0;
  }

  /**
   * 폴리곤 면적 계산 (Shoelace formula)
   */
  calculatePolygonArea(coords) {
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      area += coords[i][0] * coords[i + 1][1];
      area -= coords[i + 1][0] * coords[i][1];
    }
    return area / 2;
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
