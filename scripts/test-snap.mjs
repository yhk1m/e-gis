#!/usr/bin/env node
/** 클릭 지점이 도로망 노드에 얼마나 멀리 붙는지 확인 (주요도로만 있을 때의 한계 측정) */
import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';
import { RoadNetwork } from '../src/core/RoadNetwork.js';

const to3857 = proj4('EPSG:4326', 'EPSG:3857');
const chunkName = process.argv[2] || 'korea-major';
const base = path.join(process.cwd(), 'public', 'data', 'roadnet', chunkName);
console.log(`도로망: ${chunkName}\n`);
const buf = fs.readFileSync(base + '.graph.bin');
const net = new RoadNetwork();
const chunk = net._parseGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
chunk.index = net._buildGridIndex(chunk);
net.chunk = chunk;

const POINTS = {
  '서울시청(도심)': [126.9784, 37.5666],
  '서울 상계동(주거)': [127.0620, 37.6600],
  '성남 분당(주거)': [127.1080, 37.3800],
  '용인 처인(외곽)': [127.2900, 37.2000],
  '양평 서종(농촌)': [127.3600, 37.5600],
  '강원 인제(산간)': [128.1700, 38.0700],
  '충남 태안(해안)': [126.2980, 36.7450]
};

/** mainScc 무시하고 가장 가까운 노드 */
function nearestAny(x, y) {
  const { nodeX, nodeY } = chunk;
  const { minX, minY, cols, rows, cellSize, starts, items } = chunk.index;
  const cx = Math.floor((x - minX) / cellSize), cy = Math.floor((y - minY) / cellSize);
  let best = -1, bestD2 = Infinity;
  for (let ring = 0; ring <= 10; ring++) {
    if (best >= 0 && bestD2 <= ((ring - 1) * cellSize) ** 2) break;
    for (let gy = cy - ring; gy <= cy + ring; gy++) {
      if (gy < 0 || gy >= rows) continue;
      for (let gx = cx - ring; gx <= cx + ring; gx++) {
        if (gx < 0 || gx >= cols) continue;
        const cell = gy * cols + gx;
        for (let k = starts[cell]; k < starts[cell + 1]; k++) {
          const n = items[k];
          const d2 = (nodeX[n] - x) ** 2 + (nodeY[n] - y) ** 2;
          if (d2 < bestD2) { bestD2 = d2; best = n; }
        }
      }
    }
  }
  return { node: best, distance: Math.sqrt(bestD2) };
}

console.log('지점                    스냅거리(실측m)   가장가까운노드   mainScc여부   차이');
console.log('─'.repeat(88));
for (const [name, lonlat] of Object.entries(POINTS)) {
  const [x, y] = to3857.forward(lonlat);
  const snapped = net.snap(x, y);
  const any = nearestAny(x, y);
  if (!snapped) { console.log(`${name.padEnd(20)} 스냅 실패`); continue; }
  const d = snapped.distance / 1.25;
  const dAny = any.distance / 1.25;
  console.log(
    `${name.padEnd(20)} ${d.toFixed(0).padStart(10)}m ${dAny.toFixed(0).padStart(14)}m` +
    `${String(chunk.mainScc[any.node] === 1).padStart(13)}   ${(d - dAny).toFixed(0).padStart(6)}m`
  );
}
