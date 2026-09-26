// © 2026 김용현
/**
 * 지구본 그리기 — 목록(순수)과 캔버스(paint).
 *
 * 순서: 바다(구 전체) → 경위선 10° → 육지 → 레이어(아래→위) → 구 윤곽.
 * 색은 호출자가 CSS 변수에서 읽어 넘긴다(라이트·다크). 폴리곤 채움은 1단계 fillFor 를
 * 주입받아 쓴다 — 지구본이 classFillCanvas 를 직접 import 하지 않으므로 순수 부분을
 * 노드에서 테스트할 수 있고, 1단계 시그니처가 바뀌어도 GlobeController 한 곳만 고친다.
 *
 * 보이지 않는 반구: d3 geoOrthographic 은 기본 clipAngle(90) 이라 geoPath 가 뒤쪽 반구를
 * 알아서 잘라 낸다(방위 등면적은 clipAngle(180) 근처). 여기서 따로 거를 필요가 없다.
 */
import { geoPath, geoGraticule10 } from 'd3';
import { featureStyle, rgba } from './layerStyles.js';

const SPHERE = { type: 'Sphere' };
const GRATICULE = geoGraticule10();

const DEFAULT_COLORS = {
  ocean: '#dbe9f4',
  land: '#f2efe6',
  landStroke: '#b9b2a2',
  graticule: 'rgba(0, 0, 0, 0.12)',
  outline: '#8a8a8a'
};

/**
 * 지구본에 못 올리는 이유. 올릴 수 있으면 null.
 * 래스터·DEM·히트맵·도형표현도·흐름도·라벨은 스펙에서 뺐다.
 */
export function unsupportedReason(layerInfo) {
  if (!layerInfo) return '없음';
  if (layerInfo.demData) return 'DEM';
  if (layerInfo.type === 'raster' || layerInfo.geometryType === 'Raster') return '래스터';
  if (layerInfo.type === 'heatmap') return '히트맵';
  if (layerInfo.type === 'chartmap') return '도형표현도';
  if (layerInfo.type === 'flow' || layerInfo.geometryType === 'Flow') return '흐름도';
  const hasSource = Boolean(layerInfo.source) || typeof layerInfo.olLayer?.getSource === 'function';
  if (!hasSource) return '벡터 아님';
  return null;
}

/**
 * @param {object[]} layers layerManager.getAllLayers() — 아래→위
 * @returns {{items: object[], skipped: {id: string, name: string, reason: string}[]}}
 */
export function buildDrawList(layers) {
  const items = [];
  const skipped = [];
  for (const layerInfo of layers || []) {
    if (!layerInfo || layerInfo.visible === false) continue;
    const reason = unsupportedReason(layerInfo);
    if (reason) skipped.push({ id: layerInfo.id, name: layerInfo.name, reason });
    else items.push(layerInfo);
  }
  return { items, skipped };
}

/** 컨트롤 박스에 보일 한 줄 */
export function skippedSummary(skipped) {
  if (!skipped || skipped.length === 0) return '';
  return '지구본에 표시되지 않음: ' + skipped.map((s) => `${s.name}(${s.reason})`).join(', ');
}

/** 'point' | 'line' | 'polygon' | null(그릴 수 없음). 채움은 polygon 에만. */
function geometryKind(feature) {
  const t = String(feature?.geometry?.type || '').replace(/^Multi/, '');
  if (t === 'Point') return 'point';
  if (t === 'LineString') return 'line';
  if (t === 'Polygon') return 'polygon';
  return null;   // GeometryCollection·빈 geometry 는 건너뛴다
}

/** fillFor 가 없거나 던지면 단색으로 물러선다 */
function polygonFill(fillFor, style, pixelScale) {
  if (typeof fillFor === 'function') {
    try {
      const fill = fillFor(style.fillSpec, style.fillColor, style.fillOpacity, pixelScale);
      if (fill) return fill;
    } catch {
      // 무늬를 못 만들면 단색
    }
  }
  return rgba(style.fillColor, style.fillOpacity);
}

