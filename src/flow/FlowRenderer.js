// © 2026 김용현
/**
 * FlowRenderer — 흐름을 Canvas 2D 로 그리는 OpenLayers 레이어.
 *
 *  - 뷰(중심·해상도·회전·크기)가 바뀔 때만 픽셀 좌표와 Path2D 를 다시 만든다(_project).
 *  - 애니메이션 프레임은 만들어 둔 Path2D 를 다시 stroke 만 한다(_draw). 지도 전체를 다시 그리지 않는다.
 *  - 히트 캔버스에 흐름·위치마다 고유색을 칠해 두고 hitTest 는 픽셀 하나만 읽는다.
 *  - 애니메이션은 lineDashOffset 을 매 프레임 밀어 출발→도착으로 흐르는 점선 (flowmap.blue 와 같은 방식).
 */
import Layer from 'ol/layer/Layer';
import { fromLonLat } from 'ol/proj';
import { apply as applyTransform } from 'ol/transform';
import { curvePoints, taperOutline } from './flowGeometry.js';
import {
  COLOR_RAMPS, rampColor, flowStrength, flowWidth, locationRadius, aggregateTotals, visibleFlows
} from './flowModel.js';

export const DEFAULT_FLOW_STYLE = {
  ramp: 'teal',          // COLOR_RAMPS 키
  widthScale: 1,         // 굵기 배율
  maxWidth: 12,          // 가장 큰 흐름의 머리 폭(px)
  opacity: 0.85,
  animate: true,
  animSpeed: 1,
  showLocations: true,
  showLabels: true,
  includeSelf: false,    // 자기 흐름을 유입·유출 집계에 넣을지
  topN: 0,               // 0 = 모두 표시
  locationMaxRadius: 14
};

const INFLOW_COLOR = '#22c55e';
const OUTFLOW_COLOR = '#ef4444';
const DIM_ALPHA = 0.08;
const LABEL_ALL_BELOW_RESOLUTION = 500; // 이보다 확대하면 라벨을 전부 보인다
const LABEL_TOP_N = 12;

const idToColor = (n) => '#' + n.toString(16).padStart(6, '0');

export class FlowRenderer extends Layer {
  constructor(options = {}) {
    super(options);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'flow-layer-canvas';
    this.canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    this.ctx = this.canvas.getContext('2d');
    this.hitCanvas = document.createElement('canvas');
    this.hitCtx = this.hitCanvas.getContext('2d', { willReadFrequently: true });

    this.dataset = null;
    this.style = { ...DEFAULT_FLOW_STYLE };
    this.highlightIds = new Set();
    this.hoverKey = null;

    this._derived = null;   // 데이터·스타일에서 유도 (setData/setStyle 때만)
    this._viewKey = null;   // 마지막으로 투영한 뷰
    this._paths = null;     // 뷰별 Path2D
    this._pixelRatio = 1;
    this._dashOffset = 0;
    this._raf = null;
    this._skipFrames = 0;
    this._frozen = false;

    this.on('change:visible', () => this._syncAnimation());
    this.on('change:map', () => this._syncAnimation());
  }

  // ---- 공개 API ------------------------------------------------------------

  setData(dataset) {
    this.dataset = dataset;
    this._derive();
    this._viewKey = null;
    this.changed();
    this._syncAnimation();
  }

  setStyle(patch) {
    this.style = { ...this.style, ...patch };
    this._derive();
    this._viewKey = null;
    this.changed();
    this._syncAnimation();
  }

  setHighlight(ids) {
    this.highlightIds = new Set(ids || []);
    this._redraw();
  }

  setHover(key) {
    if (this.hoverKey === key) return;
    this.hoverKey = key;
    this._redraw();
  }

  setAnimation(on) { this.setStyle({ animate: !!on }); }

  /** 내보내기 캡처 동안 점선 대신 실선으로 멈춰 둔다 */
  freeze(on) {
    this._frozen = !!on;
    this._syncAnimation();
    this._redraw();
  }

  getTotals() { return this._derived ? this._derived.totals : new Map(); }
  getLocation(id) { return this._derived ? this._derived.locById.get(id) || null : null; }
  getFlowCount() { return this._derived ? this._derived.flows.length : 0; }

