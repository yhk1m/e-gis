// © 2026 김용현
/**
 * 구간 채움 — 캔버스 쪽.
 *
 * classFill.planFill 이 만든 명령 목록을 타일 캔버스에 그리고(renderFillCanvas),
 * 그 타일을 OpenLayers Fill 이 그대로 받는 CanvasPattern 으로 바꾼다(fillFor).
 * 스타일 함수는 피처마다 불리므로 패턴은 사양 키로 메모한다.
 *
 * 이미지 채움은 디코딩이 비동기다. fillFor 는 동기여야 하므로(OL 스타일 함수)
 * 아직 안 읽힌 이미지는 기준색으로 물러서고, 읽히면 onFillAssetsReady 구독자
 * (ChoroplethTool)가 그 레이어를 다시 스타일링한다.
 *
 * 2D 컨텍스트가 없는 환경(jsdom)에서는 예외 없이 기준색 문자열로 물러선다.
 */
import { planFill, normalizeFill, IMAGE_MAX_SIDE } from './classFill.js';

const PATTERN_CACHE_MAX = 200;

/** dataUrl → HTMLImageElement | 'loading' | 'error' */
const imageCache = new Map();
/** dataUrl → 짧은 id (메모 키에 200KB 문자열을 넣지 않기 위해) */
const imageIds = new Map();
const readyListeners = new Set();
let patternCache = new Map();
let scratchCanvas = null;

function defaultCreateCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function imageIdOf(dataUrl) {
  if (!imageIds.has(dataUrl)) imageIds.set(dataUrl, imageIds.size + 1);
  return imageIds.get(dataUrl);
}

export function getCachedImage(dataUrl) {
  const v = imageCache.get(dataUrl);
  return v && typeof v === 'object' ? v : null;
}

/**
 * 이미지 디코딩이 끝날 때마다 부른다.
 * @returns {() => void} 해제 함수
 */
