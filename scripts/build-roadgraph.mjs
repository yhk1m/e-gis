#!/usr/bin/env node
/**
 * 표준노드링크(shp) → e-GIS 도로 그래프 이진 파일 변환
 *
 * 왜 이진인가
 * -----------
 * GeoJSON으로 두면 전국 링크 155만 개가 수백 MB이고, 브라우저가 파싱하다 죽는다.
 * 타입드 배열로 구워 두면 fetch → ArrayBuffer 뷰만 만들면 끝이라 파싱이 아예 없다.
 *
 * 좌표를 미리 EPSG:3857로 변환해 저장하는 이유
 * --------------------------------------------
 * 런타임에 노드 백만 개를 proj4로 돌리면 수 초가 날아간다. 3857은 위도 37도에서
 * 거리가 약 1.25배 부풀지만, 통행시간은 원본 LENGTH(5186 미터)로 여기서 미리
 * 계산해 넣으므로 영향이 없다. 3857 좌표는 화면 표시·스냅 용도로만 쓴다.
 *
 * 사용법
 *   node scripts/build-roadgraph.mjs <노드링크폴더> [--name korea-major] [--ranks 101,102,103,104,105,106]
 */

import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';

// ── 인자 ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const srcDir = args[0];
if (!srcDir) {
  console.error('사용법: node scripts/build-roadgraph.mjs <노드링크폴더> [--name X] [--ranks 101,...]');
  process.exit(1);
}
const opt = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const NAME = opt('--name', 'korea-major');
const RANKS = new Set(opt('--ranks', '101,102,103,104,105,106').split(','));
const SIMPLIFY_TOL = parseFloat(opt('--simplify', '4')); // m (3857 기준)
const OUT_DIR = opt('--out', path.join(process.cwd(), 'public', 'data', 'roadnet'));

// 표준노드링크: ITRF2000 중부원점(60만)
proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs');
const toWebMercator = proj4('EPSG:5186', 'EPSG:3857');

/** 도로등급별 기본 속도(km/h) — MAX_SPD가 비어 있을 때만 사용 */
const DEFAULT_SPEED = { '101': 100, '102': 80, '103': 70, '104': 60, '105': 60, '106': 60, '107': 40 };
const RANK_LABEL = {
  '101': '고속국도', '102': '도시고속국도', '103': '일반국도', '104': '특별·광역시도',
  '105': '국가지원지방도', '106': '지방도', '107': '시군도'
};

const decoder = new TextDecoder('euc-kr');
const dec = (buf) => decoder.decode(buf).replace(/\0/g, '').trim();

// ── dbf ──────────────────────────────────────────────────────
function openDbf(file) {
  const buf = fs.readFileSync(file);
  const count = buf.readInt32LE(4);
  const headerLen = buf.readInt16LE(8);
  const recLen = buf.readInt16LE(10);
  const fields = [];
  let off = 1;
  for (let i = 32; i + 32 <= headerLen; i += 32) {
    if (buf[i] === 0x0d) break;
    fields.push({ name: dec(buf.subarray(i, i + 11)), len: buf[i + 16], off });
    off += buf[i + 16];
  }
  const map = new Map(fields.map(f => [f.name, f]));
  const get = (r, name) => {
    const f = map.get(name);
    if (!f) return '';
    const s = headerLen + r * recLen + f.off;
    return dec(buf.subarray(s, s + f.len));
  };
  return { count, fields, get };
}

// ── shp ──────────────────────────────────────────────────────
/** 포인트 shp → [x, y] 배열 (레코드 순서) */
function readPointShp(file) {
  const buf = fs.readFileSync(file);
  const xs = [], ys = [];
  let off = 100;
  while (off + 8 <= buf.length) {
    const clw = buf.readInt32BE(off + 4);
    const rec = off + 8;
    if (buf.readInt32LE(rec) === 1) {
      xs.push(buf.readDoubleLE(rec + 4));
      ys.push(buf.readDoubleLE(rec + 12));
    } else {
      xs.push(NaN); ys.push(NaN);
    }
    off = rec + clw * 2;
  }
  return { xs, ys };
}