function strokeCurrentPath(ctx, style) {
  if (!(style.strokeWidth > 0)) return;
  ctx.strokeStyle = rgba(style.strokeColor, style.strokeOpacity);
  ctx.lineWidth = style.strokeWidth;
  ctx.stroke();
}

function paintFeature(ctx, path, layerInfo, feature, fillFor, pixelScale) {
  const kind = geometryKind(feature);
  if (!kind) return;
  const style = featureStyle(layerInfo, feature.properties);
  ctx.setLineDash(style.lineDash || []);
  ctx.lineDashOffset = 0;

  if (kind === 'point') {
    path.pointRadius(style.pointRadius);
    ctx.beginPath();
    path(feature);
    // 점은 2D 에서도 원 채움 — 투명도 0 이면 칠하지 않는다
    if (style.fillOpacity > 0) {
      ctx.fillStyle = rgba(style.fillColor, style.fillOpacity);
      ctx.fill();
    }
    strokeCurrentPath(ctx, style);
    return;
  }

  ctx.beginPath();
  path(feature);
  if (kind === 'polygon' && style.fillOpacity > 0) {
    const fill = polygonFill(fillFor, style, pixelScale);
    if (typeof fill === 'string') {
      ctx.fillStyle = fill;
      ctx.fill();
    } else {
      // CanvasPattern 타일은 기기 픽셀(pixelScale 배)로 그려져 있다. ctx 에는 호출자의
      // 픽셀비 변환이 걸려 있어 그대로 칠하면 무늬 간격이 pixelScale 배 더 커진다.
      // 경로는 만들 때 이미 기기 픽셀로 바뀌었으므로 변환만 풀고 칠한다 — 2D 지도와 같은 간격.
      // (패턴 객체는 1단계 캐시가 2D 와 함께 쓰므로 pattern.setTransform 으로 건드리지 않는다.)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }
  }
  strokeCurrentPath(ctx, style);
}

/**
 * 캔버스에 그린다. ctx 의 변환(픽셀비)은 호출자가 맞춰 둔다.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   width: number, height: number,
 *   projection: Function,                       projections.make() 결과
 *   items: object[],                            buildDrawList().items
 *   collections: Map<string, object>,           레이어 id → GeoJSON FeatureCollection(4326)
 *   land: object|null,                          세계 국가 FeatureCollection
 *   colors: {ocean: string, land: string, landStroke: string, graticule: string, outline: string},
 *   showGraticule: boolean, showLand: boolean,  (기본 true)
 *   lite: boolean,                              드래그 중 느릴 때: 바다·경위선·육지·윤곽만
 *   fillFor: (spec, baseColor, fillOpacity, pixelScale) => string|CanvasPattern,  없으면 단색
 *   pixelScale: number
 * }} opts
 */
export function paint(ctx, opts) {
  if (!ctx || !opts || !opts.projection) return;
  const {
    width = 0, height = 0, projection, land = null,
    showGraticule = true, showLand = true, lite = false, fillFor = null, pixelScale = 1
  } = opts;
  const items = opts.items || opts.drawList?.items || [];
  const collections = opts.collections || new Map();
  const colors = { ...DEFAULT_COLORS, ...(opts.colors || {}) };
  const path = geoPath(projection, ctx);

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. 바다
  ctx.beginPath();
  path(SPHERE);
  ctx.fillStyle = colors.ocean;
  ctx.fill();

  // 2. 경위선
  if (showGraticule) {
    ctx.beginPath();
    path(GRATICULE);
    ctx.strokeStyle = colors.graticule;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // 3. 육지
  if (showLand && land) {
    ctx.beginPath();
    path(land);
    ctx.fillStyle = colors.land;
    ctx.fill();
    ctx.strokeStyle = colors.landStroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 4. 레이어 (아래→위)
  if (!lite) {
    for (const layerInfo of items) {
      const features = collections.get(layerInfo.id)?.features;
      if (!Array.isArray(features)) continue;
      for (const feature of features) {
        paintFeature(ctx, path, layerInfo, feature, fillFor, pixelScale);
      }
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // 5. 구 윤곽
  ctx.beginPath();
  path(SPHERE);
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();

  ctx.restore();
}