export function onFillAssetsReady(cb) {
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

/** 테스트·메모리 정리용 */
export function clearFillCache() {
  patternCache = new Map();
}

/**
 * dataUrl 을 한 번만 디코딩한다. 끝나면 패턴 메모를 비우고 구독자에게 알린다.
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadImage(dataUrl) {
  const cached = imageCache.get(dataUrl);
  if (cached && typeof cached === 'object') return Promise.resolve(cached);
  if (cached === 'error') return Promise.resolve(null);
  if (cached === 'loading') {
    return new Promise((resolve) => {
      const off = onFillAssetsReady(() => { off(); resolve(getCachedImage(dataUrl)); });
    });
  }
  imageCache.set(dataUrl, 'loading');
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(dataUrl, img);
      clearFillCache();
      readyListeners.forEach((cb) => cb());
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(dataUrl, 'error');
      readyListeners.forEach((cb) => cb());
      resolve(null);
    };
    img.src = dataUrl;
  });
}

/**
 * 계획을 타일 캔버스에 그린다.
 * @param {ReturnType<typeof planFill>} plan
 * @param {{createCanvas?: Function, getImage?: Function}} deps  테스트 주입용
 * @returns {HTMLCanvasElement|null} 컨텍스트가 없으면 null
 */
export function renderFillCanvas(plan, { createCanvas = defaultCreateCanvas, getImage = getCachedImage } = {}) {
  const [w, h] = Array.isArray(plan.size) ? plan.size : [plan.size || 1, plan.size || 1];
  const canvas = createCanvas(Math.max(1, w), Math.max(1, h));
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;

  if (plan.background) {
    ctx.fillStyle = plan.background;
    ctx.fillRect(0, 0, w, h);
  }

  for (const o of plan.ops) {
    ctx.save();
    switch (o.op) {
      case 'rect':
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        break;
      case 'line':
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.width;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();
        break;
      case 'circle':
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'path':
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        o.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        break;
      case 'image': {
        const img = getImage(o.dataUrl);
        if (img) {
          ctx.globalAlpha = o.opacity;
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        }
        break;
      }
      case 'tint':
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = o.alpha;
        ctx.fillStyle = o.color;
        ctx.fillRect(0, 0, w, h);
        break;
      case 'alpha':
        if (o.value < 1) {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = `rgba(0,0,0,${o.value})`;
          ctx.fillRect(0, 0, w, h);
        }
        break;
      default:
        break;
    }
    ctx.restore();
  }
  return canvas;
}

function patternKey(normalized, baseColor, fillOpacity, pixelScale) {
  const keySpec = normalized.kind === 'image'
    ? { ...normalized, dataUrl: `#img${imageIdOf(normalized.dataUrl)}` }
    : normalized;
  return JSON.stringify([keySpec, baseColor, fillOpacity, pixelScale]);
}

function scratchContext() {
  if (!scratchCanvas) scratchCanvas = defaultCreateCanvas(1, 1);
  return scratchCanvas.getContext && scratchCanvas.getContext('2d');
}

/**
 * OpenLayers Fill.color 에 넣을 값.
 * @returns {string|CanvasPattern} 단색·물러섬은 'rgba(…)', 패턴은 CanvasPattern
 */
export function fillFor(spec, baseColor, fillOpacity = 1, pixelScale = 1) {
  const normalized = normalizeFill(spec);
  const plan = planFill(normalized, baseColor, fillOpacity, { pixelScale });
  if (plan.ops.length === 0) return plan.background;

  const key = patternKey(normalized, baseColor, fillOpacity, pixelScale);
  const cached = patternCache.get(key);
  if (cached) return cached;

  if (normalized.kind === 'image' && !getCachedImage(normalized.dataUrl)) {
    loadImage(normalized.dataUrl);   // 끝나면 onFillAssetsReady → 다시 스타일링
    return plan.fallback;
  }

  const ctx = scratchContext();
  if (!ctx) return plan.fallback;
  const tile = renderFillCanvas(plan);
  if (!tile) return plan.fallback;

  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return plan.fallback;
  if (patternCache.size >= PATTERN_CACHE_MAX) patternCache.clear();
  patternCache.set(key, pattern);
  return pattern;
}

/**
 * 범례 색 칸에 넣을 작은 타일(불투명, 화면 배율 1).
 * @returns {string|null} data URL. 컨텍스트가 없거나 이미지가 아직이면 null.
 */
export function tileDataUrl(spec, baseColor, size = 24) {
  const normalized = normalizeFill(spec);
  if (normalized.kind === 'solid') return null;
  if (normalized.kind === 'image' && !getCachedImage(normalized.dataUrl)) {
    loadImage(normalized.dataUrl);
    return null;
  }
  const tile = renderFillCanvas(planFill(normalized, baseColor, 1, { pixelScale: 1 }));
  if (!tile) return null;
  const out = defaultCreateCanvas(size, size);
  const ctx = out.getContext && out.getContext('2d');
  if (!ctx) return null;
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return null;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, size, size);
  return out.toDataURL('image/png');
}

/**
 * 업로드 이미지(PNG·JPG·SVG)를 긴 변 maxSide 픽셀 PNG 로 다시 인코딩한다.
 * .egis 와 IndexedDB 크기를 잡기 위해서다.
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
export function reencodeImageFile(file, maxSide = IMAGE_MAX_SIDE) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || '')) {
      reject(new Error('이미지 파일이 아닙니다.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!(nw > 0) || !(nh > 0)) {
        reject(new Error('이미지 크기를 알 수 없습니다.'));
        return;
      }
      const ratio = Math.min(1, maxSide / Math.max(nw, nh));
      const width = Math.max(1, Math.round(nw * ratio));
      const height = Math.max(1, Math.round(nh * ratio));
      const canvas = defaultCreateCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('캔버스를 쓸 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
      } catch (e) {
        reject(new Error('이미지를 변환할 수 없습니다.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = url;
  });
}
