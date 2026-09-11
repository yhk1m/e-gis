// © 2026 김용현
/**
 * flowModel — 흐름 데이터의 순수 계산.
 * 표(헤더+행) → 흐름 쌍 → 위치 매칭 → FlowDataset → 집계·스케일. DOM·OL을 모른다.
 *
 * FlowDataset = {
 *   locations: [{ id, name, lon, lat }],
 *   flows:     [{ origin, dest, count }],   // origin/dest 는 locations 의 id
 *   meta:      { title, unit, source, matched, unmatched: [{ name, count }], skipped }
 * }
 */

const ORIGIN_PAT = /^(origin|from|source|o|출발|출발지|전출|전출지)$/i;
const DEST_PAT = /^(dest|destination|to|target|d|도착|도착지|전입|전입지)$/i;
const COUNT_PAT = /^(count|value|flow|weight|n|양|이동자수|이동자|인원|값|건수|수)$/i;
const TOTAL_PAT = /^(전국|계|합계|총계|소계|total|sum|all)$/i;

/** 헤더 이름으로 출발/도착/양 열을 추측한다. 못 찾으면 앞에서부터 순서대로. */
export function guessColumns(headers) {
  const find = (pat, taken) => headers.find((h) => !taken.includes(h) && pat.test(String(h).trim())) || null;
  const origin = find(ORIGIN_PAT, []) || headers[0] || null;
  const dest = find(DEST_PAT, [origin]) || headers.find((h) => h !== origin) || null;
  const count = find(COUNT_PAT, [origin, dest]) || headers.find((h) => h !== origin && h !== dest) || null;
  return { origin, dest, count };
}

function isNumeric(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (v == null || v === '') return false;
  return !Number.isNaN(Number(String(v).replace(/,/g, '')));
}

/** 'long' | 'matrix' — 첫 열 뒤 셀의 80% 이상이 숫자면 행렬형(첫 행 기준) */
export function detectTableShape({ headers, data }) {
  if (headers.length < 4 || data.length === 0) return 'long';
  const cells = headers.slice(1).map((h) => data[0][h]);
  const numeric = cells.filter(isNumeric).length;
  return numeric >= cells.length * 0.8 ? 'matrix' : 'long';
}

/** 셀 → 양. 숫자가 아니면 NaN, 빈 칸은 0 */
function readCount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isNaN(n) ? NaN : n;
}

/** 긴 형식: 한 행이 흐름 하나. 양이 숫자가 아니거나 0 이하, 합계 행은 건너뛰고 센다 */
export function parseLongTable({ data }, { origin, dest, count }) {
  const pairs = [];
  let skipped = 0;
  for (const row of data) {
    const o = String(row[origin] ?? '').trim();
    const d = String(row[dest] ?? '').trim();
    const n = readCount(row[count]);
    if (!o || !d || TOTAL_PAT.test(o) || TOTAL_PAT.test(d) || !(n > 0)) { skipped++; continue; }
    pairs.push({ origin: o, dest: d, count: n });
  }
  return { pairs, skipped };
}

/**
 * 행렬형: 첫 열 = 전출지, 나머지 헤더 = 전입지, 셀 = 양 (KOSIS 국내인구이동 표).
 * 빈 칸·0은 "흐름 없음"이라 조용히 버리고, 숫자가 아닌 셀만 건너뛰고 센다. 합계 행·열은 뺀다.
 */
export function parseMatrixTable({ headers, data }) {
  const [labelCol, ...destCols] = headers;
  const dests = destCols.filter((d) => !TOTAL_PAT.test(String(d).trim()));
  const pairs = [];
  let skipped = 0;
  for (const row of data) {
    const o = String(row[labelCol] ?? '').trim();
    if (!o || TOTAL_PAT.test(o)) continue;
    for (const d of dests) {
      const n = readCount(row[d]);
      if (Number.isNaN(n)) { skipped++; continue; }
      if (n > 0) pairs.push({ origin: o, dest: String(d).trim(), count: n });
    }
  }
  return { pairs, skipped };
}

// ----------------------------------------------------------------------------
//  이름 정규화·매칭
// ----------------------------------------------------------------------------

// 긴 접미사가 먼저 와야 "특별자치도"가 "도"로만 잘리지 않는다
const SUFFIX_RE = /(특별자치시|특별자치도|통합특별시|특별시|광역시|자치시|자치도|도|시)$/;
// 접미사를 벗긴 뒤의 별칭 (KOSIS·KOSTAT 표기 차이)
const ALIASES = {
  전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남', 충청북: '충북', 충청남: '충남',
  전남광주: '전남광주통합', 광주전남통합: '전남광주통합', 광주전남: '전남광주통합'
};

/** '서울특별시' → '서울', '전라북도' → '전북'. 양쪽(흐름 표·기준 레이어)에 같이 적용해 비교한다 */
export function normalizeName(name) {
  let s = String(name ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '');
  const stripped = s.replace(SUFFIX_RE, '');
  if (stripped.length >= 2) s = stripped; // '시' 한 글자처럼 남는 게 없으면 벗기지 않는다
  return ALIASES[s] || s;
}