  /**
   * @param {[number,number]} pixel  CSS 픽셀 (OL evt.pixel)
   * @returns {{type:'flow',key,flow}|{type:'location',key,location,totals}|null}
   */
  hitTest(pixel) {
    if (!this._paths) return null;
    const pr = this._pixelRatio;
    const d = this.hitCtx.getImageData(Math.round(pixel[0] * pr), Math.round(pixel[1] * pr), 1, 1).data;
    if (d[3] < 255) return null; // 테두리의 혼색 픽셀은 잘못된 id 를 줄 수 있어 버린다
    const id = (d[0] << 16) | (d[1] << 8) | d[2];
    if (id === 0) return null;
    const { flowPaths, locPaths } = this._paths;
    if (id <= flowPaths.length) {
      const fp = flowPaths[id - 1];
      // 안티앨리어싱 혼색이 엉뚱한 id 를 줄 수 있어, 실제로 그 선 위인지 기하로 다시 확인한다
      this.hitCtx.lineWidth = Math.max(fp.width, 8);
      if (!this.hitCtx.isPointInStroke(fp.center, pixel[0] * pr, pixel[1] * pr)) return null;
      return { type: 'flow', key: 'f:' + fp.index, flow: fp.flow };
    }
    const lp = locPaths[id - flowPaths.length - 1];
    if (!lp) return null;
    if (Math.hypot(pixel[0] - lp.p[0], pixel[1] - lp.p[1]) > Math.max(lp.r, 8)) return null;
    return { type: 'location', key: 'l:' + lp.index, location: lp.loc, totals: lp.total };
  }

  // ---- OL Layer ------------------------------------------------------------

  render(frameState) {
    if (!this._derived) return null;
    const [w, h] = frameState.size;
    const pr = frameState.pixelRatio;
    const vs = frameState.viewState;
    const key = [vs.center[0], vs.center[1], vs.resolution, vs.rotation, w, h, pr].join('|');
    if (key !== this._viewKey) {
      this._resize(w, h, pr);
      this._project(frameState);
      this._viewKey = key;
    }
    this.canvas.style.opacity = String(this.getOpacity());
    this._draw();
    return this.canvas;
  }