/** 폴리라인 shp를 순회하며 (index, 좌표배열) 콜백 */
function eachPolyline(file, cb) {
  const buf = fs.readFileSync(file);
  let off = 100, i = 0;
  while (off + 8 <= buf.length) {
    const clw = buf.readInt32BE(off + 4);
    const rec = off + 8;
    if (buf.readInt32LE(rec) === 3) {
      const numParts = buf.readInt32LE(rec + 36);
      const numPoints = buf.readInt32LE(rec + 40);
      const pOff = rec + 44 + numParts * 4;
      cb(i, buf, pOff, numPoints);
    } else {
      cb(i, null, 0, 0);
    }
    i++;
    off = rec + clw * 2;
  }
}

// ── Douglas-Peucker (제자리 인덱스 방식) ─────────────────────
function simplify(xs, ys, tol) {
  const n = xs.length;
  if (n <= 2 || tol <= 0) return xs.map((x, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const ax = xs[a], ay = ys[a], bx = xs[b], by = ys[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let best = -1, bestD = 0;
    for (let i = a + 1; i < b; i++) {
      const px = xs[i] - ax, py = ys[i] - ay;
      let d2;
      if (len2 === 0) {
        d2 = px * px + py * py;
      } else {
        let t = (px * dx + py * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - t * dx, ey = py - t * dy;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > bestD) { bestD = d2; best = i; }
    }
    if (bestD > tol2) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

// ── 1) 노드 읽기 ─────────────────────────────────────────────
console.log('[1/6] 노드 읽는 중…');
const nodeDbf = openDbf(path.join(srcDir, 'MOCT_NODE.dbf'));
const nodePts = readPointShp(path.join(srcDir, 'MOCT_NODE.shp'));
if (nodeDbf.count !== nodePts.xs.length) {
  console.warn(`  ⚠ 노드 dbf(${nodeDbf.count})와 shp(${nodePts.xs.length}) 레코드 수가 다릅니다`);
}
const nodePos = new Map(); // NODE_ID -> [x5186, y5186]
for (let r = 0; r < nodeDbf.count; r++) {
  nodePos.set(nodeDbf.get(r, 'NODE_ID'), [nodePts.xs[r], nodePts.ys[r]]);
}
console.log(`      노드 ${nodePos.size.toLocaleString()}개`);

// ── 2) 링크 속성 읽기 + 등급 필터 ────────────────────────────
console.log('[2/6] 링크 속성 읽는 중…');
const linkDbf = openDbf(path.join(srcDir, 'MOCT_LINK.dbf'));
const keep = new Uint8Array(linkDbf.count);
const lf = new Array(linkDbf.count);
const lt = new Array(linkDbf.count);
const lcost = new Float64Array(linkDbf.count);
const lrank = new Uint8Array(linkDbf.count);
const lspeed = new Uint8Array(linkDbf.count); // km/h — 도보·거리 환산에 쓴다
let kept = 0, noSpeed = 0, badNode = 0;
const rankCount = new Map();

for (let r = 0; r < linkDbf.count; r++) {
  const rank = linkDbf.get(r, 'ROAD_RANK');
  if (!RANKS.has(rank)) continue;

  const f = linkDbf.get(r, 'F_NODE');
  const t = linkDbf.get(r, 'T_NODE');
  if (!nodePos.has(f) || !nodePos.has(t)) { badNode++; continue; }

  let spd = parseFloat(linkDbf.get(r, 'MAX_SPD'));
  if (!isFinite(spd) || spd <= 0) { spd = DEFAULT_SPEED[rank] || 40; noSpeed++; }

  const len = parseFloat(linkDbf.get(r, 'LENGTH'));
  if (!isFinite(len) || len <= 0) continue;

  keep[r] = 1;
  lf[r] = f; lt[r] = t;
  lcost[r] = len / (spd * 1000 / 3600); // 초
  lrank[r] = parseInt(rank, 10) - 100;  // 1~7로 축약
  lspeed[r] = Math.min(255, Math.round(spd));
  kept++;
  rankCount.set(rank, (rankCount.get(rank) || 0) + 1);
}
console.log(`      전체 ${linkDbf.count.toLocaleString()} → 채택 ${kept.toLocaleString()}`);
[...rankCount.entries()].sort().forEach(([r, c]) =>
  console.log(`        ${r} ${(RANK_LABEL[r] || '?').padEnd(12)} ${c.toLocaleString()}`));
if (noSpeed) console.log(`      제한속도 없어 등급 기본값 사용: ${noSpeed.toLocaleString()}`);
if (badNode) console.log(`      ⚠ 노드를 찾을 수 없어 제외: ${badNode.toLocaleString()}`);

// ── 3) 노드 인덱스 부여 + 좌표 변환 ──────────────────────────
console.log('[3/6] 노드 인덱스 부여 · 좌표 변환(5186→3857)…');
const nodeIdx = new Map();
const nx = [], ny = [];
const nodeIndexOf = (id) => {
  let i = nodeIdx.get(id);
  if (i === undefined) {
    const [x, y] = nodePos.get(id);
    const [mx, my] = toWebMercator.forward([x, y]);
    i = nx.length;
    nx.push(Math.round(mx));
    ny.push(Math.round(my));
    nodeIdx.set(id, i);
  }
  return i;
};
const esrc = new Int32Array(kept), edst = new Int32Array(kept);
const ecost = new Float32Array(kept), erank = new Uint8Array(kept), espeed = new Uint8Array(kept);
const elink = new Int32Array(kept); // 원본 shp 레코드 번호 (형상 추출용)
let e = 0;
for (let r = 0; r < linkDbf.count; r++) {
  if (!keep[r]) continue;
  esrc[e] = nodeIndexOf(lf[r]);
  edst[e] = nodeIndexOf(lt[r]);
  ecost[e] = lcost[r];
  erank[e] = lrank[r];
  espeed[e] = lspeed[r];
  elink[e] = r;
  e++;
}
const N = nx.length, E = kept;
console.log(`      노드 ${N.toLocaleString()} · 엣지 ${E.toLocaleString()}`);

// ── 4) CSR 정렬 ──────────────────────────────────────────────
console.log('[4/6] 인접 구조(CSR) 만드는 중…');
const offsets = new Uint32Array(N + 1);
for (let i = 0; i < E; i++) offsets[esrc[i] + 1]++;
for (let i = 0; i < N; i++) offsets[i + 1] += offsets[i];
const pos = offsets.slice(0, N);
const targets = new Uint32Array(E);
const cost = new Float32Array(E);
const rankArr = new Uint8Array(E);
const speedArr = new Uint8Array(E);
const orderLink = new Int32Array(E); // CSR 순서 → 원본 레코드
for (let i = 0; i < E; i++) {
  const p = pos[esrc[i]]++;
  targets[p] = edst[i];
  cost[p] = ecost[i];
  rankArr[p] = erank[i];
  speedArr[p] = espeed[i];
  orderLink[p] = elink[i];
}

// ── 4-b) 강한 연결 요소 — 가장 큰 덩어리에 속하는 노드 표시 ──
// 출발/도착점을 말단(진입만 되고 못 나가는 노드)에 붙이면 경로가 실패한다.
// 런타임에 매번 계산하면 수백 ms가 날아가므로 여기서 구워 둔다.
console.log('[4b/6] 강한 연결 요소 계산…');
const mainScc = new Uint8Array(N);
{
  const revOff = new Uint32Array(N + 1);
  for (let i = 0; i < E; i++) revOff[targets[i] + 1]++;
  for (let i = 0; i < N; i++) revOff[i + 1] += revOff[i];
  const revPos = revOff.slice(0, N);
  const revAdj = new Uint32Array(E);
  for (let s = 0; s < N; s++) {
    for (let k = offsets[s]; k < offsets[s + 1]; k++) revAdj[revPos[targets[k]]++] = s;
  }

  const order = new Int32Array(N);
  let oLen = 0;
  const seen = new Uint8Array(N);
  const stN = new Int32Array(N + 1), stE = new Uint32Array(N + 1);
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue;
    let sp = 0; stN[0] = s; stE[0] = offsets[s]; seen[s] = 1;
    while (sp >= 0) {
      const v = stN[sp];
      if (stE[sp] < offsets[v + 1]) {
        const w = targets[stE[sp]++];
        if (!seen[w]) { seen[w] = 1; sp++; stN[sp] = w; stE[sp] = offsets[w]; }
      } else { order[oLen++] = v; sp--; }
    }
  }

  const comp = new Int32Array(N).fill(-1);
  let nc = 0, bestComp = -1, bestSize = 0;
  const members = [];
  for (let i = oLen - 1; i >= 0; i--) {
    const s = order[i];
    if (comp[s] !== -1) continue;
    let size = 0, sp = 0;
    stN[0] = s; comp[s] = nc;
    while (sp >= 0) {
      const v = stN[sp--]; size++;
      for (let k = revOff[v]; k < revOff[v + 1]; k++) {
        const w = revAdj[k];
        if (comp[w] === -1) { comp[w] = nc; stN[++sp] = w; }
      }
    }
    members.push(size);
    if (size > bestSize) { bestSize = size; bestComp = nc; }
    nc++;
  }
  for (let i = 0; i < N; i++) if (comp[i] === bestComp) mainScc[i] = 1;
  console.log(`      SCC ${nc.toLocaleString()}개 · 가장 큰 덩어리 ${bestSize.toLocaleString()} (${(bestSize / N * 100).toFixed(1)}%)`);
}

// ── 5) 형상 추출 + 단순화 ────────────────────────────────────
console.log('[5/6] 도로 형상 추출·단순화…');
const recToEdge = new Int32Array(linkDbf.count).fill(-1);
for (let i = 0; i < E; i++) recToEdge[orderLink[i]] = i;

const geomOffsets = new Uint32Array(E + 1);
const geomChunks = new Array(E);
let totalVerts = 0, rawVerts = 0;

eachPolyline(path.join(srcDir, 'MOCT_LINK.shp'), (rec, buf, pOff, numPoints) => {
  const edge = recToEdge[rec];
  if (edge < 0 || !buf || numPoints < 2) return;
  const xs = new Float64Array(numPoints), ys = new Float64Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const [mx, my] = toWebMercator.forward([
      buf.readDoubleLE(pOff + i * 16),
      buf.readDoubleLE(pOff + i * 16 + 8)
    ]);
    xs[i] = mx; ys[i] = my;
  }
  rawVerts += numPoints;
  const idxs = simplify(xs, ys, SIMPLIFY_TOL);
  const arr = new Int32Array(idxs.length * 2);
  idxs.forEach((k, j) => { arr[j * 2] = Math.round(xs[k]); arr[j * 2 + 1] = Math.round(ys[k]); });
  geomChunks[edge] = arr;
  totalVerts += idxs.length;
});

let acc = 0;
for (let i = 0; i < E; i++) {
  geomOffsets[i] = acc;
  acc += geomChunks[i] ? geomChunks[i].length / 2 : 0;
}
geomOffsets[E] = acc;
console.log(`      정점 ${rawVerts.toLocaleString()} → ${totalVerts.toLocaleString()} (${(100 - totalVerts / rawVerts * 100).toFixed(0)}% 감소, 허용오차 ${SIMPLIFY_TOL}m)`);

// 형상 방향 검증 — 첫 정점이 F_NODE 쪽이어야 한다
let flipped = 0;
for (let i = 0; i < Math.min(E, 5000); i++) {
  const g = geomChunks[i];
  if (!g || g.length < 4) continue;
  const s = esrcOf(i), d = edstOf(i);
  const dStart = (g[0] - nx[s]) ** 2 + (g[1] - ny[s]) ** 2;
  const dEnd = (g[g.length - 2] - nx[s]) ** 2 + (g[g.length - 1] - ny[s]) ** 2;
  if (dEnd < dStart) flipped++;
}
function esrcOf(edgeIdx) {
  // CSR에서 source는 offsets 구간으로 역추적
  let lo = 0, hi = N - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= edgeIdx) lo = mid; else hi = mid - 1;
  }
  return lo;
}
function edstOf(edgeIdx) { return targets[edgeIdx]; }
console.log(`      형상 방향 점검(표본 5000): 뒤집힌 것 ${flipped}건`);

// ── 6) 파일 쓰기 ─────────────────────────────────────────────
console.log('[6/6] 파일 쓰는 중…');
fs.mkdirSync(OUT_DIR, { recursive: true });

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (let i = 0; i < N; i++) {
  if (nx[i] < minX) minX = nx[i];
  if (nx[i] > maxX) maxX = nx[i];
  if (ny[i] < minY) minY = ny[i];
  if (ny[i] > maxY) maxY = ny[i];
}

// graph.bin: 헤더(48) + nodeX + nodeY + mainScc(패딩) + offsets + targets + cost
//            + rank(패딩) + speed(패딩) + geomOffsets
const sccPadded = (N + 3) & ~3;
const rankPadded = (E + 3) & ~3;
const graphSize = 48 + N * 4 * 2 + sccPadded + (N + 1) * 4 + E * 4 + E * 4
  + rankPadded * 2 + (E + 1) * 4;
const gbuf = Buffer.alloc(graphSize);
gbuf.write('EGRN', 0, 'ascii');
gbuf.writeUInt32LE(3, 4);
gbuf.writeUInt32LE(N, 8);
gbuf.writeUInt32LE(E, 12);
gbuf.writeInt32LE(minX, 16); gbuf.writeInt32LE(minY, 20);
gbuf.writeInt32LE(maxX, 24); gbuf.writeInt32LE(maxY, 28);
gbuf.writeUInt32LE(acc, 32); // 형상 정점 수

let p = 48;
const put = (typed) => {
  Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).copy(gbuf, p);
  p += typed.byteLength;
};
put(Int32Array.from(nx));
put(Int32Array.from(ny));
put(mainScc); p += sccPadded - N;
put(offsets);
put(targets);
put(cost);
put(rankArr); p += rankPadded - E;
put(speedArr); p += rankPadded - E;
put(geomOffsets);

