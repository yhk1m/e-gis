// © 2026 김용현
// 이미지 지리참조(GCP) — 이미지 픽셀 ↔ 지도 좌표(EPSG:3857) 대응점으로
// 아핀(3점+) 또는 원근/호모그래피(4점+) 변환을 최소제곱으로 구해 지도에 워핑 렌더.
// 각 레이어는 자기 렌더상태(renderState)를 클로저로 캡처 → 세션 정리 후에도 유지된다.
import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Style, Circle as CircleStyle, Fill, Stroke, Text as TextStyle } from 'ol/style';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import * as math from 'mathjs';
import { mapManager } from '../core/MapManager.js';
import { layerManager } from '../core/LayerManager.js';

/** 최소제곱 아핀: (x=a·u+b·v+c, y=d·u+e·v+f). 3점 미만·특이 → null. */
export function computeAffine(gcps) {
  if (!Array.isArray(gcps) || gcps.length < 3) return null;
  const M = gcps.map((g) => [g.imgX, g.imgY, 1]);
  try {
    const Mt = math.transpose(M);
    const MtM = math.multiply(Mt, M);
    const abc = math.lusolve(MtM, math.multiply(Mt, gcps.map((g) => [g.mapX])));
    const def = math.lusolve(MtM, math.multiply(Mt, gcps.map((g) => [g.mapY])));
    const coef = { a: abc[0][0], b: abc[1][0], c: abc[2][0], d: def[0][0], e: def[1][0], f: def[2][0] };
    return Object.values(coef).every(Number.isFinite) ? coef : null;
  } catch (e) { return null; }
}

/** 최소제곱 호모그래피(원근): 이미지→지도 3x3 행렬. 4점 미만·특이 → null. */
export function computeProjective(gcps) {
  if (!Array.isArray(gcps) || gcps.length < 4) return null;
  const A = [];
  const b = [];
  for (const g of gcps) {
    const u = g.imgX, v = g.imgY, x = g.mapX, y = g.mapY;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push([x]);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push([y]);
  }
  try {
    const At = math.transpose(A);
    const h = math.lusolve(math.multiply(At, A), math.multiply(At, b)); // 8x1
    const H = [
      [h[0][0], h[1][0], h[2][0]],
      [h[3][0], h[4][0], h[5][0]],
      [h[6][0], h[7][0], 1],
    ];
    return H.flat().every(Number.isFinite) ? H : null;
  } catch (e) { return null; }
}

/** GCP+모드 → 변환 서술자 {type, forward(u,v)->[x,y], coef?|Hinv?}. 원근 실패 시 아핀 폴백. */
function buildTransform(gcps, mode) {
  if (mode === 'projective') {
    const H = computeProjective(gcps);
    if (H) {
      try {
        const Hinv = math.inv(H);
        return {
          type: 'projective', Hinv,
          forward: (u, v) => {
            const w = H[2][0] * u + H[2][1] * v + H[2][2];
            return [(H[0][0] * u + H[0][1] * v + H[0][2]) / w, (H[1][0] * u + H[1][1] * v + H[1][2]) / w];
          },
        };
      } catch (e) { /* 특이 → 아핀 폴백 */ }
    }
  }
  const c = computeAffine(gcps);
  if (!c) return null;
  return { type: 'affine', coef: c, forward: (u, v) => [c.a * u + c.b * v + c.c, c.d * u + c.e * v + c.f] };
}

/** 이미지 네 모서리를 변환한 뒤의 바운딩 박스(3857 extent). */
function cornersExtent(t, w, h) {
  const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([u, v]) => t.forward(u, v));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** 원본 이미지 → 자연 크기 ImageData(원근 리샘플용, 최초 1회). */
function imageToData(image) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth; c.height = image.naturalHeight;
  const cx = c.getContext('2d');
  cx.drawImage(image, 0, 0);
  return cx.getImageData(0, 0, c.width, c.height);
}

