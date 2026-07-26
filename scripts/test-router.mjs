#!/usr/bin/env node
/**
 * 도로망 로더 + 경로탐색 엔진을 실제 데이터로 검증 (브라우저 없이)
 * 사용법: node scripts/test-router.mjs
 */
import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import { RoadNetwork } from '../src/core/RoadNetwork.js';
import { RouterEngine } from '../src/core/RouterEngine.js';

const to3857 = proj4('EPSG:4326', 'EPSG:3857');
const P = {
  '서울시청': [126.9784, 37.5666],
  '대전시청': [127.3845, 36.3504],
  '부산시청': [129.0756, 35.1796],
  '광주시청': [126.8526, 35.1601],
  '강릉시청': [128.8761, 37.7519]
};

const chunkName = process.argv[2] || 'korea-major';
console.log(`도로망: ${chunkName}`);
const base = path.join(process.cwd(), 'public', 'data', 'roadnet', chunkName);
const buf = fs.readFileSync(base + '.graph.bin');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const net = new RoadNetwork();
const chunk = net._parseGraph(ab);
chunk.name = 'korea-major';
const t0 = Date.now();
chunk.index = net._buildGridIndex(chunk);
net.chunk = chunk;
console.log(`격자 인덱스 생성: ${Date.now() - t0}ms`);
console.log(`노드 ${chunk.nodeCount.toLocaleString()} / 엣지 ${chunk.edgeCount.toLocaleString()}`);

// ── 스냅 ─────────────────────────────────────────────────────
console.log('\n=== 최근접 노드 스냅 ===');
const snapped = {};
for (const [name, lonlat] of Object.entries(P)) {
  const [x, y] = to3857.forward(lonlat);
  const t = Date.now();
  const s = net.snap(x, y);
  if (!s) { console.log(`  ${name}: 실패`); continue; }
  snapped[name] = s.node;
  console.log(`  ${name.padEnd(8)} 노드 ${String(s.node).padStart(7)} · ${(s.distance / 1.25).toFixed(0)}m 떨어짐 · mainScc=${chunk.mainScc[s.node]} (${Date.now() - t}ms)`);
}

// ── 최단경로 ─────────────────────────────────────────────────
const engine = new RouterEngine(chunk);
console.log('\n=== 최단경로 (제한속도 기준 통행시간) ===');
const routes = [
  ['서울시청', '부산시청'], ['서울시청', '대전시청'],
  ['서울시청', '강릉시청'], ['광주시청', '부산시청'],
  ['부산시청', '서울시청']
];
for (const [a, b] of routes) {
  if (snapped[a] === undefined || snapped[b] === undefined) continue;
  const t = Date.now();
  const r = engine.shortestPath(snapped[a], snapped[b]);
  const ms = Date.now() - t;
  if (!r) { console.log(`  ${a} → ${b}: 경로 없음 (${ms}ms)`); continue; }
  const h = Math.floor(r.seconds / 3600), m = Math.round((r.seconds % 3600) / 60);
  console.log(`  ${a} → ${b}: ${h}시간 ${m}분 · ${(r.meters / 1000).toFixed(0)}km · 평균 ${(r.meters / r.seconds * 3.6).toFixed(0)}km/h · 링크 ${r.edges.length}개 · ${ms}ms`);
}

// ── 도보 프로파일 ────────────────────────────────────────────
console.log('\n=== 도보 프로파일 (고속도로 제외, 4km/h) ===');
engine.setProfile('foot');
const walk = engine.shortestPath(snapped['서울시청'], snapped['대전시청']);
if (walk) {
  console.log(`  서울→대전 도보: ${(walk.seconds / 3600).toFixed(1)}시간 · ${(walk.meters / 1000).toFixed(0)}km · 평균 ${(walk.meters / walk.seconds * 3.6).toFixed(1)}km/h`);
}
const walkReach = engine.reachable(snapped['서울시청'], 30 * 60);
console.log(`  서울시청 도보 30분: 도달 노드 ${walkReach.nodes.length.toLocaleString()}`);
engine.setProfile('car');

