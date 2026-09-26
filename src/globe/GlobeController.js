// © 2026 김용현
/**
 * 지구본 조립부 — LayerManager·MapManager 를 아는 유일한 곳.
 *
 * enter(): #map-container 에 캔버스를 얹고 2D 중심을 정면으로 돌린다.
 * exit():  캔버스를 걷고 정면의 경위도를 2D 중심으로 옮긴다.
 * 레이어 이벤트가 오면 다시 그린다. 피처의 4326 변환은 레이어별로 캐시하고
 * 벡터 소스가 바뀌거나 revision 이 바뀌면(피처 편집·추가) 다시 변환한다.
 *
 * 이 모듈(src/globe/*)은 GlobePanel 이 동적 import 한다 — d3 를 안 켜는 사용자는 받지 않는다.
 * DOM 은 메서드 안에서만 만진다(import 만으로는 아무 일도 없다).
 */
import { eventBus, Events } from '../utils/EventBus.js';
import { fillFor, onFillAssetsReady } from '../tools/classFillCanvas.js';
import { PROJECTIONS, DEFAULT_PROJECTION, findProjection, make as makeProjection, fitScale } from './projections.js';
import {
  rotationFromCenter, centerFromRotation, rotationAfterDrag, clampScale, scaleAfterWheel
} from './globeMath.js';
import { buildDrawList, paint, skippedSummary } from './globeRenderer.js';
import { layerToLonLat } from './toLonLatFeatures.js';

export { PROJECTIONS, DEFAULT_PROJECTION };

/** 배경 육지 — 이미 내장된 실습 자료(Natural Earth, 4326). 처음 켤 때 한 번 받아 둔다. */
export const LAND_URL = './data/builtin/practice/Area Data/행정경계/세계 국가.geojson';

/** 드래그 중 한 프레임이 이보다 오래 걸리면 그 드래그 동안은 레이어를 빼고 그린다 */
const SLOW_FRAME_MS = 32;

/** 픽셀비 상한 — 고해상도 화면에서 캔버스가 지나치게 커지지 않게 */
const MAX_PIXEL_RATIO = 2;

/** 휠 deltaMode 1(줄 단위, Firefox)을 픽셀로 */
const LINE_HEIGHT_PX = 16;

/** 지구본을 다시 그려야 하는 2D 쪽 변화 */
const REDRAW_EVENTS = [
  Events.LAYER_ADDED,
  Events.LAYER_REMOVED,
  Events.LAYER_VISIBILITY_CHANGED,
  Events.LAYER_ORDER_CHANGED,
  Events.LAYER_STYLE_CHANGED,
  Events.LAYER_RENAMED
];

const FALLBACK_COLORS = {
  ocean: '#dbeafe', land: '#e7e5e4', landStroke: '#a8a29e', graticule: 'rgba(100, 116, 139, 0.35)', outline: '#64748b'
};

let landPromise = null;   // 모듈 단위 캐시 — 껐다 켜도 다시 받지 않는다

function loadLand() {
  if (!landPromise) {
    landPromise = fetch(encodeURI(LAND_URL)).then((res) => {
      if (!res.ok) throw new Error(`land ${res.status}`);
      return res.json();
    }).catch((error) => {
      landPromise = null;   // 다음에 켜면 다시 시도한다
      throw error;
    });
  }
  return landPromise;
}

/** 유한한 [λ, φ, γ] 만 받는다. 아니면 fallback. */
function safeRotation(rotation, fallback = [0, 0, 0]) {
  if (!Array.isArray(rotation)) return fallback.slice();
  const [l, p, g = 0] = rotation;
  return [l, p, g].every(Number.isFinite) ? [l, p, g] : fallback.slice();
}

