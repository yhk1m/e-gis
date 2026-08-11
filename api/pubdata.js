// © 2026 김용현
/**
 * 공공데이터 중계 함수 (Vercel 서버리스).
 *
 * 왜 있는가: 서비스키를 브라우저에 내려보내지 않기 위해서다. 키가 번들에 들어가면
 * 누구나 꺼내 쓸 수 있고, 하루 호출 한도가 남의 손에 소진된다.
 *
 *   GET /api/pubdata?list=1              → 학생에게 보여줄 목록
 *   GET /api/pubdata?id=ev-charger&sido=11  → 정규화된 데이터
 *
 * ⚠️ 루트 package.json이 "type": "module"이라 이 파일은 ESM이어야 한다.
 *    CommonJS(module.exports)로 쓰면 배포 후 500이 난다.
 */

import { CATALOG, findEntry, publicView } from './_catalog.js';
import { normalize } from './_normalize.js';

const CACHE_HEADER = 'public, s-maxage=600, stale-while-revalidate=3600';
const TIMEOUT_MS = 10000;

/**
 * 포털 오류를 수업 중에 읽고 대처할 수 있는 문장으로 바꾼다.
 * 원문 메시지는 영어 대문자 코드라 학생·교사가 원인을 알 수 없다.
 */
function translateError(code, message) {
  const table = {
    '01': '공공데이터포털에 일시적인 오류가 있습니다. 잠시 후 다시 시도해 주세요.',
    '12': '요청한 데이터 서비스가 폐기되었습니다. 카탈로그 항목을 수정해야 합니다.',
    '20': '서비스 접근이 거부되었습니다. 활용신청 상태를 확인해 주세요.',
    '22': '오늘 사용할 수 있는 요청 한도를 모두 썼습니다. 내일 다시 시도하거나 운영계정으로 상향 신청이 필요합니다.',
    '30': '등록되지 않은 서비스키입니다. 서버의 서비스키 설정을 확인해 주세요.',
    '31': '서비스키 사용 기한이 지났습니다. 공공데이터포털에서 연장해 주세요.',
    '32': '허용되지 않은 곳에서의 호출입니다. 활용신청 정보를 확인해 주세요.',
    '33': '서명되지 않은 호출입니다.'
  };

  if (table[code]) return table[code];

  const upper = String(message || '').toUpperCase();
  if (upper.includes('LIMITED NUMBER OF SERVICE REQUESTS')) return table['22'];
  if (upper.includes('SERVICE_KEY_IS_NOT_REGISTERED')) return table['30'];
  if (upper.includes('DEADLINE_HAS_EXPIRED')) return table['31'];

  return '공공데이터포털에서 데이터를 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 응답에 서비스키가 섞이지 않도록 마지막에 한 번 더 지운다 */
function stripKey(text, key) {
  if (!key) return text;
  return String(text).split(key).join('***').split(encodeURIComponent(key)).join('***');
}

/** 질의를 카탈로그 정의에 맞춰 검증하고 포털이 요구하는 이름으로 바꾼다 */
function buildParams(entry, query) {
  const params = {};

  for (const param of entry.params || []) {
    const raw = query[param.key];
    const value = raw === undefined || raw === null ? '' : String(raw).trim();

    if (!value) {
      if (param.required) return { error: `'${param.label}'을(를) 선택해 주세요.` };
      continue;
    }

    if (param.type === 'select') {
      const allowed = (param.options || []).some(option => String(option.value) === value);
      if (!allowed) return { error: `'${param.label}'에 쓸 수 없는 값입니다.` };
    }

    params[param.sendAs || param.key] = value;
  }

  return { params };
}

/**
 * 실제 처리. 테스트가 부르는 지점이라 fetch와 키를 주입받는다.
 * @returns {{status: number, body: Object, headers: Object}}
 */
export async function handle(query = {}, { fetchFn, key } = {}) {
  if (query.list) {
    return {
      status: 200,
      headers: { 'Cache-Control': CACHE_HEADER },
      body: { items: CATALOG.map(publicView) }
    };
  }

  const entry = findEntry(query.id);
  if (!entry) {
    return { status: 400, headers: {}, body: { error: '등록되지 않은 데이터입니다.' } };
  }

  const built = buildParams(entry, query);
  if (built.error) {
    return { status: 400, headers: {}, body: { error: built.error } };
  }

  if (!key) {
    return {
      status: 500,
      headers: {},
      body: { error: '서버에 서비스키가 설정되어 있지 않습니다. 관리자에게 알려 주세요.' }
    };
  }

  const search = new URLSearchParams({ ...(entry.fixed || {}), ...built.params });
  // serviceKey는 포털이 인코딩된 값을 요구해 URLSearchParams와 따로 붙인다
  const url = `${entry.endpoint}?serviceKey=${encodeURIComponent(key)}&${search.toString()}`;

  let text;
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await response.text();
    if (!response.ok) {
      return {
        status: 502,
        headers: {},
        body: { error: `공공데이터포털이 응답하지 않았습니다. (${response.status})` }
      };
    }
  } catch (e) {
    return {
      status: 502,
      headers: {},
      body: { error: '공공데이터포털에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
    };
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    // 점검 중이거나 오류일 때 HTML·XML이 온다
    return {
      status: 502,
      headers: {},
      body: { error: '공공데이터포털이 데이터 대신 오류 안내를 보냈습니다. 서비스 점검 중일 수 있습니다.' }
    };
  }

  const header = (raw && raw.response && raw.response.header) || {};
  const code = header.resultCode !== undefined ? String(header.resultCode) : null;
  if (code && code !== '00' && code !== '0') {
    return {
      status: 502,
      headers: {},
      body: { error: stripKey(translateError(code, header.resultMsg), key) }
    };
  }

  const result = normalize(raw, entry);
  return {
    status: 200,
    headers: { 'Cache-Control': CACHE_HEADER },
    body: { ...result, fetchedAt: new Date().toISOString() }
  };
}

/** Vercel 진입점 — 얇게 유지한다 */
export default async function handler(req, res) {
  const result = await handle(req.query || {}, {
    fetchFn: fetch,
    key: process.env.DATA_GO_KR_KEY || ''
  });

  for (const [name, value] of Object.entries(result.headers || {})) {
    res.setHeader(name, value);
  }
  res.status(result.status).json(result.body);
}
