#!/usr/bin/env node
/**
 * 주요도로 vs 전체 도로망 비교 — 도보·자전거 등시선이 얼마나 달라지는지
 * 사용법: node scripts/compare-networks.mjs
 */
import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import { RoadNetwork } from '../src/core/RoadNetwork.js';
import { RouterEngine, speedProfile } from '../src/core/RouterEngine.js';
import { buildIsochronePolygons } from '../src/core/isochroneField.js';

const to3857 = proj4('EPSG:4326', 'EPSG:3857');
const POINTS = {
  '서울시청': [126.9784, 37.5666],
  '성남 분당': [127.1080, 37.3800],
  '양평 서종': [127.3600, 37.5600]
};
const CASES = [['도보', 4, 15], ['도보', 4, 30], ['자전거', 15, 30], ['자동차', 40, 30]];

function load(name) {
  const base = path.join(process.cwd(), 'public', 'data', 'roadnet', name);
  const buf = fs.readFileSync(base + '.graph.bin');
  const net = new RoadNetwork();
  const chunk = net._parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  chunk.index = net._buildGridIndex(chunk);
  net.chunk = chunk;
  return { net, chunk, engine: new RouterEngine(chunk) };
}

const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

function isochroneArea(ctx, lonlat, kmh, minutes, excludeHighway) {
  const [ox, oy] = to3857.forward(lonlat);
  const hit = ctx.net.snap(ox, oy);
  if (!hit) return null;
  ctx.engine.setProfile(speedProfile(kmh, excludeHighway));
  const access = (hit.distance / 1.25) / (kmh / 3.6);
  const maxSeconds = minutes * 60;
  const reach = maxSeconds - access > 0
    ? ctx.engine.reachable(hit.node, maxSeconds - access)
    : { nodes: [], times: new Float32Array(0), edgeTips: [] };

  const { polygons } = buildIsochronePolygons(ctx.chunk, reach, {
    maxSeconds,
    offRoadSpeed: 4 / 3.6,
    maxOffRoad: Math.min(250, (kmh / 3.6) * maxSeconds * 0.08),
    isPassable: (e) => isFinite(ctx.engine.costOf(e)),
    origin: { x: ox, y: oy, node: hit.node, seconds: access }
  });

  let area = 0;
  polygons.forEach(rings => rings.forEach((ring, i) => {
    area += (i === 0 ? 1 : -1) * ringArea(ring);
  }));
  return {
    km2: area / 1.5625 / 1e6,
    snap: hit.distance / 1.25,
    nodes: reach.nodes.length
  };
}

const major = load('korea-major');
const full = load('korea-full');

console.log('도로망 규모');
console.log(`  주요도로: 노드 ${major.chunk.nodeCount.toLocaleString()} · 링크 ${major.chunk.edgeCount.toLocaleString()}`);
console.log(`  전체도로: 노드 ${full.chunk.nodeCount.toLocaleString()} · 링크 ${full.chunk.edgeCount.toLocaleString()}`);

for (const [name, lonlat] of Object.entries(POINTS)) {
  console.log(`\n=== ${name} ===`);
  console.log('  조건                주요도로            전체도로            차이');
  console.log('  ' + '─'.repeat(70));
  for (const [modeName, kmh, min] of CASES) {
    const exclude = modeName !== '자동차';
    const a = isochroneArea(major, lonlat, kmh, min, exclude);
    const b = isochroneArea(full, lonlat, kmh, min, exclude);
    if (!a || !b) { console.log(`  ${modeName} ${kmh}km/h ${min}분: 스냅 실패`); continue; }
    const label = `${modeName} ${kmh}km/h ${min}분`.padEnd(18);
    console.log(`  ${label}${(a.km2.toFixed(1) + ' km²').padStart(12)}${(b.km2.toFixed(1) + ' km²').padStart(20)}` +
      `   ${b.km2 > a.km2 ? '+' : ''}${((b.km2 / a.km2 - 1) * 100).toFixed(0)}%`);
  }
  const s1 = isochroneArea(major, lonlat, 4, 30, true);
  const s2 = isochroneArea(full, lonlat, 4, 30, true);
  console.log(`  도로까지 거리      ${s1.snap.toFixed(0).padStart(9)}m${s2.snap.toFixed(0).padStart(19)}m`);
}
