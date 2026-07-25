// © 2026 김용현
/**
 * isochroneField - 도달 노드 집합 → 등시선 폴리곤
 *
 * 도달한 노드들을 그대로 감싸면(concave hull) 가장자리가 들쭉날쭉하고 구멍이 생긴다.
 * 대신 격자에 "남은 시간"을 뿌린 뒤 도로 밖으로 걸어 나갈 수 있는 만큼 번지게 하고,
 * 그 경계선을 등치선으로 뽑는다. 래스터 등고선과 같은 방식이라 결과가 매끄럽다.
 *
 * OpenLayers를 import하지 않는다 — Node에서 그대로 검증할 수 있게.
 */

import { contours } from 'd3-contour';

/** EPSG:3857은 우리 위도에서 실제 거리보다 약 1.25배 길게 나온다 */
const MERCATOR_STRETCH = 1.25;

/**
 * @param {object} chunk RoadNetwork.chunk
 * @param {object} reach RouterEngine.reachable 결과
 * @param {object} options
 * @param {number} options.maxSeconds 제한 시간
 * @param {number} [options.offRoadSpeed] 도로를 벗어나 이동하는 속도 (m/s, 기본 도보 4km/h)
 * @param {number} [options.maxOffRoad] 도로에서 벗어날 수 있는 최대 거리 (m, 기본 300)
 * @param {number} [options.targetCells] 격자 한 변의 목표 칸 수 (클수록 정밀·느림)
 * @returns {{polygons: number[][][][], cellSize:number, width:number, height:number}}
 *   polygons: [ [ ring[[x,y],...], hole[...] ], ... ] (EPSG:3857)
 */
export function buildIsochronePolygons(chunk, reach, options) {
  const maxSeconds = options.maxSeconds;
  const offRoadSpeed = options.offRoadSpeed || (4 / 3.6);
  const targetCells = options.targetCells || 320;

  // 출발점에서 도로까지 가는 데 쓴 시간 — 도로 위 시간에 모두 더해진다
  const origin = options.origin || null;
  const offset = origin ? origin.seconds : 0;

  const timeOf = new Map();
  reach.nodes.forEach((n, i) => {
    const t = reach.times[i] + offset;
    if (t <= maxSeconds) timeOf.set(n, t);
  });
  if (timeOf.size === 0 && !origin) return { polygons: [], cellSize: 0, width: 0, height: 0 };

  // 도로 밖으로 번질 수 있는 최대 거리 (3857 기준으로 환산)
  //
  // 남은 시간만큼 번지게 두면 안 된다. 이동 속도와 확산 속도가 같아지는 도보에서는
  // 출발점에서 사방으로 똑같이 퍼져 도로와 무관한 원이 되고, 강 위까지 덮어 버린다.
  // 도로 밖 이동은 "길에서 목적지까지 걸어 들어가는 거리" 정도로만 허용한다.
  const offRoadLimit = Math.min(
    options.maxOffRoad != null ? options.maxOffRoad : 300,
    maxSeconds * offRoadSpeed
  );
  const maxOffRoad = offRoadLimit * MERCATOR_STRETCH;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  timeOf.forEach((t, n) => {
    if (chunk.nodeX[n] < minX) minX = chunk.nodeX[n];
    if (chunk.nodeX[n] > maxX) maxX = chunk.nodeX[n];
    if (chunk.nodeY[n] < minY) minY = chunk.nodeY[n];
    if (chunk.nodeY[n] > maxY) maxY = chunk.nodeY[n];
  });
  reach.edgeTips.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  });
  if (origin) {
    // 출발점은 반드시 등시선 안에 있어야 한다 (도로가 멀어도)
    if (origin.x < minX) minX = origin.x;
    if (origin.x > maxX) maxX = origin.x;
    if (origin.y < minY) minY = origin.y;
    if (origin.y > maxY) maxY = origin.y;
  }
  minX -= maxOffRoad; minY -= maxOffRoad;
  maxX += maxOffRoad; maxY += maxOffRoad;

  const span = Math.max(maxX - minX, maxY - minY);
  const cellSize = Math.max(30, span / targetCells);
  const width = Math.ceil((maxX - minX) / cellSize) + 1;
  const height = Math.ceil((maxY - minY) / cellSize) + 1;

  // ── 격자에 도달시간 뿌리기 ────────────────────────────────
  // 노드만 찍으면 링크가 긴 구간에서 격자가 비어 등시선이 조각난다.
  // 등시선은 "이동해서 닿는 범위"라 끊긴 조각이 있으면 안 된다 → 링크 구간 전체를 그린다.
  const time = new Float32Array(width * height).fill(Infinity);
  const queue = [];

  const plotCell = (gx, gy, t) => {
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) return;
    const k = gy * width + gx;
    if (t < time[k]) {
      time[k] = t;
      queue.push(k);
    }
  };
  const plot = (x, y, t) => plotCell(
    Math.round((x - minX) / cellSize),
    Math.round((y - minY) / cellSize),
    t
  );

  /**
   * 두 점을 잇는 칸들을 빠짐없이 칠한다 (시간은 선형 보간).
   * 한 번에 가로 또는 세로로만 이동해 "대각선으로만 닿은" 칸이 생기지 않게 한다.
   * 대각선 연결은 등치선(마칭 스퀘어)에서 갈라져 등시선이 조각나는 원인이 된다.
   */
  const drawSegment = (x1, y1, t1, x2, y2, t2) => {
    let gx = Math.round((x1 - minX) / cellSize);
    let gy = Math.round((y1 - minY) / cellSize);
    const gx2 = Math.round((x2 - minX) / cellSize);
    const gy2 = Math.round((y2 - minY) / cellSize);

    const dx = Math.abs(gx2 - gx), dy = Math.abs(gy2 - gy);
    const sx = gx < gx2 ? 1 : -1, sy = gy < gy2 ? 1 : -1;
    const total = dx + dy;
    let err = dx - dy, done = 0;

    for (;;) {
      plotCell(gx, gy, total === 0 ? t1 : t1 + (t2 - t1) * (done / total));
      if (gx === gx2 && gy === gy2) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; gx += sx; }   // else if 로 한 번에 한 축만 움직인다
      else if (e2 < dx) { err += dx; gy += sy; }
      done++;
      if (done > total + 2) break; // 안전장치
    }
  };

  const passable = options.isPassable || (() => true);
  timeOf.forEach((tu, u) => {
    plot(chunk.nodeX[u], chunk.nodeY[u], tu);
    for (let e = chunk.offsets[u]; e < chunk.offsets[u + 1]; e++) {
      if (!passable(e)) continue;
      const v = chunk.targets[e];
      const tv = timeOf.get(v);
      if (tv === undefined) continue;
      drawSegment(chunk.nodeX[u], chunk.nodeY[u], tu, chunk.nodeX[v], chunk.nodeY[v], tv);
    }
  });

  // 시간이 모자라 중간까지만 간 구간도 이어 그린다
  reach.edgeTips.forEach(([x, y, t, from]) => {
    const tu = timeOf.get(from);
    if (tu === undefined) return;
    drawSegment(chunk.nodeX[from], chunk.nodeY[from], tu, x, y, t + offset);
  });

  // 출발점 → 가장 가까운 도로. 이 구간을 그려야 등시선이 찍은 지점을 중심으로 만들어진다
  if (origin) {
    plot(origin.x, origin.y, 0);
    const tStart = timeOf.get(origin.node);
    if (tStart !== undefined) {
      drawSegment(origin.x, origin.y, 0, chunk.nodeX[origin.node], chunk.nodeY[origin.node], tStart);
    }
  }

  // ── 도로 밖으로 번지기 (격자 다익스트라, 8방향) ────────────
  const maxOffRoadCells = Math.max(1, Math.round(maxOffRoad / cellSize));
  spreadOffRoad(time, width, height, cellSize, offRoadSpeed, maxSeconds, queue, maxOffRoadCells);

  // ── 등치선 추출 ───────────────────────────────────────────
  // d3-contour는 "값 ≥ 임계값"인 영역을 감싼다. 남은 시간(양수면 도달)으로 바꾼다.
  const field = new Float64Array(width * height);
  for (let i = 0; i < field.length; i++) {
    field[i] = isFinite(time[i]) ? maxSeconds - time[i] : -1;
  }

  const result = contours().size([width, height]).thresholds([0])(field);
  let polygons = [];
  (result[0] ? result[0].coordinates : []).forEach(poly => {
    const rings = poly.map(ring => ring.map(([gx, gy]) => [
      minX + gx * cellSize,
      minY + gy * cellSize
    ]));
    polygons.push(rings);
  });

  // 등시선은 "출발점에서 이동해 닿는 범위"라 본래 하나로 이어져 있어야 한다.
  // 링크 구간을 모두 그렸으므로 조각이 남는다면 격자 계단 현상 같은 부산물이다 → 본체만 남긴다.
  let dropped = 0;
  if (polygons.length > 1) {
    const areas = polygons.map(rings => ringArea(rings[0]));
    const best = areas.indexOf(Math.max(...areas));
    dropped = polygons.length - 1;
    polygons = [polygons[best]];
  }

  return { polygons, cellSize, width, height, dropped };
}

