// © 2026 김용현
/**
 * flowModel — 흐름 데이터의 순수 계산.
 * 표(헤더+행) → 흐름 쌍 → 위치 매칭 → FlowDataset → 집계·스케일. DOM·OL을 모른다.
 *
 * FlowDataset = {
 *   locations: [{ id, name, lon, lat }],
 *   flows:     [{ origin, dest, count }],   // origin/dest 는 locations 의 id
 *   meta:      { title, unit, source, matched, unmatched: [{ name, count }], skipped }
 *              // matched 는 병합하기 전, 양쪽 다 위치를 찾은 입력 쌍(행)의 개수
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

// KOSIS 표에서 빈 칸을 '-' 로 표시하는 경우가 있다 — 빈 칸과 똑같이 다룬다
function isBlankCell(v) {
  return v == null || v === '' || String(v).trim() === '-';
}

function isNumeric(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (isBlankCell(v)) return false;
  return Number.isFinite(Number(String(v).replace(/,/g, '').trim()));
}

/** 'long' | 'matrix' — 첫 열 뒤 셀의 80% 이상이 숫자면 행렬형(첫 행 기준) */
export function detectTableShape({ headers, data }) {
  if (headers.length < 4 || data.length === 0) return 'long';
  const cells = headers.slice(1).map((h) => data[0][h]);
  const numeric = cells.filter(isNumeric).length;
  return numeric >= cells.length * 0.8 ? 'matrix' : 'long';
}

/** 셀 → 양. 숫자가 아니면 NaN, 빈 칸('-' 포함)은 0. Infinity 는 숫자로 치지 않는다 */
function readCount(v) {
  if (isBlankCell(v)) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
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
 * 빈 칸·0은 "흐름 없음"이라 조용히 버리고, 숫자가 아니거나 음수인 셀은 건너뛰고 센다. 합계 행·열은 뺀다.
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
      if (Number.isNaN(n) || n < 0) { skipped++; continue; }
      if (n > 0) pairs.push({ origin: o, dest: String(d).trim(), count: n });
    }
  }
  return { pairs, skipped };
}

// ----------------------------------------------------------------------------
//  이름 정규화·매칭
// ----------------------------------------------------------------------------

// 모든 대안이 $ 로 끝에 고정돼 있어, 정규식이 가장 왼쪽(=가장 긴 접미사)에서 먼저 매칭에 성공한다 — 나열 순서는 결과에 영향을 주지 않는다
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

/** 같은 id 의 후보가 여러 번 있으면 첫 값만 남긴다 (locations 에 중복 id 가 들어가지 않도록) */
function dedupeCandidates(candidates) {
  const seen = new Set();
  const result = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    result.push(c);
  }
  return result;
}

function buildIndex(candidates) {
  const byCode = new Map();
  const byNameIds = new Map(); // 정규화한 이름 → 그 이름을 쓰는 서로 다른 id 의 집합
  const ids = new Set();       // 실제로 존재하는 후보 id (manualMap 검증용)
  for (const c of candidates) {
    ids.add(c.id);
    if (c.code != null && String(c.code).trim() !== '') {
      const codeKey = String(c.code).trim();
      if (!byCode.has(codeKey)) byCode.set(codeKey, c.id);
    }
    const key = normalizeName(c.name);
    if (!key) continue;
    if (!byNameIds.has(key)) byNameIds.set(key, new Set());
    byNameIds.get(key).add(c.id);
  }
  // 이름 하나가 서로 다른 id 여럿을 가리키면(예: 고성군 → 강원/경남) 모호하므로 이름 매칭에서 뺀다.
  // 손 매칭(manualMap)이나 코드 매칭으로 풀도록 unmatched 에 남긴다.
  const byName = new Map();
  for (const [key, idSet] of byNameIds) {
    if (idSet.size === 1) byName.set(key, [...idSet][0]);
  }
  return { byCode, byName, ids };
}

