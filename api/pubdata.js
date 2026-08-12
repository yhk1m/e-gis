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
 * 제공처별로 다른 것 세 가지를 여기서 흡수한다: 키 이름 · URL 조립 · 오류 판정.
 * 응답 구조 차이(배열 위치·좌표 필드)는 카탈로그의 path/lon/lat이 이미 흡수한다.
 */
const PROVIDERS = {
  'data.go.kr': {
    keyName: 'DATA_GO_KR_KEY',
    label: '공공데이터포털',
    /** ?serviceKey=…&조건 (쿼리스트링) */
    buildUrl(entry, params, key) {
      const search = new URLSearchParams({ ...(entry.fixed || {}), ...params });
      // serviceKey는 포털이 인코딩된 값을 요구해 URLSearchParams와 따로 붙인다
      return `${entry.endpoint}?serviceKey=${encodeURIComponent(key)}&${search.toString()}`;
    },
    /** 정상은 resultCode '00'. 그 외는 오류다 */
    findError(raw) {
      const header = (raw && raw.response && raw.response.header) || {};
      if (header.resultCode === undefined) return null;
      const code = String(header.resultCode);
      if (code === '00' || code === '0') return null;
      return { code, message: header.resultMsg };
    },
    total(raw) {
      const body = (raw && raw.response && raw.response.body) || {};
      return Number(body.totalCount) || null;
    }
  },

  seoul: {
    keyName: 'SEOUL_OPENAPI_KEY',
    label: '서울열린데이터광장',
    /** /{키}/json/{서비스}/{시작}/{끝}/{조건…} (경로에 박는다) */
    buildUrl(entry, params, key) {
      const maxRows = entry.maxRows || 1000;
      const ordered = (entry.params || [])
        .map(param => params[param.sendAs || param.key])
        .filter(value => value !== undefined && value !== '')
        .map(value => encodeURIComponent(value));

      const parts = [entry.endpoint, encodeURIComponent(key), 'json',
                     entry.service, '1', String(maxRows), ...ordered];
      return parts.join('/') + '/';
    },
    /** 정상은 RESULT.CODE가 INFO-000 */
    findError(raw) {
      const service = raw && typeof raw === 'object' ? raw[Object.keys(raw)[0]] : null;
      const result = (service && service.RESULT) || (raw && raw.RESULT);
      if (!result || result.CODE === undefined) return null;
      const code = String(result.CODE);
      if (code === 'INFO-000') return null;
      return { code, message: result.MESSAGE };
    },
    total(raw) {
      const service = raw && typeof raw === 'object' ? raw[Object.keys(raw)[0]] : null;
      return service ? Number(service.list_total_count) || null : null;
    }
  }
};

function providerOf(entry) {
  return PROVIDERS[entry.provider] || PROVIDERS['data.go.kr'];
}

/** 서울열린데이터광장 오류코드 */
const SEOUL_ERRORS = {
  'INFO-100': '인증키가 잘못되었습니다. 서버의 서울시 인증키 설정을 확인해 주세요.',
  'INFO-200': '조건에 맞는 자료가 없습니다.',
  'ERROR-300': '요청 형식이 올바르지 않습니다. 카탈로그 설정을 확인해야 합니다.',
  'ERROR-301': '요청 형식이 올바르지 않습니다. 카탈로그 설정을 확인해야 합니다.',
  'ERROR-310': '없는 서비스를 요청했습니다. 카탈로그 설정을 확인해야 합니다.',
  'ERROR-331': '한 번에 요청할 수 있는 건수를 넘었습니다.',
  'ERROR-332': '한 번에 요청할 수 있는 건수를 넘었습니다.',
  'ERROR-336': '한 번에 받을 수 있는 건수(1,000건)를 넘겼습니다.',
  'ERROR-500': '서울열린데이터광장에 일시적인 오류가 있습니다. 잠시 후 다시 시도해 주세요.',
  'ERROR-600': '서울열린데이터광장 서버가 응답하지 않습니다.',
  'ERROR-601': '서울열린데이터광장 서버가 응답하지 않습니다.'
};

/**
 * 포털 오류를 수업 중에 읽고 대처할 수 있는 문장으로 바꾼다.
 * 원문 메시지는 영어 대문자 코드라 학생·교사가 원인을 알 수 없다.
 */
function translateError(code, message) {
  if (SEOUL_ERRORS[code]) return SEOUL_ERRORS[code];
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

/** 질의를 카탈로그 정의에 맞춰 검증하고 제공처가 요구하는 이름으로 바꾼다 */
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
export async function handle(query = {}, { fetchFn, keys = {} } = {}) {
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

  const provider = providerOf(entry);
  const key = keys[entry.provider || 'data.go.kr'] || '';

  if (!key) {
    return {
      status: 500,
      headers: {},
      body: { error: `서버에 ${provider.label} 서비스키가 설정되어 있지 않습니다. 관리자에게 알려 주세요.` }
    };
  }

  const url = provider.buildUrl(entry, built.params, key);

  let text;
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await response.text();
    if (!response.ok) {
      return {
        status: 502,
        headers: {},
        body: { error: `${provider.label}이(가) 응답하지 않았습니다. (${response.status})` }
      };
    }
  } catch (e) {
    return {
      status: 502,
      headers: {},
      body: { error: `${provider.label}에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.` }
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
      body: { error: `${provider.label}이(가) 데이터 대신 오류 안내를 보냈습니다. 서비스 점검 중일 수 있습니다.` }
    };
  }

  const failure = provider.findError(raw);
  if (failure) {
    return {
      status: 502,
      headers: {},
      body: { error: stripKey(translateError(failure.code, failure.message), key) }
    };
  }

  const result = normalize(raw, entry);
  const total = provider.total(raw);

  return {
    status: 200,
    headers: { 'Cache-Control': CACHE_HEADER },
    body: {
      ...result,
      // 제공처가 한 번에 주는 양보다 자료가 많으면 일부만 받은 것이다 — 숨기지 않는다
      total: total,
      truncated: !!(total && total > result.count + result.skipped),
      fetchedAt: new Date().toISOString()
    }
  };
}

/** Vercel 진입점 — 얇게 유지한다 */
export default async function handler(req, res) {
  const result = await handle(req.query || {}, {
    fetchFn: fetch,
    keys: {
      'data.go.kr': process.env.DATA_GO_KR_KEY || '',
      seoul: process.env.SEOUL_OPENAPI_KEY || ''
    }
  });

  for (const [name, value] of Object.entries(result.headers || {})) {
    res.setHeader(name, value);
  }
  res.status(result.status).json(result.body);
}
