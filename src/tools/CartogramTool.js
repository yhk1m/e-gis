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
import { makeDraggable } from '../utils/DraggableElement.js';
import { choroplethTool } from './ChoroplethTool.js';

class CartogramTool {
  constructor() {
    this.colorSchemes = {
      blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
      reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
      greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
      oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'],
      purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486'],
      spectral: ['#3288bd', '#66c2a5', '#abdda4', '#e6f598', '#fee08b', '#fdae61', '#f46d43', '#d53e4f']
    };
  }

  /**
   * 분류 정보 계산 (단계구분도와 동일한 분류 방식 재사용)
   * @returns {Object|null} { data, colors, breaks, minVal, maxVal }
   */
  buildClassification(features, attribute, colorScheme, method) {
    const data = [];
    const values = [];
    features.forEach(feature => {
      const value = parseFloat(feature.get(attribute));
      if (isNaN(value)) return;
      data.push({ feature, value });
      values.push(value);
    });
    if (data.length === 0) return null;

    values.sort((a, b) => a - b);
    const colors = this.colorSchemes[colorScheme] || this.colorSchemes.blues;
    const numClasses = Math.min(colors.length, Math.max(2, data.length));
    const breaks = choroplethTool.calculateBreaks(values, numClasses, method || 'quantile');

    return {
      data,
      colors,
      breaks,
      minVal: values[0],
      maxVal: values[values.length - 1]
    };
  }

  /**
   * 분류 색상 인덱스 (범위 클램프)
   */
  cartoColorIndex(value, breaks, numColors) {
    if (isNaN(value) || !breaks || breaks.length < 2) return 0;
    const idx = choroplethTool.getColorIndex(value, breaks);
    return Math.max(0, Math.min(idx, numColors - 1));
  }

  /**
   * 카토그램 레이어 스타일 함수 (속성값 기반 — 저장/복원 시에도 색 유지)
   * @param {Object} config - { attribute, colors, breaks, showLabels }
   */
  cartogramStyle(config) {
    const self = this;
    const { attribute, colors, breaks, showLabels } = config;
    return function (feature) {
      const val = parseFloat(feature.get(attribute));
      const color = colors[self.cartoColorIndex(val, breaks, colors.length)] || colors[0];
      return new Style({
        fill: new Fill({ color: self.hexToRgba(color, 0.85) }),
        stroke: new Stroke({ color: '#333', width: 1 }),
        text: showLabels ? new Text({
          text: String(feature.get('name') || feature.get('NAME') || ''),
          font: 'bold 11px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 3 }),
          overflow: true
        }) : undefined
      });
    };
  }

