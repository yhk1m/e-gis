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

function readFile(file, asArrayBuffer) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    if (asArrayBuffer) reader.readAsArrayBuffer(file); else reader.readAsText(file, 'UTF-8');
  });
}

/** 2차원 배열(첫 행 = 헤더) → { headers, data }. 빈 헤더 열은 버리고 셀 값은 그대로 둔다 */
function rowsToTable(rows) {
  if (!rows || rows.length < 2) throw new Error('표에 데이터가 없습니다.');
  const headers = rows[0].map((h) => String(h ?? '').trim());
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (!values || values.every((v) => v === undefined || v === null || String(v).trim() === '')) continue;
    const row = {};
    headers.forEach((h, idx) => { if (h) row[h] = values[idx] === undefined || values[idx] === null ? '' : values[idx]; });
    data.push(row);
  }
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
  const { data } = Papa.parse(text.replace(/^﻿/, ''), { skipEmptyLines: true });
  return rowsToTable(data);
}

/** @returns {Promise<{ headers: string[], data: Object[], fileName: string }>} */
export async function readFlowFile(file) {
  const isExcel = /\.xlsx?$/i.test(file.name);
  const raw = await readFile(file, isExcel);
  const parsed = isExcel ? parseFlowXlsx(raw) : parseFlowCsv(raw);
  return { ...parsed, fileName: file.name.replace(/\.[^/.]+$/, '') };
}

const ID_PAT = /^(id|code|코드|지역코드)$/i;
const NAME_PAT = /^(name|이름|명칭|지역|지역명|위치|장소)$/i;
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
  const nameCol = find(NAME_PAT) || headers.find((h) => h !== latCol && h !== lonCol);
  const idCol = find(ID_PAT);
  const out = [];
  data.forEach((row, i) => {
    const lat = Number(row[latCol]);
    const lon = Number(row[lonCol]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const name = String(row[nameCol] ?? '').trim() || `위치 ${i + 1}`;
    const code = idCol ? String(row[idCol] ?? '').trim() : '';
    out.push({ id: code || `loc-${i}`, name, code, lon, lat });
  });
  if (out.length < 2) throw new Error('위치가 2개 이상 필요합니다.');
  return out;
}
