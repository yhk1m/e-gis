// © 2026 김용현
// eStoryMap/src/core/DemRenderer.js
// .egis 래스터(dem/analysis) → OL ImageLayer(ImageCanvasSource).
// 이식 원본: e-GIS DEMLoader.buildDEMLayer + RasterAnalysisTool.buildAnalysisLayer.
// 원본의 layerManager/mapManager/범례(DOM)/eventBus 의존은 제거 — 레이어 생성만(탈싱글턴).
import ImageLayer from 'ol/layer/Image';
import ImageCanvasSource from 'ol/source/ImageCanvas';
import { decodeRasterMeta } from './rasterDecode.js';
import { computeRasterPixels, demColorAt, analysisColorAt } from './rasterPixels.js';

/** 정규화된 레이어가 복원 가능한 래스터인지. (unknown/데이터 결손은 e-GIS처럼 스킵) */
export function canBuildRasterLayer(layerData) {
  if (!layerData || layerData.type !== 'raster') return false;
  if (layerData.rasterKind !== 'dem' && layerData.rasterKind !== 'analysis') return false;
  const r = layerData.raster;
  return !!(r && r.data && r.width > 0 && r.height > 0
    && Array.isArray(r.extent) && r.extent.length === 4);
}

/** 픽셀 계산(순수) 결과를 캔버스로 옮기는 접착부. */
function renderToCanvas(raster, colorAt, viewExtent, size) {
  // size는 OL이 부동소수점으로 전달할 수 있음 → 정수 고정 (원본 renderDEM 주의사항)
  const w = Math.round(size[0]);
  const h = Math.round(size[1]);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const pixels = computeRasterPixels(raster, viewExtent, [w, h], colorAt);
  ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  return canvas;
}

/**
 * 정규화된 래스터 레이어 데이터(egisParse 산출) → OL ImageLayer.
 * raster.data가 이미 TypedArray면(생 .tif 경로) decodeRasterMeta는 그대로 통과시킨다.
 */
export function buildRasterLayer(layerData) {
  const raster = decodeRasterMeta(layerData.raster);
  const colorAt = layerData.rasterKind === 'dem'
    ? demColorAt(raster)
    : analysisColorAt(raster);
  const layer = new ImageLayer({
    source: new ImageCanvasSource({
      canvasFunction: (viewExtent, resolution, pixelRatio, size) =>
        renderToCanvas(raster, colorAt, viewExtent, size),
      ratio: 1,
    }),
    extent: raster.extent,
    visible: layerData.visible,
    opacity: layerData.opacity,
  });
  layer.set('egisLayerId', layerData.id);
  layer.set('egisLayerName', layerData.name);
  return layer;
}