/**
 * 격자 위에서 도로 밖으로 번지게 한다.
 * 시간이 남아 있어도 도로에서 maxCells칸을 넘어가지는 못한다 — 그래야 등시선이
 * 도로망을 따라간다.
 * 정렬 없이 단순 큐를 반복 처리한다 — 격자 비용이 균일해 몇 번만 돌면 수렴한다.
 */
function spreadOffRoad(time, width, height, cellSize, speed, maxSeconds, seedCells, maxCells) {
  const straight = (cellSize / MERCATOR_STRETCH) / speed;   // 인접 칸 이동 시간(초)
  const diagonal = straight * Math.SQRT2;
  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];

  // 도로(씨앗)에서 몇 칸 벗어났는지
  const steps = new Uint16Array(time.length).fill(0xffff);
  seedCells.forEach(k => { steps[k] = 0; });

  let frontier = seedCells;
  while (frontier.length > 0) {
    const next = [];
    for (let i = 0; i < frontier.length; i++) {
      const k = frontier[i];
      const base = time[k];
      const step = steps[k];
      if (step >= maxCells) continue;
      const x = k % width, y = (k / width) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nk = ny * width + nx;
        const nt = base + (d < 4 ? straight : diagonal);
        if (nt <= maxSeconds && nt < time[nk] - 1e-3) {
          time[nk] = nt;
          steps[nk] = step + 1;
          next.push(nk);
        } else if (nt <= maxSeconds && step + 1 < steps[nk]) {
          // 시간은 이미 더 짧게 알고 있지만 도로에서 더 가까운 경로 — 칸수만 갱신
          steps[nk] = step + 1;
          next.push(nk);
        }
      }
    }
    frontier = next;
  }
}

/** 링의 면적 (부호 무시) */
function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
