// © 2026 김용현
/**
 * localRouting - 내장 도로망(표준노드링크)으로 경로·등시선을 계산해
 * OpenRouteService와 같은 모양의 GeoJSON으로 돌려준다.
 *
 * 결과 형식을 API와 맞춘 덕분에 기존 IsochroneTool.displayIsochrones /
 * RoutingTool.displayRoute 를 그대로 재사용한다.
 */

import { fromLonLat, toLonLat } from 'ol/proj';
import { roadNetwork } from './RoadNetwork.js';
import { RouterEngine, PROFILES, speedProfile } from './RouterEngine.js';
import { buildIsochronePolygons } from './isochroneField.js';

const DEFAULT_CHUNK = 'korea-major';

/**
 * 내장 도로망에서 고르는 이동 수단.
 * 수단은 "지날 수 있는 도로"를, 속도는 "걸리는 시간"을 정한다.
 * 고속국도·도시고속국도는 자동차전용도로라 도보·자전거는 지날 수 없다.
 */
export const LOCAL_MODES = {
  foot: { label: '도보', defaultSpeed: 4, excludeHighway: true },
  bike: { label: '자전거', defaultSpeed: 15, excludeHighway: true },
  car: { label: '자동차', defaultSpeed: 40, excludeHighway: false }
};

/** ORS 프로파일 이름 → 내장 엔진 프로파일 */
export function toLocalProfile(orsProfile) {
  return orsProfile === 'foot-walking' || orsProfile === 'foot' ? 'foot' : 'car';
}

let engine = null;
let engineChunk = null;

/**
 * 도로망을 로드하고 엔진을 준비한다 (이미 준비돼 있으면 재사용)
 * @param {(loaded:number,total:number)=>void} [onProgress]
 */
export async function ensureNetwork(onProgress, chunkName) {
  const chunk = await roadNetwork.load(chunkName || DEFAULT_CHUNK, onProgress);
  if (!engine || engineChunk !== chunk) {
    engine = new RouterEngine(chunk);
    engineChunk = chunk;
  }
  return { chunk, engine };
}

/** 도로망이 이미 준비됐는지 */
export function isNetworkReady(chunkName) {
  return !!engine && roadNetwork.loadedName === (chunkName || DEFAULT_CHUNK);
}

/** 고를 수 있는 도로망 목록 (UI용) */
export async function listNetworks() {
  const catalog = await roadNetwork.getCatalog();
  return (catalog.chunks || []).slice().sort((a, b) => a.edges - b.edges);
}

/** 지도 좌표(3857)를 도로망 노드에 붙인다 */
function snapOrThrow(lonLat, label) {
  const [x, y] = fromLonLat(lonLat);
  const hit = roadNetwork.snap(x, y);
  if (!hit) {
    throw new Error(`${label}에서 가까운 도로를 찾지 못했습니다. 도로가 있는 곳을 선택해주세요.`);
  }
  // EPSG:3857은 우리 위도에서 거리가 약 1.25배 부풀어 있다
  return { node: hit.node, x, y, meters: hit.distance / 1.25 };
}

/**
 * 옵션에서 이동 프로파일을 정한다.
 * speedKmh가 있으면 사용자가 정한 시속으로 전 구간을 계산한다(제한속도 무시).
 */
function resolveProfile(options) {
  if (options.speedKmh > 0) return speedProfile(options.speedKmh, !!options.excludeHighway);
  return PROFILES[options.profile] ? options.profile : 'car';
}

/** 도로에 접근하는 속도(m/s) — 프로파일 속도가 없으면(승용차) 대표값을 쓴다 */
function accessSpeedOf(engine) {
  return engine.profile.speedMps || (40 / 3.6);
}

/**
 * 등시선 GeoJSON (ORS isochrones와 같은 모양 — 값 오름차순 폴리곤들)
 * @param {number[]} lonLat 출발 지점 [경도, 위도]
 * @param {object} options { intervals: 분 배열, profile: 'car'|'foot' }
 */