// ── 등시선 확산 ──────────────────────────────────────────────
console.log('\n=== 등시선 확산 (서울시청) ===');
for (const min of [10, 30, 60]) {
  const t = Date.now();
  const r = engine.reachable(snapped['서울시청'], min * 60);
  const ms = Date.now() - t;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  r.nodes.forEach(n => {
    minX = Math.min(minX, chunk.nodeX[n]); maxX = Math.max(maxX, chunk.nodeX[n]);
    minY = Math.min(minY, chunk.nodeY[n]); maxY = Math.max(maxY, chunk.nodeY[n]);
  });
  const w = (maxX - minX) / 1.25 / 1000, hh = (maxY - minY) / 1.25 / 1000;
  console.log(`  ${String(min).padStart(2)}분: 도달 노드 ${r.nodes.length.toLocaleString().padStart(7)} · 경계점 ${r.edgeTips.length.toLocaleString().padStart(5)} · 범위 ${w.toFixed(0)}×${hh.toFixed(0)}km · ${ms}ms`);
}

// ── 등시선 폴리곤 ────────────────────────────────────────────
console.log('\n=== 등시선 폴리곤 (서울시청, 제한속도 기준) ===');
const { buildIsochronePolygons } = await import('../src/core/isochroneField.js');
const { speedProfile } = await import('../src/core/RouterEngine.js');
let prevArea = 0;
for (const min of [10, 20, 30]) {
  const reach = engine.reachable(snapped['서울시청'], min * 60);
  const t = Date.now();
  const { polygons, cellSize, width, height, dropped } = buildIsochronePolygons(chunk, reach, { maxSeconds: min * 60 });
  const ms = Date.now() - t;

  // 면적 (3857 왜곡 보정 후 km²)
  let area = 0;
  polygons.forEach(rings => {
    rings.forEach((ring, i) => {
      let a = 0;
      for (let k = 0; k < ring.length; k++) {
        const [x1, y1] = ring[k], [x2, y2] = ring[(k + 1) % ring.length];
        a += x1 * y2 - x2 * y1;
      }
      area += (i === 0 ? 1 : -1) * Math.abs(a) / 2;
    });
  });
  area = area / (1.25 * 1.25) / 1e6;
  console.log(`  ${String(min).padStart(2)}분: 폴리곤 ${polygons.length}개(버려진 조각 ${dropped}) · 면적 ${area.toFixed(0)} km² · 격자 ${width}×${height}(${cellSize.toFixed(0)}m) · ${ms}ms`
    + (area > prevArea ? '' : '  ⚠ 이전보다 작아짐'));
  prevArea = area;
}

// ── 사용자 지정 시속 + 출발점 포함 확인 ──────────────────────
console.log('\n=== 시속을 정했을 때 (30분 등시선) ===');
const rural = to3857.forward([127.29, 37.20]); // 용인 처인 — 도로가 1.5km 떨어진 곳
const ruralSnap = net.snap(rural[0], rural[1]);
for (const kmh of [15, 40, 80]) {
  engine.setProfile(speedProfile(kmh));
  const access = (ruralSnap.distance / 1.25) / (kmh / 3.6);
  const reach = engine.reachable(ruralSnap.node, 30 * 60 - access);
  const { polygons } = buildIsochronePolygons(chunk, reach, {
    maxSeconds: 30 * 60,
    offRoadSpeed: 4 / 3.6,
    origin: { x: rural[0], y: rural[1], node: ruralSnap.node, seconds: access }
  });
  let area = 0;
  polygons.forEach(rings => rings.forEach((ring, i) => {
    let a = 0;
    for (let k = 0; k < ring.length; k++) {
      const [x1, y1] = ring[k], [x2, y2] = ring[(k + 1) % ring.length];
      a += x1 * y2 - x2 * y1;
    }
    area += (i === 0 ? 1 : -1) * Math.abs(a) / 2;
  }));

  // 출발점이 폴리곤 안에 있는지 (짝수-홀수 판정)
  const inside = polygons.some(rings => {
    const ring = rings[0];
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > rural[1]) !== (yj > rural[1]) &&
          rural[0] < (xj - xi) * (rural[1] - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  });
  console.log(`  ${String(kmh).padStart(3)}km/h: 면적 ${(area / 1.5625 / 1e6).toFixed(0).padStart(5)} km² · 도로 접근 ${(access / 60).toFixed(1)}분 · 출발점 포함 ${inside ? '✓' : '✗'}`);
}
engine.setProfile('car');