const graphPath = path.join(OUT_DIR, `${NAME}.graph.bin`);
fs.writeFileSync(graphPath, gbuf);

// geom.bin: 헤더(16) + Int32 x,y 쌍
const geomBuf = Buffer.alloc(16 + acc * 8);
geomBuf.write('EGRG', 0, 'ascii');
geomBuf.writeUInt32LE(1, 4);
geomBuf.writeUInt32LE(acc, 8);
let q = 16;
for (let i = 0; i < E; i++) {
  const g = geomChunks[i];
  if (!g) continue;
  Buffer.from(g.buffer, g.byteOffset, g.byteLength).copy(geomBuf, q);
  q += g.byteLength;
}
const geomPath = path.join(OUT_DIR, `${NAME}.geom.bin`);
fs.writeFileSync(geomPath, geomBuf);

// catalog.json 갱신
const catalogPath = path.join(OUT_DIR, 'catalog.json');
let catalog = { version: 1, chunks: [] };
if (fs.existsSync(catalogPath)) {
  try { catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8')); } catch (err) { /* 새로 만든다 */ }
}
catalog.chunks = (catalog.chunks || []).filter(c => c.name !== NAME);
const mainSccCount = mainScc.reduce((a, b) => a + b, 0);
catalog.chunks.push({
  name: NAME,
  mainSccNodes: mainSccCount,
  label: NAME === 'korea-major' ? '전국 주요도로 (고속·국도·지방도·시도)' : NAME,
  graph: `${NAME}.graph.bin`,
  geom: `${NAME}.geom.bin`,
  nodes: N,
  edges: E,
  ranks: [...RANKS].sort(),
  bbox: [minX, minY, maxX, maxY],
  graphBytes: graphSize,
  geomBytes: geomBuf.length
});
catalog.chunks.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log('\n=== 완료 ===');
console.log(`  ${graphPath}  ${mb(graphSize)}`);
console.log(`  ${geomPath}  ${mb(geomBuf.length)}`);
console.log(`  노드 ${N.toLocaleString()} · 엣지 ${E.toLocaleString()} · 형상 정점 ${acc.toLocaleString()}`);