export class GlobeController {
  /**
   * @param {{mapManager: object, layerManager: object, container: HTMLElement}} deps
   *   container 는 캔버스를 얹을 요소(#map-container)
   */
  constructor({ mapManager, layerManager, container }) {
    this.mapManager = mapManager;
    this.layerManager = layerManager;
    this.container = container;

    this.canvas = null;
    this.ctx = null;
    this.active = false;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;

    this.projectionKey = DEFAULT_PROJECTION;
    this.rotation = [0, 0, 0];
    this.homeRotation = [0, 0, 0];
    this.fit = 1;
    this.scale = 1;
    this.showGraticule = true;
    this.showLand = true;

    this.land = null;
    this.landFailed = false;
    this.landError = null;         // 실패 이유(문자열) — 패널이 보여 줄 수 있다
    this.cache = new Map();        // layerId → { source, revision, collection }
    this.frameId = null;

    this.pointers = new Map();     // pointerId → [x, y]
    this.dragging = false;
    this.lite = false;
    this.pinchDistance = 0;

    this.skipped = [];             // 지구본에 못 올린 레이어 [{id, name, reason}]
    this.onSkippedChanged = null;  // (summary: string) => void
    this.onLandFailed = null;      // () => void
    this.lastSkippedSummary = null;
  }

  /** 지구본을 켠다 — 2D 중심을 정면으로 */
  enter() {
    if (this.active || !this.container) return;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'globe-canvas';
    this.canvas.setAttribute('aria-label', '지구본');
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    let center = null;
    try { center = this.mapManager?.getCenter?.(); } catch { center = null; }
    this.rotation = safeRotation(Array.isArray(center) ? rotationFromCenter(center) : null);
    this.homeRotation = this.rotation.slice();
    if (findProjection(this.projectionKey).kind === 'cylindrical') this.rotation[1] = 0;

    this.active = true;
    this.measure();
    this.scale = this.fit;

    this.bindInput();
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
    // 옆 패널이 접히는 등 창은 그대로인데 지도 영역만 바뀌는 경우
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
    // 테마를 바꾸면 CSS 변수 색이 바뀐다 — 알려 주는 이벤트가 없어 속성을 지켜본다
    if (typeof MutationObserver === 'function') {
      this.themeObserver = new MutationObserver(() => this.schedule());
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    this.redrawHandler = () => this.schedule();
    this.removedHandler = (data) => {
      if (data && data.layerId != null) this.cache.delete(data.layerId);
    };
    eventBus.on(Events.LAYER_REMOVED, this.removedHandler);
    REDRAW_EVENTS.forEach((name) => eventBus.on(name, this.redrawHandler));
    // 이미지 채움은 디코딩이 끝나야 패턴이 된다(fillFor 는 동기) — 끝나면 다시 그린다
    this.offFillAssets = onFillAssetsReady(() => this.schedule());

    this.schedule();
    loadLand().then((land) => {
      this.land = land;
      this.landFailed = false;
      this.landError = null;
      this.schedule();
    }).catch((error) => {
      console.error('배경 육지를 불러오지 못했습니다', error);
      this.landFailed = true;
      this.landError = String(error?.message || error);
      if (this.active && this.onLandFailed) this.onLandFailed();
      this.schedule();
    });
  }

  /** 지구본을 끈다 — 정면의 경위도를 2D 중심으로 */
  exit() {
    if (!this.active) return;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    REDRAW_EVENTS.forEach((name) => eventBus.off(name, this.redrawHandler));
    eventBus.off(Events.LAYER_REMOVED, this.removedHandler);
    if (this.offFillAssets) this.offFillAssets();
    this.offFillAssets = null;
    window.removeEventListener('resize', this.resizeHandler);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = null;
    if (this.themeObserver) this.themeObserver.disconnect();
    this.themeObserver = null;
    this.unbindInput();
    this.canvas.remove();
    this.canvas = null;
    this.ctx = null;
    this.cache.clear();
    this.active = false;

    const center = this.currentCenter();
    if (center.every(Number.isFinite)) {
      try {
        this.mapManager?.setCenter?.(center, false);
      } catch (error) {
        console.error('지구본 정면을 2D 중심으로 옮기지 못했습니다', error);
      }
    }
  }

  /** 정면의 경위도 */
  currentCenter() {
    return centerFromRotation(this.rotation);
  }

  /** 지금 지구본에 못 올린 레이어 요약 한 줄(없으면 '') */
  skippedText() {
    return skippedSummary(this.skipped);
  }

  /** 투영법을 바꾼다. 정면은 유지, 확대 비율도 유지, 원통 투영은 φ 를 0 으로 */
  setProjection(key) {
    const entry = findProjection(key);
    if (!this.active) {            // 켜기 전(패널이 초기값을 심을 때)에는 키만 기억한다
      this.projectionKey = entry.key;
      return;
    }
    const ratio = this.zoomRatio();
    this.projectionKey = entry.key;
    if (entry.kind === 'cylindrical') this.rotation = [this.rotation[0], 0, 0];
    this.fit = fitScale(this.projectionKey, this.width, this.height);
    this.setScale(this.fit * ratio);
    this.schedule();
  }

  setGraticule(on) {
    this.showGraticule = Boolean(on);
    this.schedule();
  }

  setLand(on) {
    this.showLand = Boolean(on);
    this.schedule();
  }

  /** 더블클릭: 처음 자세(들어올 때 정면, 맞춤 배율)로 */
  resetView() {
    this.rotation = this.homeRotation.slice();
    if (findProjection(this.projectionKey).kind === 'cylindrical') this.rotation[1] = 0;
    this.scale = this.fit;
    this.schedule();
  }

  /** 오버레이 캔버스 그대로 PNG(data URL). 꺼져 있으면 null. */
  toDataURL() {
    if (!this.canvas) return null;
    // 예약된 프레임이 있으면 지금 그려서 최신 화면을 담는다
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
      this.draw();
    }
    return this.canvas.toDataURL('image/png');
  }