function resolveId(rawName, index, manualMap) {
  // hasOwn 으로만 확인해야 'constructor' 같은 이름이 프로토타입 속성으로 오인되지 않는다.
  // 후보에 실제로 없는 id 를 가리키면(오타·삭제된 위치) 무시하고 자동 매칭으로 넘어간다 —
  // 그래야 locations 에 없는 id 가 flows 에 매달리는(dangling) 일이 없다.
  if (Object.hasOwn(manualMap, rawName) && manualMap[rawName] && index.ids.has(manualMap[rawName])) {
    return manualMap[rawName];
  }
  const trimmed = String(rawName).trim();
  if (index.byCode.has(trimmed)) return index.byCode.get(trimmed);
  const id = index.byName.get(normalizeName(trimmed));
  return id === undefined ? null : id;
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
  const dedupedCandidates = dedupeCandidates(candidates);
  const index = buildIndex(dedupedCandidates);
  // origin id → Map(dest id → count). 문자열로 이어붙였다 쪼개지 않아 id 가 '|' 를 포함하거나
  // 숫자여도 locations[].id 와 그대로(===) 일치한다.
  const flowMap = new Map();
  const unmatched = new Map();   // 원본 이름 → 양
  const used = new Set();
  let matched = 0;
  for (const p of pairs) {
    const o = resolveId(p.origin, index, manualMap);
    const d = resolveId(p.dest, index, manualMap);
    // 출발·도착이 같은 이름이라 둘 다 못 찾아도 한 쌍의 양을 두 번 더하지 않는다
    const missingNames = new Set();
    if (o == null) missingNames.add(p.origin);
    if (d == null) missingNames.add(p.dest);
    for (const name of missingNames) unmatched.set(name, (unmatched.get(name) || 0) + p.count);
    if (o == null || d == null) continue;
    matched++;
    used.add(o); used.add(d);
    if (!flowMap.has(o)) flowMap.set(o, new Map());
    const inner = flowMap.get(o);
    inner.set(d, (inner.get(d) || 0) + p.count);
  }
  const flows = [];
  for (const [origin, inner] of flowMap) {
    for (const [dest, count] of inner) flows.push({ origin, dest, count });
  }
  const locations = dedupedCandidates
    .filter((c) => used.has(c.id))
    .map(({ id, name, lon, lat }) => ({ id, name, lon, lat }));
  return {
    locations,
    flows,
    meta: {
      ...meta,
      matched,
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

// 낮은 끝은 중간 톤으로 둔다 — 아주 옅은 색은 밝은 배경지도(OSM·흰 면 채움) 위에서 보이지 않는다.
// 어두운 배경에서는 어차피 밝은 쪽으로 보이므로 양쪽 다 읽힌다.
export const COLOR_RAMPS = {
  teal: ['#5eead4', '#14b8a6', '#0f766e', '#134e4a'],
  blue: ['#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  orange: ['#fdba74', '#f97316', '#c2410c', '#7c2d12'],
  purple: ['#d8b4fe', '#a855f7', '#7e22ce', '#581c87']
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 16진 색을 흰색 쪽으로 f(0~1)만큼 섞는다 → '#rrggbb' (어두운 배경용 램프의 밝은 끝을 만들 때) */
export function lightenHex(hex, f) {
  const c = hexToRgb(hex).map((v) => Math.round(v + (255 - v) * Math.min(1, Math.max(0, f))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 어두운 배경지도용 램프: 밝은 배경 램프(옅음→진함)를 "중간 진함 → 아주 밝음"으로 다시 편다.
 * 작은 흐름도 어두운 바탕 위에서 읽히고(중간 톤), 큰 흐름은 가장 밝게 도드라진다 (flowmap.blue 다크 모드).
 */
export function darkModeStops(stops) {
  return [stops[2], stops[1], stops[0], lightenHex(stops[0], 0.55)];
}

/** 램프 색 목록을 t∈[0,1] 로 보간 → 'rgb(r,g,b)'. t 가 NaN·Infinity 면 0 으로 본다 */
export function rampColor(stops, t) {
  const t0 = Number.isFinite(t) ? t : 0;
  const x = Math.min(1, Math.max(0, t0)) * (stops.length - 1);
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