/** renderState(캡처됨) 기준으로 현재 view extent를 워핑 렌더. this 미참조 → 세션 정리 후에도 안전. */
function renderLayerCanvas(rs, extent, size) {
  const w = Math.round(size[0]);
  const h = Math.round(size[1]);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const t = rs.transform;
  if (!t || !rs.image || w === 0 || h === 0) return canvas;

  if (t.type === 'affine') {
    const { a, b, c, d, e, f } = t.coef;
    const sx = w / (extent[2] - extent[0]);
    const sy = h / (extent[3] - extent[1]);
    // px = a·sx·u + b·sx·v + (c-extent[0])·sx ,  py = -d·sy·u - e·sy·v + (extent[3]-f)·sy
    ctx.setTransform(a * sx, -d * sy, b * sx, -e * sy, (c - extent[0]) * sx, (extent[3] - f) * sy);
    ctx.drawImage(rs.image, 0, 0);
    return canvas;
  }

  // 원근: 출력 픽셀 → 지도좌표 → 역호모그래피 → 이미지 픽셀 리샘플(최근접)
  if (!rs.srcData) rs.srcData = imageToData(rs.image);
  const src = rs.srcData;
  const sd = src.data, sw = src.width, sh = src.height;
  const H = t.Hinv;
  const out = ctx.createImageData(w, h);
  const od = out.data;
  const dx = (extent[2] - extent[0]) / w;
  const dy = (extent[3] - extent[1]) / h;
  for (let py = 0; py < h; py++) {
    const y = extent[3] - (py + 0.5) * dy;
    for (let px = 0; px < w; px++) {
      const x = extent[0] + (px + 0.5) * dx;
      const wc = H[2][0] * x + H[2][1] * y + H[2][2];
      const u = (H[0][0] * x + H[0][1] * y + H[0][2]) / wc;
      const v = (H[1][0] * x + H[1][1] * y + H[1][2]) / wc;
      const iu = u | 0, iv = v | 0;
      if (iu < 0 || iv < 0 || iu >= sw || iv >= sh) continue;
      const si = (iv * sw + iu) * 4;
      const oi = (py * w + px) * 4;
      od[oi] = sd[si]; od[oi + 1] = sd[si + 1]; od[oi + 2] = sd[si + 2]; od[oi + 3] = sd[si + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** 이미지+변환으로 워핑 ImageLayer 생성(지도엔 아직 미추가). {layer, rs} 반환. */
function makeWarpLayer(image, transform, opacity) {
  const rs = { image, srcData: null, transform };
  const source = new ImageCanvasSource({
    canvasFunction: (extent, resolution, pixelRatio, size) => renderLayerCanvas(rs, extent, size),
    ratio: 1,
  });
  const ext = cornersExtent(transform, image.naturalWidth, image.naturalHeight);
  const layer = new ImageLayer({ source, extent: ext, opacity, zIndex: 500 });
  return { layer, rs };
}

class GeoreferenceTool {
  constructor() {
    this.image = null;
    this.previewLayer = null;
    this.renderState = null; // 현재 미리보기 레이어가 캡처한 {image, srcData, transform}
    this.markerLayer = null;
    this.markerSource = null;
    this.pickHandler = null;
    this.opacity = 0.7;
  }

  _ensureMarkerLayer() {
    if (this.markerLayer) return;
    this.markerSource = new VectorSource();
    this.markerLayer = new VectorLayer({ source: this.markerSource, zIndex: 2000 });
    mapManager.getMap().addLayer(this.markerLayer);
  }

  addMapMarker(coordinate, label) {
    this._ensureMarkerLayer();
    const feat = new Feature({ geometry: new Point(coordinate) });
    feat.setId(label);
    feat.setStyle(new Style({
      image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#e11d48' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
      text: new TextStyle({ text: String(label), fill: new Fill({ color: '#fff' }), font: 'bold 11px sans-serif' }),
    }));
    this.markerSource.addFeature(feat);
  }

  removeMapMarker(label) {
    if (!this.markerSource) return;
    const f = this.markerSource.getFeatureById(label);
    if (f) this.markerSource.removeFeature(f);
  }

  pickMapPoint(callback) {
    const map = mapManager.getMap();
    this.cancelPick();
    if (this.previewLayer) this.previewLayer.setVisible(false); // 지도 잘 보이게 미리보기 잠시 숨김
    map.getTargetElement().style.cursor = 'crosshair';
    this.pickHandler = (evt) => {
      this.cancelPick();
      if (this.previewLayer) this.previewLayer.setVisible(true);
      callback(evt.coordinate);
    };
    map.on('click', this.pickHandler);
  }

  cancelPick() {
    const map = mapManager.getMap();
    if (!map) return;
    map.getTargetElement().style.cursor = '';
    if (this.pickHandler) { map.un('click', this.pickHandler); this.pickHandler = null; }
  }

  /** GCP·모드로 미리보기 갱신. { ok, type }. */
  updatePreview(gcps, mode) {
    const t = buildTransform(gcps, mode);
    const map = mapManager.getMap();
    if (!t || !this.image || !map) { this.removePreview(); return { ok: false }; }
    const ext = cornersExtent(t, this.image.naturalWidth, this.image.naturalHeight);
    if (!this.previewLayer) {
      const { layer, rs } = makeWarpLayer(this.image, t, this.opacity);
      this.renderState = rs;
      this.previewLayer = layer;
      map.addLayer(this.previewLayer);
    } else {
      this.renderState.transform = t; // srcData는 이미지 동일하므로 유지(원근 재계산 시 재사용)
      this.previewLayer.setExtent(ext);
      this.previewLayer.setOpacity(this.opacity);
      this.previewLayer.setVisible(true); // 점 선택 중 숨겼던 미리보기 복원
      this.previewLayer.getSource().changed();
    }
    return { ok: true, type: t.type };
  }

  setOpacity(op) {
    this.opacity = op;
    if (this.previewLayer) this.previewLayer.setOpacity(op);
  }

  removePreview() {
    const map = mapManager.getMap();
    if (this.previewLayer && map) map.removeLayer(this.previewLayer);
    this.previewLayer = null;
    this.renderState = null;
  }

  /** 미리보기 레이어를 정식 레이어(layerManager)로 승격. 레이어의 클로저가 rs를 붙들고 있어 자립적. */
  commit(name, gcps, mode) {
    if (!this.previewLayer) return null;
    const map = mapManager.getMap();
    const layer = this.previewLayer;
    const img = this.renderState && this.renderState.image;
    map.removeLayer(layer);
    const layerId = layerManager.addLayer({
      name: name || '지리참조 이미지', type: 'raster', olLayer: layer, source: null, geometryType: 'Raster',
    });
    const info = layerManager.getLayer(layerId);
    if (info) {
      const op = layer.getOpacity();
      info.opacity = op;
      // 프로젝트 저장·복원용(이미지 base64 + 기준점 + 모드). deserialize에서 restoreGeoref로 재구성.
      if (img) {
        info.georefData = {
          imageDataUrl: img.src,
          mode,
          opacity: op,
          gcps: (gcps || []).map((g) => ({ imgX: g.imgX, imgY: g.imgY, mapX: g.mapX, mapY: g.mapY })),
        };
      }
    }
    this.previewLayer = null;
    this.renderState = null; // rs는 레이어 클로저가 계속 참조 → GC 안 됨, 커밋 후에도 렌더 유지
    return layerId;
  }

  /** 저장된 georefData에서 지리참조 레이어를 재구성(프로젝트 복원용). Promise<layerId|null>. */
  restoreGeoref(georefData, name) {
    return new Promise((resolve) => {
      if (!georefData || !georefData.imageDataUrl) { resolve(null); return; }
      const img = new Image();
      img.onload = () => {
        const t = buildTransform(georefData.gcps || [], georefData.mode);
        if (!t) { resolve(null); return; }
        const op = typeof georefData.opacity === 'number' ? georefData.opacity : 0.7;
        const { layer } = makeWarpLayer(img, t, op);
        const layerId = layerManager.addLayer({
          name: name || '지리참조 이미지', type: 'raster', olLayer: layer, source: null, geometryType: 'Raster',
        });
        const info = layerManager.getLayer(layerId);
        if (info) { info.opacity = op; info.georefData = georefData; } // 재저장 시에도 유지
        resolve(layerId);
      };
      img.onerror = () => resolve(null);
      img.src = georefData.imageDataUrl;
    });
  }

  /** 세션 정리 — 커밋된 레이어에는 영향 없음(각자 rs 캡처). */
  cleanup() {
    this.cancelPick();
    this.removePreview();
    const map = mapManager.getMap();
    if (this.markerLayer && map) map.removeLayer(this.markerLayer);
    this.markerLayer = null; this.markerSource = null;
    this.image = null;
  }
}

export const georeferenceTool = new GeoreferenceTool();
