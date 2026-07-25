#!/usr/bin/env node
/**
 * build-roadgraph 산출물 검증
 * - 헤더/배열 크기 일관성
 * - 강한 연결 요소(SCC) 비율 — 등급을 걸러내면 망이 끊길 수 있어 반드시 확인한다
 * - 통행시간·좌표 상식 점검
 *
 * 사용법: node scripts/verify-roadgraph.mjs [public/data/roadnet/korea-major]
 */
import fs from 'fs';
import path from 'path';

const base = process.argv[2] || path.join('public', 'data', 'roadnet', 'korea-major');
const gbuf = fs.readFileSync(base + '.graph.bin');

const magic = gbuf.toString('ascii', 0, 4);
if (magic !== 'EGRN') throw new Error('graph.bin 매직이 다릅니다: ' + magic);
const version = gbuf.readUInt32LE(4);
const N = gbuf.readUInt32LE(8);
const E = gbuf.readUInt32LE(12);
const bbox = [gbuf.readInt32LE(16), gbuf.readInt32LE(20), gbuf.readInt32LE(24), gbuf.readInt32LE(28)];
const geomVerts = gbuf.readUInt32LE(32);

let p = 48;
const take = (Type, len) => {
  const a = new Type(gbuf.buffer, gbuf.byteOffset + p, len);
  p += a.byteLength;
  return a;
};
const nodeX = take(Int32Array, N);
const nodeY = take(Int32Array, N);
const mainScc = take(Uint8Array, N);
p += ((N + 3) & ~3) - N;
const offsets = take(Uint32Array, N + 1);
const targets = take(Uint32Array, E);
const cost = take(Float32Array, E);
const rank = take(Uint8Array, E);
p += ((E + 3) & ~3) - E;
const speed = take(Uint8Array, E);
p += ((E + 3) & ~3) - E;
const geomOffsets = take(Uint32Array, E + 1);

console.log('=== 헤더 ===');
console.log('version', version, '/ 노드', N.toLocaleString(), '/ 엣지', E.toLocaleString());
console.log('bbox(3857)', bbox.join(', '));
console.log('형상 정점', geomVerts.toLocaleString());
console.log('graph.bin 크기', (gbuf.length / 1024 / 1024).toFixed(1), 'MB / 읽은 바이트', (p / 1024 / 1024).toFixed(1), 'MB');
if (p !== gbuf.length) console.log('⚠ 남는 바이트:', gbuf.length - p);

// ── 상식 점검 ────────────────────────────────────────────────
console.log('\n=== 상식 점검 ===');
console.log('offsets 마지막 =', offsets[N].toLocaleString(), '(엣지 수와 같아야 함)');
let badTarget = 0;
for (let i = 0; i < E; i++) if (targets[i] >= N) badTarget++;
console.log('범위를 벗어난 target:', badTarget);

let badCost = 0, sumSpeed = 0, cnt = 0;
for (let i = 0; i < E; i++) {
  if (!(cost[i] > 0) || !isFinite(cost[i])) badCost++;
}
console.log('이상한 통행시간:', badCost);

// 한국 영역(3857) 대략: X 13,900,000~14,600,000 / Y 3,900,000~4,700,000
const inKorea = (x, y) => x > 13800000 && x < 14700000 && y > 3800000 && y < 4800000;
let outside = 0;
for (let i = 0; i < N; i++) if (!inKorea(nodeX[i], nodeY[i])) outside++;
console.log('한국 영역 밖 노드:', outside.toLocaleString(), `(${(outside / N * 100).toFixed(2)}%)`);

// 등급별 평균 속도 (형상 길이 대신 직선거리 사용 — 대략치)
const bySpeed = new Map();
for (let s = 0; s < N; s++) {
  for (let e2 = offsets[s]; e2 < offsets[s + 1]; e2++) {
    const t = targets[e2];
    const d = Math.hypot(nodeX[t] - nodeX[s], nodeY[t] - nodeY[s]) / 1.25; // 3857 왜곡 대략 보정
    const kmh = (d / cost[e2]) * 3.6;
    if (!isFinite(kmh)) continue;
    const r = rank[e2];
    const b = bySpeed.get(r) || { sum: 0, n: 0 };
    b.sum += kmh; b.n++;
    bySpeed.set(r, b);
  }
}
const RANK_LABEL = { 1: '고속국도', 2: '도시고속', 3: '일반국도', 4: '특별·광역시도', 5: '국가지원지방도', 6: '지방도', 7: '시군도' };
console.log('\n등급별 평균 직선속도(km/h, 참고치):');
[...bySpeed.entries()].sort().forEach(([r, b]) =>
  console.log(`  ${(RANK_LABEL[r] || r).padEnd(14)} ${(b.sum / b.n).toFixed(1)}  (엣지 ${b.n.toLocaleString()})`));