  disposeInternal() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    super.disposeInternal();
  }

  // ---- 내부 ----------------------------------------------------------------

  _derive() {
    const ds = this.dataset;
    if (!ds) { this._derived = null; this._paths = null; return; }
    const locById = new Map(ds.locations.map((l) => [l.id, l]));
    // locations 에 없는 위치를 가리키는 흐름(불일치 데이터)은 render() 를 죽이지 않도록,
    // 또 집계에 유령 위치가 섞이지 않도록 한 번만 걸러내 흐름 선별·집계 모두에 먹인다
    const consistent = ds.flows.filter((f) => locById.has(f.origin) && locById.has(f.dest));
    const flows = visibleFlows({ ...ds, flows: consistent }, this.style);
    const totals = aggregateTotals({ ...ds, flows: consistent }, this.style);
    const maxCount = flows.reduce((m, f) => Math.max(m, f.count), 0);
    let maxTotal = 0;
    for (const t of totals.values()) maxTotal = Math.max(maxTotal, t.inflow + t.outflow);
    const stops = COLOR_RAMPS[this.style.ramp] || COLOR_RAMPS.teal;
    this._derived = { flows, totals, maxCount, maxTotal, locById, locations: ds.locations, stops };
  }

  _resize(w, h, pr) {
    for (const c of [this.canvas, this.hitCanvas]) {
      c.width = Math.round(w * pr);
      c.height = Math.round(h * pr);
    }
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._pixelRatio = pr;
  }

  /** 뷰가 바뀌었을 때만: 위치 → 픽셀, 흐름 → Path2D, 히트 캔버스 */
  _project(frameState) {
    const { flows, maxCount, totals, maxTotal, stops, locations } = this._derived;
    const s = this.style;
    const px = new Map();
    for (const loc of locations) {
      px.set(loc.id, applyTransform(frameState.coordinateToPixelTransform, fromLonLat([loc.lon, loc.lat])));
    }

    const flowPaths = flows.map((f, i) => {
      const w1 = flowWidth(f.count, maxCount, s.maxWidth * s.widthScale);
      const a = px.get(f.origin);
      const b = px.get(f.dest);
      // 양방향 리본이 겹치지 않게: 굽힘 오프셋이 머리 폭 + 여유보다 작아지면(짧은 현) 더 굽힌다.
      // 오프셋 = bend × 현 길이, 보이는 처짐은 그 절반이므로 현 < 5·w1 이면 기본 0.2 로는 겹친다.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const bend = len > 0 ? Math.min(1, Math.max(0.2, (w1 + 4) / len)) : 0.2;
      const pts = curvePoints(a, b, { bend, samples: 24 });
      const outline = new Path2D();
      taperOutline(pts, Math.max(0.6, w1 * 0.15), w1)
        .forEach(([x, y], k) => (k === 0 ? outline.moveTo(x, y) : outline.lineTo(x, y)));
      outline.closePath();
      const center = new Path2D();
      pts.forEach(([x, y], k) => (k === 0 ? center.moveTo(x, y) : center.lineTo(x, y)));
      return { flow: f, index: i, outline, center, width: w1, color: rampColor(stops, flowStrength(f.count, maxCount)) };
    });

    const locPaths = locations.map((loc, j) => {
      const t = totals.get(loc.id) || { inflow: 0, outflow: 0, net: 0 };
      return { loc, index: j, p: px.get(loc.id), r: locationRadius(t.inflow + t.outflow, maxTotal, s.locationMaxRadius), total: t };
    });

    // 라벨은 총량 상위만 (겹침 방지). 충분히 확대하면 전부
    const labelCount = frameState.viewState.resolution < LABEL_ALL_BELOW_RESOLUTION
      ? locPaths.length : Math.min(locPaths.length, LABEL_TOP_N);
    const labelIds = new Set(
      [...locPaths]
        .sort((a, b) => (b.total.inflow + b.total.outflow) - (a.total.inflow + a.total.outflow))
        .slice(0, labelCount)
        .map((l) => l.loc.id)
    );

    this._paths = { flowPaths, locPaths, labelIds };
    this._drawHit();
  }

  _drawHit() {
    const ctx = this.hitCtx;
    const pr = this._pixelRatio;
    const { flowPaths, locPaths } = this._paths;
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, this.hitCanvas.width / pr, this.hitCanvas.height / pr);
    ctx.lineCap = 'round';
    for (const fp of flowPaths) {
      ctx.strokeStyle = idToColor(fp.index + 1);
      ctx.lineWidth = Math.max(fp.width, 8);
      ctx.stroke(fp.center);
    }
    const base = flowPaths.length + 1;
    for (const lp of locPaths) {
      ctx.fillStyle = idToColor(base + lp.index);
      ctx.beginPath();
      ctx.arc(lp.p[0], lp.p[1], Math.max(lp.r, 8), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _draw() {
    const paths = this._paths;
    if (!paths) return;
    const ctx = this.ctx;
    const pr = this._pixelRatio;
    const s = this.style;
    const hl = this.highlightIds;
    const dimming = hl.size > 0;
    const animate = s.animate && !this._frozen;

    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / pr, this.canvas.height / pr);

    let hoveredFp = null;
    for (const fp of paths.flowPaths) {
      const touched = !dimming || hl.has(fp.flow.origin) || hl.has(fp.flow.dest);
      const hovered = this.hoverKey === 'f:' + fp.index;
      if (hovered && touched) hoveredFp = fp;
      ctx.globalAlpha = touched ? s.opacity : DIM_ALPHA;
      ctx.fillStyle = fp.color;
      ctx.fill(fp.outline);
      if (animate && touched) {
        ctx.save();
        ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = this._dashOffset;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, fp.width * 0.45);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.globalAlpha = Math.min(1, s.opacity + 0.1);
        ctx.stroke(fp.center);
        ctx.restore();
      }
    }
    ctx.setLineDash([]);

    // 호버한 흐름은 나중에 그려진 더 큰 흐름에 덮이지 않도록 맨 위에 한 번 더 그린다
    if (hoveredFp) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = hoveredFp.color;
      ctx.fill(hoveredFp.outline);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke(hoveredFp.outline);
    }

    if (s.showLocations) {
      ctx.font = '600 11px Pretendard, sans-serif';
      ctx.lineJoin = 'round';
      ctx.textBaseline = 'middle';
      for (const lp of paths.locPaths) {
        const active = hl.has(lp.loc.id) || this.hoverKey === 'l:' + lp.index;
        ctx.globalAlpha = dimming && !hl.has(lp.loc.id) ? 0.35 : 1;
        ctx.beginPath();
        ctx.arc(lp.p[0], lp.p[1], lp.r, 0, Math.PI * 2);
        ctx.fillStyle = lp.total.net >= 0 ? INFLOW_COLOR : OUTFLOW_COLOR;
        ctx.fill();
        ctx.lineWidth = active ? 3 : 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        if (s.showLabels && paths.labelIds.has(lp.loc.id)) {
          const x = lp.p[0] + lp.r + 4;
          const y = lp.p[1];
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.65)';
          ctx.strokeText(lp.loc.name, x, y);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(lp.loc.name, x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  _redraw() { if (this._paths) this._draw(); }

  _syncAnimation() {
    // 지도에서 떨어져 나간 레이어(map === null)는 rAF 를 계속 돌릴 이유가 없다.
    // getMapInternal() 은 map.addLayer 로 붙은 관리 레이어만 채워진다 — layer.setMap(map) 로 붙인
    // 비관리(unmanaged) 레이어는 렌더링은 되지만 이 루프 조건에서 걸러져 애니메이션은 돌지 않는다.
    const want = !!(this._derived && this.style.animate && !this._frozen && this.getVisible() && this.getMapInternal());
    if (want && !this._raf) this._tick();
    if (!want && this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  /** 적응형 루프: 한 프레임이 33ms 를 넘으면 그만큼 프레임을 건너뛴다 (지도 조작이 굳지 않게) */
  _tick() {
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      if (this._skipFrames > 0) { this._skipFrames--; this._tick(); return; }
      this._dashOffset -= 0.9 * this.style.animSpeed; // 오프셋이 줄면 점선이 경로 방향(출발→도착)으로 흐른다
      const t0 = performance.now();
      this._draw();
      const dt = performance.now() - t0;
      if (dt > 33) this._skipFrames = Math.min(5, Math.floor(dt / 33));
      this._tick();
    });
  }
}