  // ----- 배율 -----

  /** 맞춤 배율 대비 지금 배율. 망가진 값이면 1(맞춤). */
  zoomRatio() {
    const ratio = this.scale / this.fit;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }

  /** NaN·0 이하는 받지 않는다 — 맞춤 배율로 물러선다 */
  setScale(next) {
    const value = clampScale(next, this.fit);
    this.scale = Number.isFinite(value) && value > 0 ? value : this.fit;
  }

  // ----- 크기 -----

  measure() {
    this.width = this.container.clientWidth || 1;
    this.height = this.container.clientHeight || 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.canvas.width = Math.max(1, Math.round(this.width * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.round(this.height * this.pixelRatio));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    const fit = fitScale(this.projectionKey, this.width, this.height);
    this.fit = Number.isFinite(fit) && fit > 0 ? fit : 1;
  }

  resize() {
    if (!this.active) return;
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return;
    const ratio = this.zoomRatio();
    this.measure();
    this.setScale(this.fit * ratio);
    this.schedule();
  }

  // ----- 그리기 -----

  schedule() {
    if (!this.active || this.frameId !== null) return;
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      this.draw();
    });
  }

  readColors() {
    const style = getComputedStyle(document.documentElement);
    const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    return {
      ocean: read('--globe-ocean', FALLBACK_COLORS.ocean),
      land: read('--globe-land', FALLBACK_COLORS.land),
      landStroke: read('--globe-land-stroke', FALLBACK_COLORS.landStroke),
      graticule: read('--globe-graticule', FALLBACK_COLORS.graticule),
      outline: read('--globe-outline', FALLBACK_COLORS.outline)
    };
  }

  /** 레이어별 4326 컬렉션 — 같은 소스·같은 revision 이면 캐시를 쓴다 */
  collectionsFor(items) {
    const result = new Map();
    for (const layerInfo of items) {
      const source = layerInfo.source || layerInfo.olLayer?.getSource?.() || null;
      const revision = typeof source?.getRevision === 'function' ? source.getRevision() : 0;
      let cached = this.cache.get(layerInfo.id);
      if (!cached || cached.source !== source || cached.revision !== revision) {
        let collection;
        try {
          collection = layerToLonLat(layerInfo);
        } catch (error) {
          console.error(`지구본: '${layerInfo.name}' 레이어를 경위도로 바꾸지 못했습니다`, error);
          collection = { type: 'FeatureCollection', features: [] };
        }
        cached = { source, revision, collection };
        this.cache.set(layerInfo.id, cached);
      }
      result.set(layerInfo.id, cached.collection);
    }
    return result;
  }

  /** 없어진 레이어의 캐시를 버린다(숨긴 레이어는 남겨 다시 켤 때 재변환하지 않는다) */
  pruneCache(layers) {
    const alive = new Set(layers.map((l) => l && l.id));
    for (const id of this.cache.keys()) {
      if (!alive.has(id)) this.cache.delete(id);
    }
  }

  draw() {
    if (!this.active || !this.ctx) return;
    this.rotation = safeRotation(this.rotation, this.homeRotation);
    if (!(Number.isFinite(this.scale) && this.scale > 0)) this.scale = this.fit;

    const projection = makeProjection(this.projectionKey, this.width, this.height, {
      rotate: this.rotation, scale: this.scale
    });
    const layers = this.layerManager?.getAllLayers?.() || [];
    const { items, skipped } = buildDrawList(layers);
    this.pruneCache(layers);
    const collections = this.collectionsFor(items);

    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    const started = performance.now();
    paint(this.ctx, {
      width: this.width,
      height: this.height,
      projection,
      items,
      collections,
      land: this.land,
      colors: this.readColors(),
      showGraticule: this.showGraticule,
      showLand: this.showLand,
      lite: this.dragging && this.lite,
      fillFor,
      pixelScale: this.pixelRatio
    });
    if (this.dragging && !this.lite && performance.now() - started > SLOW_FRAME_MS) {
      this.lite = true;   // 이 드래그 동안은 육지·경위선만. 놓으면 전체를 다시 그린다.
    }

    this.skipped = skipped;
    const summary = skippedSummary(skipped);
    if (summary !== this.lastSkippedSummary) {
      this.lastSkippedSummary = summary;
      if (this.onSkippedChanged) this.onSkippedChanged(summary);
    }
  }

  // ----- 입력 -----

  bindInput() {
    const c = this.canvas;
    this.handlers = {
      pointerdown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;   // 왼쪽 버튼만 돌린다
        try { c.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 */ }
        this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (this.pointers.size === 1) {
          this.dragging = true;
          this.lite = false;
          c.style.cursor = 'grabbing';
        } else if (this.pointers.size === 2) {
          this.dragging = false;
          this.pinchDistance = this.pinchSpan();
        }
      },
      pointermove: (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        const previous = this.pointers.get(e.pointerId);
        this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (this.pointers.size === 2) {
          const span = this.pinchSpan();
          if (this.pinchDistance > 0 && span > 0) {
            this.setScale(this.scale * (span / this.pinchDistance));
          }
          this.pinchDistance = span;
          this.schedule();
          return;
        }
        if (!this.dragging) return;
        const dx = e.clientX - previous[0];
        const dy = e.clientY - previous[1];
        this.rotation = safeRotation(rotationAfterDrag(
          this.rotation, dx, dy, this.scale, findProjection(this.projectionKey).kind
        ), this.rotation);
        this.schedule();
      },
      pointerup: (e) => this.releasePointer(e),
      pointercancel: (e) => this.releasePointer(e),
      wheel: (e) => {
        e.preventDefault();
        const deltaY = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT_PX : e.deltaY;
        if (!Number.isFinite(deltaY) || deltaY === 0) return;
        this.setScale(scaleAfterWheel(this.scale, deltaY, this.fit));
        this.schedule();
      },
      dblclick: (e) => {
        e.preventDefault();
        this.resetView();
      }
    };
    for (const [name, fn] of Object.entries(this.handlers)) {
      c.addEventListener(name, fn, name === 'wheel' ? { passive: false } : undefined);
    }
  }

  unbindInput() {
    if (!this.handlers || !this.canvas) return;
    for (const [name, fn] of Object.entries(this.handlers)) this.canvas.removeEventListener(name, fn);
    this.handlers = null;
    this.pointers.clear();
    this.dragging = false;
    this.lite = false;
    this.pinchDistance = 0;
  }

  releasePointer(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      const wasLite = this.lite;
      this.dragging = false;
      this.lite = false;
      if (this.canvas) this.canvas.style.cursor = 'grab';
      if (wasLite) this.schedule();   // 드래그 중 뺀 레이어를 다시 그린다
    } else if (this.pointers.size === 1) {
      this.dragging = true;
      this.pinchDistance = 0;
    }
  }

  pinchSpan() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0;
  }
}