// ── 도보 등시선이 도로를 따라가는지 (원이 되면 안 된다) ──────
console.log('\n=== 도로를 따라가는가 (원 대비 면적 비율) ===');
for (const [name, kmh, min] of [['도보', 4, 30], ['자전거', 15, 30], ['자동차', 40, 30]]) {
  engine.setProfile(speedProfile(kmh));
  const from = snapped['서울시청'];
  const reach = engine.reachable(from, min * 60);
  const { polygons } = buildIsochronePolygons(chunk, reach, {
    maxSeconds: min * 60,
    offRoadSpeed: 4 / 3.6,
    maxOffRoad: Math.min(250, (kmh / 3.6) * min * 60 * 0.08),
    origin: { x: chunk.nodeX[from], y: chunk.nodeY[from], node: from, seconds: 0 }
  });

  let area = 0, maxR = 0;
  polygons.forEach(rings => rings.forEach((ring, i) => {
    let a = 0;
    for (let k = 0; k < ring.length; k++) {
      const [x1, y1] = ring[k], [x2, y2] = ring[(k + 1) % ring.length];
      a += x1 * y2 - x2 * y1;
      if (i === 0) maxR = Math.max(maxR, Math.hypot(x1 - chunk.nodeX[from], y1 - chunk.nodeY[from]));
    }
    area += (i === 0 ? 1 : -1) * Math.abs(a) / 2;
  }));
  const km2 = area / 1.5625 / 1e6;
  const circle = Math.PI * (maxR / 1.25) ** 2 / 1e6;
  console.log(`  ${name.padEnd(4)} ${String(kmh).padStart(3)}km/h ${min}분: 면적 ${km2.toFixed(1).padStart(7)} km² · 같은 반경 원 ${circle.toFixed(0).padStart(5)} km² · 비율 ${(km2 / circle * 100).toFixed(0)}%`);
}
engine.setProfile('car');

// ── 경로 형상 확인 ───────────────────────────────────────────
const geomBuf = fs.readFileSync(base + '.geom.bin');
const gab = geomBuf.buffer.slice(geomBuf.byteOffset, geomBuf.byteOffset + geomBuf.byteLength);
net.geometry = new Int32Array(gab, 16, new DataView(gab).getUint32(8, true) * 2);

const r = engine.shortestPath(snapped['서울시청'], snapped['대전시청']);
let vertexTotal = 0, geomMeters = 0;
r.edges.forEach((e, i) => {
  const g = net.edgeGeometry(e, r.nodes[i]);
  vertexTotal += g.length;
  for (let k = 1; k < g.length; k++) {
    geomMeters += Math.hypot(g[k][0] - g[k - 1][0], g[k][1] - g[k - 1][1]) / 1.25;
  }
});
console.log('\n=== 경로 형상 (서울→대전) ===');
console.log(`  정점 ${vertexTotal.toLocaleString()}개 · 실제 도로 연장 ${(geomMeters / 1000).toFixed(1)}km`);
console.log(`  평균 속도 ${(geomMeters / r.seconds * 3.6).toFixed(1)} km/h`);