export async function buildIsochroneGeoJSON(lonLat, options = {}) {
  const intervals = (options.intervals || [5, 10, 15]).slice().sort((a, b) => a - b);

  const { chunk } = await ensureNetwork(options.onProgress, options.chunk);
  engine.setProfile(resolveProfile(options));

  const start = snapOrThrow(lonLat, '출발 지점');
  // 찍은 지점에서 가장 가까운 도로까지 가는 시간. 이걸 빼야 등시선이 그 지점 기준이 된다.
  const accessSeconds = start.meters / accessSpeedOf(engine);
  const features = [];

  intervals.forEach(minutes => {
    const maxSeconds = minutes * 60;
    const budget = maxSeconds - accessSeconds;
    const reach = budget > 0
      ? engine.reachable(start.node, budget)
      : { nodes: [], times: new Float32Array(0), edgeTips: [] };

    // 도로 밖으로 벗어날 수 있는 거리 — 갈 수 있는 거리의 8% 정도, 최대 250m.
    // 이 값이 크면 등시선이 도로와 무관한 덩어리가 되고 강·산도 덮어 버린다.
    const reachMeters = accessSpeedOf(engine) * maxSeconds;
    const maxOffRoad = Math.min(250, reachMeters * 0.08);

    const { polygons } = buildIsochronePolygons(chunk, reach, {
      maxSeconds,
      // 도로를 벗어난 이동은 걷는 속도로 본다 (차를 타고 논밭을 가로지르진 않는다)
      offRoadSpeed: 4 / 3.6,
      maxOffRoad,
      // 도보·자전거에서 지날 수 없는 링크는 구간도 그리지 않는다
      isPassable: (edge) => isFinite(engine.costOf(edge)),
      origin: { x: start.x, y: start.y, node: start.node, seconds: accessSeconds }
    });

    if (polygons.length === 0) return;

    features.push({
      type: 'Feature',
      properties: { value: maxSeconds, group_index: 0 },
      geometry: {
        type: 'MultiPolygon',
        // map(toLonLat)로 넘기면 두 번째 인자에 배열 인덱스가 들어가 좌표계로 해석된다
        coordinates: polygons.map(rings => rings.map(ring => ring.map(xy => toLonLat(xy))))
      }
    });
  });

  if (features.length === 0) {
    throw new Error('도달 범위를 만들지 못했습니다. 시간을 늘리거나 다른 지점을 선택해보세요.');
  }
  return { type: 'FeatureCollection', features };
}

/**
 * 최단경로 GeoJSON (ORS directions와 같은 모양 — summary.distance/duration 포함)
 * @param {number[][]} coordinates [[경도,위도], ...] 출발 → 경유 → 도착
 */
export async function buildRouteGeoJSON(coordinates, options = {}) {
  if (!coordinates || coordinates.length < 2) {
    throw new Error('출발지와 도착지가 필요합니다.');
  }
  await ensureNetwork(options.onProgress, options.chunk);
  await roadNetwork.ensureGeometry(options.onGeometryProgress);
  engine.setProfile(resolveProfile(options));

  const nodes = coordinates.map((c, i) =>
    snapOrThrow(c, i === 0 ? '출발지' : i === coordinates.length - 1 ? '도착지' : `경유지 ${i}`).node);

  const line = [];
  let seconds = 0, meters = 0;

  for (let i = 0; i < nodes.length - 1; i++) {
    const leg = engine.shortestPath(nodes[i], nodes[i + 1]);
    if (!leg) {
      throw new Error('도로를 따라 갈 수 있는 경로가 없습니다. (섬·일방통행으로 막힌 구간일 수 있습니다)');
    }
    seconds += leg.seconds;
    meters += leg.meters;

    leg.edges.forEach((edgeIndex, k) => {
      const coords = roadNetwork.edgeGeometry(edgeIndex, leg.nodes[k]);
      coords.forEach((xy, j) => {
        // 링크 이음매에서 같은 점이 두 번 들어가지 않게
        if (j === 0 && line.length > 0) return;
        line.push(toLonLat(xy));
      });
    });
  }

  if (line.length < 2) {
    throw new Error('경로 형상을 만들지 못했습니다.');
  }

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        summary: { distance: meters, duration: seconds },
        engine: 'local'
      },
      geometry: { type: 'LineString', coordinates: line }
    }]
  };
}

/** 도로망 메타 정보 (UI 표시용) */
export async function getNetworkInfo() {
  const catalog = await roadNetwork.getCatalog();
  return (catalog.chunks || []).find(c => c.name === DEFAULT_CHUNK) || null;
}
