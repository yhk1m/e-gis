// © 2026 김용현
/**
 * FlowLoader — 흐름 표·위치 표 파일을 { headers, data } 로 읽는다.
 *
 * TableLoader 를 쓰지 않는 이유: 그쪽은 모든 셀에 parseFloat 를 걸어 "1,234" 가 1 이 된다.
 * 흐름 양은 flowModel.readCount 가 쉼표를 벗겨 읽으므로 여기서는 셀을 건드리지 않고 넘긴다
 * (XLSX 숫자 셀은 숫자 그대로, 문자 셀은 문자 그대로, CSV 는 전부 문자열).
 */
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 2차원 배열(첫 행 = 헤더) → { headers, data }. 셀 값은 그대로 둔다.
 * 첫 열 헤더가 비어 있으면(엑셀 행렬표에서 흔한 A1 공백) '구분'으로 채우고,
 * 그 밖의 빈 헤더 열은 버린다. 데이터 행이 하나도 안 남으면(빈 행만 있었어도) 예외.
 */
function rowsToTable(rows) {
  if (!rows || rows.length === 0) throw new Error('표에 데이터가 없습니다.');
  // XLSX 의 sheet_to_json({header:1})은 빈 A1을 배열의 "구멍"으로 낸다. Array#map은 구멍을 건너뛰므로
  // Array.from으로 구멍도 undefined로 채워 방문한다 (CSV는 구멍이 없어 어느 쪽이든 상관없다).
  const headers = Array.from(rows[0], (h, idx) => {
    const s = String(h ?? '').trim();
    return s === '' && idx === 0 ? '구분' : s;
  });
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (!values || values.every((v) => v === undefined || v === null || String(v).trim() === '')) continue;
    const row = {};
    headers.forEach((h, idx) => { if (h) row[h] = values[idx] === undefined || values[idx] === null ? '' : values[idx]; });
    data.push(row);
  }
  if (data.length === 0) throw new Error('표에 데이터가 없습니다.');
  return { headers: headers.filter((h) => h), data };
}

/** XLSX ArrayBuffer → { headers, data } (첫 시트). BuiltinDataManager 의 실습 흐름 데이터도 이걸 쓴다 */
export function parseFlowXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return rowsToTable(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }));
}

/** CSV/TSV 문자열 → { headers, data }. 셀은 전부 문자열 */
export function parseFlowCsv(text) {
  const { data } = Papa.parse(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true });
  return rowsToTable(data);
}

/**
 * CSV 바이트 → 문자열. UTF-8 로 안 되면 CP949(EUC-KR) 로 다시 읽는다
 * (엑셀 한국어판이 "CSV" 로 내보내면 기본이 CP949 라 한글이 깨진다).
 */
export function decodeCsvBytes(arrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(arrayBuffer);
  } catch {
    return new TextDecoder('euc-kr').decode(arrayBuffer);
  }
}

/** @returns {Promise<{ headers: string[], data: Object[], fileName: string }>} */
export async function readFlowFile(file) {
  const isExcel = /\.xls[xm]?$/i.test(file.name);
  const raw = await readFile(file);
  const parsed = isExcel ? parseFlowXlsx(raw) : parseFlowCsv(decodeCsvBytes(raw));
  return { ...parsed, fileName: file.name.replace(/\.[^/.]+$/, '') };
}

const ID_PAT = /^(id|code|코드|지역코드|시도코드|시군구코드|행정구역코드|adm_cd|sido_cd|sig_cd|ctprvn_cd)$/i;
const NAME_PAT = /^(name|이름|명칭|지명|지역|지역명|위치|장소|시도|시도명|시군구|시군구명|행정구역|행정구역명|region|city)$/i;
const LAT_PAT = /^(lat|latitude|위도|y)$/i;
const LON_PAT = /^(lon|lng|long|longitude|경도|x)$/i;

/**
 * 위치 표 → 위치 후보. 열은 이름으로 찾고, 위도·경도가 없으면 예외.
 * @returns {Array<{ id, name, code, lon, lat }>}
 */
export function locationsFromTable({ headers, data }) {
  const find = (pat) => headers.find((h) => pat.test(String(h).trim()));
  const latCol = find(LAT_PAT);
  const lonCol = find(LON_PAT);
  if (!latCol || !lonCol) throw new Error('위치 표에 위도·경도 열이 필요합니다 (예: 위도, 경도 / lat, lon).');
  const idCol = find(ID_PAT);
  const nameCol = find(NAME_PAT) || headers.find((h) => h !== latCol && h !== lonCol && h !== idCol) || idCol;
  // 빈 셀은 Number('') === 0 이 되어 (0,0)에 찍히므로 빈 문자열은 NaN으로 처리해 건너뛴다
  const toCoord = (v) => { const s = String(v ?? '').trim(); return s === '' ? NaN : Number(s); };
  const out = [];
  data.forEach((row, i) => {
    const lat = toCoord(row[latCol]);
    const lon = toCoord(row[lonCol]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    // 위경도 범위를 벗어나면 TM 등 투영 좌표가 잘못 들어온 것이니 버린다
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    const name = String(row[nameCol] ?? '').trim() || `위치 ${i + 1}`;
    const code = idCol ? String(row[idCol] ?? '').trim() : '';
    out.push({ id: code || `loc-${i}`, name, code, lon, lat });
  });
  if (out.length < 2) throw new Error('위치가 2개 이상 필요합니다 (위도·경도는 십진수 도 단위여야 합니다).');
  return out;
}