  /**
   * 저장된 카토그램 스타일 재적용 (복원용)
   */
  applyCartogramStyle(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo._cartogramConfig || !layerInfo.olLayer) return;
    layerInfo.olLayer.setStyle(this.cartogramStyle(layerInfo._cartogramConfig));
  }

  /**
   * 원형 폴리곤 생성 (지도 단위)
   */
  makeCirclePolygon(cx, cy, r, segments = 36) {
    const ring = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * 2 * Math.PI;
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return new Polygon([ring]);
  }

  /**
   * 정사각형 폴리곤 생성 (지도 단위) — Demers 카토그램용
   */
  makeSquarePolygon(cx, cy, side) {
    const h = side / 2;
    return new Polygon([[
      [cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]
    ]]);
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
      method = 'quantile',
      showLabels = false,
      iterations = 120,
      sizeScale = 1
    } = options;

    // 양수 값만 (원 면적은 양수 비례)
    const positives = features.filter(f => {
      const v = parseFloat(f.get(attribute));
      return !isNaN(v) && v > 0 && f.getGeometry();
    });
    const cls = this.buildClassification(positives, attribute, colorScheme, method);
    if (!cls) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    const data = cls.data.map(d => {
      const center = getCenter(d.feature.getGeometry().getExtent());
      return { feature: d.feature, value: d.value, center, x: center[0], y: center[1], radius: 0 };
    });

    // 전체 범위(bbox) 기준으로 원 면적을 값에 정확히 비례 (지도 단위)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.forEach(d => {
      minX = Math.min(minX, d.center[0]); maxX = Math.max(maxX, d.center[0]);
      minY = Math.min(minY, d.center[1]); maxY = Math.max(maxY, d.center[1]);
    });
    const bboxArea = Math.max((maxX - minX) * (maxY - minY), 1);
    const sumValue = data.reduce((s, d) => s + d.value, 0) || 1;
    const totalCircleArea = bboxArea * 0.4 * sizeScale; // 패킹 비율
    data.forEach(d => {
      // 면적 ∝ 값  →  r = sqrt(area/π)
      const area = (d.value / sumValue) * totalCircleArea;
      d.radius = Math.sqrt(area / Math.PI);
    });

    // 겹침 해소 (지도 단위 — 위치/반지름 단위 일치)
    this.applyForceLayout(data, iterations);

    // 속성 기반 스타일 함수로 색상 적용 (저장/복원에도 유지)
    const config = { attribute, colorScheme, method, colors: cls.colors, breaks: cls.breaks, showLabels, cartogramType: 'dorling' };

    const newFeatures = data.map(d => {
      const props = d.feature.getProperties();
      delete props.geometry;
      return new Feature({ geometry: this.makeCirclePolygon(d.x, d.y, d.radius), ...props });
    });

    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource, style: this.cartogramStyle(config) });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_Dorling_${attribute}`,
      type: 'vector',
      geometryType: 'Polygon',
      olLayer: vectorLayer,
      source: vectorSource
    });

    const newLayerInfo = layerManager.getLayer(newLayerId);
    if (newLayerInfo) newLayerInfo._cartogramConfig = config;

    // 범례 (색상 등급 + 원 크기)
    this.addLegend(newLayerId, `Dorling: ${attribute}`, cls.minVal, cls.maxVal, cls.colors, {
      sizeLegend: { minVal: cls.minVal, maxVal: cls.maxVal, shape: 'circle' }
    });

    return newLayerId;
  }

  /**
   * Dorling 원 패킹 — 원들이 겹치지 않으면서 서로 맞닿도록 배치
   * 균일 압축(중심으로 수축)으로 상대 배치를 유지한 채 틈을 메우고,
   * 겹침 반발로 원이 겹치지 않게 균형을 맞춘다.
   */
  applyForceLayout(data, iterations) {
    const n = data.length;
    if (n === 0) return;

    for (let iter = 0; iter < iterations; iter++) {
      // 1) 균일 압축 — 전체 무게중심으로 조금 수축시켜 틈을 메움
      //    (균일 스케일이라 상대 배치/방향은 유지됨)
      let gx = 0, gy = 0;
      for (const d of data) { gx += d.x; gy += d.y; }
      gx /= n; gy /= n;
      const shrink = 0.985;
      for (const d of data) {
        d.x = gx + (d.x - gx) * shrink;
        d.y = gy + (d.y - gy) * shrink;
      }

      // 2) 겹침 반발 (마지막에 수행 → 최종 상태는 겹침 없음)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = data[i], b = data[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius;
          if (dist > 1e-9 && dist < minDist) {
            const overlap = (minDist - dist) / 2;
            const mx = (dx / dist) * overlap;
            const my = (dy / dist) * overlap;
            a.x -= mx; a.y -= my;
            b.x += mx; b.y += my;
          } else if (dist <= 1e-9) {
            // 완전히 겹친 경우 살짝 분리
            a.x -= a.radius * 0.01;
            b.x += b.radius * 0.01;
          }
        }
      }
    }

    // 마무리: 압축 없이 반발만 반복해 잔여 겹침 제거
    for (let pass = 0; pass < 30; pass++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = data[i], b = data[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius;
          if (dist > 1e-9 && dist < minDist) {
            const overlap = (minDist - dist) / 2;
            const mx = (dx / dist) * overlap;
            const my = (dy / dist) * overlap;
            a.x -= mx; a.y -= my;
            b.x += mx; b.y += my;
            moved = true;
          }
        }
      }
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
      method = 'quantile',
      showLabels = false
    } = options;

    const positives = features.filter(f => {
      const v = parseFloat(f.get(attribute));
      return !isNaN(v) && v > 0 && f.getGeometry();
    });
    const cls = this.buildClassification(positives, attribute, colorScheme, method);
    if (!cls) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    // 면적이 값에 비례하도록 스케일 (scale = sqrt(value / 기준값))
    // 기준값 = 중앙값에 가까운 대표값(중앙 분위) → 작은 곳은 축소, 큰 곳은 확대
    const refValue = cls.breaks[Math.floor(cls.breaks.length / 2)] || cls.maxVal;

    const newFeatures = cls.data.map(({ feature, value }) => {
      const geom = feature.getGeometry();
      if (!geom) return null;

      const scale = Math.sqrt(value / (refValue || 1));
      const center = getCenter(geom.getExtent());
      const scaledGeom = this.scaleGeometry(geom.clone(), center, Math.max(0.05, scale));

      const props = feature.getProperties();
      delete props.geometry;
      return new Feature({ geometry: scaledGeom, ...props });
    }).filter(f => f !== null);

    const config = { attribute, colorScheme, method, colors: cls.colors, breaks: cls.breaks, showLabels, cartogramType: 'noncontiguous' };

    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource, style: this.cartogramStyle(config) });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_NonContig_${attribute}`,
      type: 'vector',
      geometryType: layer.geometryType,
      olLayer: vectorLayer,
      source: vectorSource
    });

    const newLayerInfo = layerManager.getLayer(newLayerId);
    if (newLayerInfo) newLayerInfo._cartogramConfig = config;

    this.addLegend(newLayerId, `Non-Contiguous: ${attribute}`, cls.minVal, cls.maxVal, cls.colors);

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
      method = 'quantile',
      showLabels = false,
      iterations = 15
    } = options;

    const positives = features.filter(f => {
      const v = parseFloat(f.get(attribute));
      const g = f.getGeometry();
      return !isNaN(v) && v > 0 && g && (g.getType() === 'Polygon' || g.getType() === 'MultiPolygon');
    });
    const cls = this.buildClassification(positives, attribute, colorScheme, method);
    if (!cls) {
      throw new Error(`속성 "${attribute}"에 유효한 숫자 데이터가 없습니다.`);
    }

    // 원래 폴리곤 형태를 유지한 채 면적만 값에 비례하도록 변형 (Dougenik 1985)
    const data = cls.data.map(d => ({
      feature: d.feature,
      value: d.value,
      geom: d.feature.getGeometry().clone()
    }));

    for (let iter = 0; iter < iterations; iter++) {
      // 1) 각 폴리곤의 현재 면적/중심/반경/질량 계산
      let totalArea = 0, totalValue = 0;
      data.forEach(d => {
        d.area = Math.abs(this.calculateGeometryArea(d.geom)) || 1e-9;
        let c = this.calculateCentroid(d.geom);
        // 접힘/퇴화로 중심이 비정상이면 경계상자 중심으로 폴백 (NaN 전파 차단)
        if (!c || !isFinite(c[0]) || !isFinite(c[1])) c = getCenter(d.geom.getExtent());
        d.center = c;
        totalArea += d.area;
        totalValue += d.value;
      });
      if (totalValue <= 0) break;

      let sizeErrorWeighted = 0;
      data.forEach(d => {
        d.radius = Math.sqrt(d.area / Math.PI);
        const desired = totalArea * d.value / totalValue;
        // 질량 = 목표반경 - 현재반경 (양수면 팽창, 음수면 수축)
        d.mass = Math.sqrt(Math.max(desired, 0) / Math.PI) - d.radius;
        const a = Math.max(d.area, 1e-9), de = Math.max(desired, 1e-9);
        d.sizeError = Math.max(a, de) / Math.min(a, de);
        sizeErrorWeighted += d.sizeError * d.area;
      });
      const meanError = sizeErrorWeighted / (totalArea || 1);
      const forceReductionFactor = 1 / (1 + meanError);

      // 2) 모든 정점을 전체 힘장(force field)으로 이동
      //    변위는 정점 위치만의 함수 → 인접 폴리곤 공유 정점이 함께 이동(경계 유지)
      const transformPoint = (pt) => {
        const x0 = pt[0], y0 = pt[1];
        let x = x0, y = y0;
        for (let k = 0; k < data.length; k++) {
          const o = data[k];
          if (o.radius < 1e-9 || !isFinite(o.mass) || !isFinite(o.center[0]) || !isFinite(o.center[1])) continue;
          const ddx = x0 - o.center[0];
          const ddy = y0 - o.center[1];
          const dist = Math.hypot(ddx, ddy);
          if (dist < 1e-9) continue;
          let force;
          if (dist > o.radius) {
            force = o.mass * o.radius / dist;
          } else {
            const xf = dist / o.radius;
            force = o.mass * xf * xf * (4 - 3 * xf);
          }
          const factor = force * forceReductionFactor / dist;
          x += factor * ddx;
          y += factor * ddy;
        }
        // 비정상 좌표면 원위치 유지 (NaN/Infinity 전파 차단)
        if (!isFinite(x) || !isFinite(y)) return [x0, y0];
        return [x, y];
      };

      data.forEach(d => {
        const g = d.geom;
        const t = g.getType();
        if (t === 'Polygon') {
          g.setCoordinates(g.getCoordinates().map(ring => ring.map(transformPoint)));
        } else if (t === 'MultiPolygon') {
          g.setCoordinates(g.getCoordinates().map(poly => poly.map(ring => ring.map(transformPoint))));
        }
      });
    }

    // 속성 기반 스타일 함수 (저장/복원에도 색 유지)
    const config = { attribute, colorScheme, method, colors: cls.colors, breaks: cls.breaks, showLabels, cartogramType: 'contiguous' };

    const newFeatures = data.map(d => {
      const props = d.feature.getProperties();
      delete props.geometry;
      return new Feature({ geometry: d.geom, ...props });
    });

    const vectorSource = new VectorSource({ features: newFeatures });
    const vectorLayer = new VectorLayer({ source: vectorSource, style: this.cartogramStyle(config) });

    const newLayerId = layerManager.addLayer({
      name: `${layer.name}_Contig_${attribute}`,
      type: 'vector',
      geometryType: layer.geometryType,
      olLayer: vectorLayer,
      source: vectorSource
    });

    const newLayerInfo = layerManager.getLayer(newLayerId);
    if (newLayerInfo) newLayerInfo._cartogramConfig = config;

    this.addLegend(newLayerId, `Contiguous: ${attribute}`, cls.minVal, cls.maxVal, cls.colors);

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
  addLegend(layerId, title, minVal, maxVal, colors, opts = {}) {
    // 기존 범례 제거
    const existingLegend = document.getElementById(`legend-${layerId}`);
    if (existingLegend) existingLegend.remove();

    // 원 크기 범례 (Dorling 비례기호)
    let sizeHtml = '';
    if (opts.sizeLegend) {
      const maxPx = 30;
      const minPx = Math.max(6, Math.round(maxPx * Math.sqrt(
        (opts.sizeLegend.minVal || 1) / (opts.sizeLegend.maxVal || 1)
      )));
      const isSquare = opts.sizeLegend.shape === 'square';
      const radius = isSquare ? '2px' : '50%';
      const sizeTitle = isSquare ? '사각형 크기 = 값' : '원 크기 = 값';
      sizeHtml = `
        <div class="legend-subtitle">${sizeTitle}</div>
        <div class="legend-size">
          <div class="legend-size-item">
            <span class="legend-size-dot" style="width:${maxPx}px;height:${maxPx}px;border-radius:${radius};"></span>
            <small>${maxVal.toLocaleString()}</small>
          </div>
          <div class="legend-size-item">
            <span class="legend-size-dot" style="width:${minPx}px;height:${minPx}px;border-radius:${radius};"></span>
            <small>${minVal.toLocaleString()}</small>
          </div>
        </div>
      `;
    }

    const legendHtml = `
      <div class="cartogram-legend" id="legend-${layerId}">
        <div class="legend-title">${title}</div>
        <div class="legend-gradient" style="background: linear-gradient(to right, ${colors.join(', ')});"></div>
        <div class="legend-labels">
          <span>${minVal.toLocaleString()}</span>
          <span>${maxVal.toLocaleString()}</span>
        </div>
        ${sizeHtml}
      </div>
    `;

    // 지도 컨테이너에 추가
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.insertAdjacentHTML('beforeend', legendHtml);
      const legendEl = document.getElementById(`legend-${layerId}`);
      if (legendEl) makeDraggable(legendEl, () => mapContainer);
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

      .cartogram-legend .legend-subtitle {
        margin-top: 10px;
        font-size: var(--font-size-xs);
        font-weight: 600;
        color: var(--text-primary);
      }

      .cartogram-legend .legend-size {
        display: flex;
        align-items: flex-end;
        gap: 14px;
        margin-top: 6px;
      }

      .cartogram-legend .legend-size-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .cartogram-legend .legend-size-dot {
        display: inline-block;
        border-radius: 50%;
        background: #9ecae1;
        border: 1px solid #333;
      }

      .cartogram-legend .legend-size-item small {
        font-size: 10px;
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