// ── SCC ──────────────────────────────────────────────────────
console.log('\n=== 강한 연결 요소 ===');
const revOff = new Uint32Array(N + 1);
for (let i = 0; i < E; i++) revOff[targets[i] + 1]++;
for (let i = 0; i < N; i++) revOff[i + 1] += revOff[i];
const revPos = revOff.slice(0, N);
const revAdj = new Uint32Array(E);
for (let s = 0; s < N; s++) {
  for (let e2 = offsets[s]; e2 < offsets[s + 1]; e2++) revAdj[revPos[targets[e2]]++] = s;
}

const order = new Int32Array(N);
let oLen = 0;
const visited = new Uint8Array(N);
const stN = new Int32Array(N + 1), stE = new Uint32Array(N + 1);
for (let s = 0; s < N; s++) {
  if (visited[s]) continue;
  let sp = 0; stN[0] = s; stE[0] = offsets[s]; visited[s] = 1;
  while (sp >= 0) {
    const v = stN[sp];
    if (stE[sp] < offsets[v + 1]) {
      const w = targets[stE[sp]++];
      if (!visited[w]) { visited[w] = 1; sp++; stN[sp] = w; stE[sp] = offsets[w]; }
    } else { order[oLen++] = v; sp--; }
  }
}
const comp = new Int32Array(N).fill(-1);
const sizes = [];
let nc = 0;
for (let i = oLen - 1; i >= 0; i--) {
  const s = order[i];
  if (comp[s] !== -1) continue;
  let size = 0, sp = 0;
  stN[0] = s; comp[s] = nc;
  while (sp >= 0) {
    const v = stN[sp--]; size++;
    for (let e2 = revOff[v]; e2 < revOff[v + 1]; e2++) {
      const w = revAdj[e2];
      if (comp[w] === -1) { comp[w] = nc; stN[++sp] = w; }
    }
  }
  sizes.push(size); nc++;
}
sizes.sort((a, b) => b - a);
console.log('SCC 개수:', nc.toLocaleString());
console.log('가장 큰 SCC:', sizes[0].toLocaleString(), `(${(sizes[0] / N * 100).toFixed(1)}%)`);
console.log('상위 8개:', sizes.slice(0, 8).join(', '));

// 파일에 구워진 mainScc 플래그가 실제 계산과 맞는지
let flagged = 0;
for (let i = 0; i < N; i++) flagged += mainScc[i];
console.log('파일의 mainScc 플래그 수:', flagged.toLocaleString(),
  flagged === sizes[0] ? '✓ 재계산 결과와 일치' : '✗ 불일치');

// ── geom.bin ─────────────────────────────────────────────────
const geomFile = base + '.geom.bin';
if (fs.existsSync(geomFile)) {
  const gb = fs.readFileSync(geomFile);
  console.log('\n=== geom.bin ===');
  console.log('매직', gb.toString('ascii', 0, 4), '/ 정점', gb.readUInt32LE(8).toLocaleString(),
    '/ 크기', (gb.length / 1024 / 1024).toFixed(1), 'MB');
  console.log('graph의 geomOffsets 마지막 =', geomOffsets[E].toLocaleString(),
    geomOffsets[E] === gb.readUInt32LE(8) ? '✓ 일치' : '✗ 불일치');

  // 형상 첫 정점이 출발 노드와 가까운지 표본 확인
  const xy = new Int32Array(gb.buffer, gb.byteOffset + 16, gb.readUInt32LE(8) * 2);
  let far = 0, checked = 0;
  for (let s = 0; s < N && checked < 3000; s++) {
    for (let e2 = offsets[s]; e2 < offsets[s + 1] && checked < 3000; e2++) {
      const g0 = geomOffsets[e2];
      if (geomOffsets[e2 + 1] - g0 < 2) continue;
      const d = Math.hypot(xy[g0 * 2] - nodeX[s], xy[g0 * 2 + 1] - nodeY[s]);
      if (d > 30) far++;
      checked++;
    }
  }
  console.log(`형상 시작점이 출발 노드에서 30m 넘게 떨어진 경우: ${far}/${checked}`);
}