function buildIndex(candidates) {
  const byCode = new Map();
  const byName = new Map();
  for (const c of candidates) {
    if (c.code != null && String(c.code).trim() !== '') byCode.set(String(c.code).trim(), c.id);
    const key = normalizeName(c.name);
    if (key && !byName.has(key)) byName.set(key, c.id);
  }
  return { byCode, byName };
}

function resolveId(rawName, index, manualMap) {
  if (manualMap[rawName]) return manualMap[rawName];
  const trimmed = String(rawName).trim();
  if (index.byCode.has(trimmed)) return index.byCode.get(trimmed);
  return index.byName.get(normalizeName(trimmed)) || null;
}

/**
 * 흐름 쌍 + 위치 후보 → FlowDataset.
 * @param {Object} p
 * @param {Array<{origin,dest,count}>} p.pairs   이름 기준 흐름
 * @param {Array<{id,name,code?,lon,lat}>} p.candidates  위치 후보 (기준 레이어 대표점 또는 위치 표)
 * @param {Object<string,string>} [p.manualMap]  손으로 짝지은 { 원본이름: 위치id }
 * @param {Object} [p.meta]
 */
export function buildDataset({ pairs, candidates, manualMap = {}, meta = {} }) {
  const index = buildIndex(candidates);
  const flowMap = new Map();     // 'origin|dest' → count (같은 쌍은 합친다)
  const unmatched = new Map();   // 원본 이름 → 양
  const used = new Set();
  for (const p of pairs) {
    const o = resolveId(p.origin, index, manualMap);
    const d = resolveId(p.dest, index, manualMap);
    if (!o) unmatched.set(p.origin, (unmatched.get(p.origin) || 0) + p.count);
    if (!d) unmatched.set(p.dest, (unmatched.get(p.dest) || 0) + p.count);
    if (!o || !d) continue;
    used.add(o); used.add(d);
    const k = o + '|' + d;
    flowMap.set(k, (flowMap.get(k) || 0) + p.count);
  }
  const flows = [...flowMap].map(([k, count]) => {
    const [origin, dest] = k.split('|');
    return { origin, dest, count };
  });
  const locations = candidates
    .filter((c) => used.has(c.id))
    .map(({ id, name, lon, lat }) => ({ id, name, lon, lat }));
  return {
    locations,
    flows,
    meta: {
      ...meta,
      matched: flows.length,
      unmatched: [...unmatched].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    }
  };
}

// ----------------------------------------------------------------------------
//  집계·선별
// ----------------------------------------------------------------------------

/** 위치별 { inflow, outflow, net }. 자기 흐름(서울→서울)은 includeSelf 일 때만 센다 */
export function aggregateTotals(dataset, { includeSelf = false } = {}) {
  const totals = new Map();
  const get = (id) => {
    if (!totals.has(id)) totals.set(id, { inflow: 0, outflow: 0, net: 0 });
    return totals.get(id);
  };
  for (const loc of dataset.locations) get(loc.id);
  for (const f of dataset.flows) {
    if (f.origin === f.dest && !includeSelf) continue;
    get(f.origin).outflow += f.count;
    get(f.dest).inflow += f.count;
  }
  for (const t of totals.values()) t.net = t.inflow - t.outflow;
  return totals;
}

/** 그릴 흐름: 자기 흐름 제외, 작은 것부터(큰 것이 위에 그려지도록), 상위 N개 옵션 */
export function visibleFlows(dataset, { topN = 0 } = {}) {
  let flows = dataset.flows.filter((f) => f.origin !== f.dest).sort((a, b) => a.count - b.count);
  if (topN > 0 && flows.length > topN) flows = flows.slice(flows.length - topN);
  return flows;
}

// ----------------------------------------------------------------------------
//  스케일
// ----------------------------------------------------------------------------

export const COLOR_RAMPS = {
  teal: ['#b2f5ea', '#4fd1c5', '#2c9c92', '#1c6b64'],
  blue: ['#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  orange: ['#fed7aa', '#fb923c', '#ea580c', '#9a3412'],
  purple: ['#e9d5ff', '#c084fc', '#9333ea', '#581c87']
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 램프 색 목록을 t∈[0,1] 로 보간 → 'rgb(r,g,b)' */
export function rampColor(stops, t) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** 양 → [0,1]. 제곱근 스케일이라 큰 흐름이 화면을 독점하지 않는다 */
export function flowStrength(count, maxCount) {
  if (!(maxCount > 0)) return 0;
  return Math.min(1, Math.sqrt(count / maxCount));
}

export function flowWidth(count, maxCount, maxWidth) {
  return Math.max(1, maxWidth * flowStrength(count, maxCount));
}

export function locationRadius(total, maxTotal, maxRadius) {
  if (!(maxTotal > 0)) return 3;
  return Math.max(3, maxRadius * Math.sqrt(total / maxTotal));
}
