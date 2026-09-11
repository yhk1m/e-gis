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
