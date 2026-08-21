// © 2026 김용현
/**
 * 공공데이터 중계 함수.
 *
 * 이 함수가 존재하는 이유는 서비스키를 브라우저에 내려보내지 않기 위해서다.
 * 그러니 "키가 어떤 경로로도 응답에 섞이지 않는다"가 가장 중요한 검증이다.
 */
import { describe, it, expect } from 'vitest';
import { handle } from './pubdata.js';
import { CATALOG } from './_catalog.js';

const KEY = 'SECRET-SERVICE-KEY-1234';
const ENTRY = CATALOG[0];
const REQUIRED = (ENTRY.params || []).filter(p => p.required);

/** 성공 응답을 흉내내는 fetch */
function fakeFetch(payload, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    return {
      ok,
      status,
      text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload))
    };
  };
  fn.calls = calls;
  return fn;
}

/** 카탈로그 첫 항목을 부를 수 있는 최소 질의 */
function validQuery() {
  const query = { id: ENTRY.id };
  for (const param of REQUIRED) {
    query[param.key] = param.type === 'select' ? param.options[0].value : '1';
  }
  return query;
}

/** 그 항목의 응답 모양대로 만든 성공 페이로드 */
function payloadWith(rows) {
  const parts = ENTRY.path.split('.');
  const payload = {};
  let cursor = payload;
  parts.forEach((part, index) => {
    cursor[part] = index === parts.length - 1 ? rows : {};
    cursor = cursor[part];
  });
  return payload;
}

const ROW = () => ({ [ENTRY.lon]: '127.0', [ENTRY.lat]: '37.5', name: '테스트' });

describe('목록 (?list=1)', () => {
  it('학생에게 보여줄 정보만 준다', async () => {
    const res = await handle({ list: '1' }, { fetchFn: fakeFetch({}), keys: KEYS });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(CATALOG.length);
    expect(res.body.items[0]).toHaveProperty('id');
    expect(res.body.items[0]).toHaveProperty('name');
  });

  it('엔드포인트와 좌표 필드 매핑은 내보내지 않는다', async () => {
    const res = await handle({ list: '1' }, { fetchFn: fakeFetch({}), keys: KEYS });

    const dumped = JSON.stringify(res.body);
    expect(dumped).not.toContain(ENTRY.endpoint);
    expect(dumped).not.toContain('"path"');
    expect(res.body.items[0].endpoint).toBeUndefined();
    expect(res.body.items[0].lat).toBeUndefined();
    expect(res.body.items[0].lon).toBeUndefined();
  });

  it('키가 없어도 목록은 볼 수 있다', async () => {
    const res = await handle({ list: '1' }, { fetchFn: fakeFetch({}), keys: {} });

    expect(res.status).toBe(200);
  });
});

describe('허용 목록', () => {
  it('id가 없으면 400', async () => {
    const res = await handle({}, { fetchFn: fakeFetch({}), keys: KEYS });

    expect(res.status).toBe(400);
  });

  it('카탈로그에 없는 id는 400이고 원본을 부르지 않는다', async () => {
    const fetchFn = fakeFetch({});

    const res = await handle({ id: '남의API' }, { fetchFn, keys: KEYS });

    expect(res.status).toBe(400);
    expect(fetchFn.calls).toHaveLength(0);
  });

  it('필수 파라미터가 빠지면 400', async () => {
    if (REQUIRED.length === 0) return;
    const query = validQuery();
    delete query[REQUIRED[0].key];

    const res = await handle(query, { fetchFn: fakeFetch({}), keys: KEYS });

    expect(res.status).toBe(400);
  });

  it('선택지에 없는 값은 400', async () => {
    const selectParam = (ENTRY.params || []).find(p => p.type === 'select');
    if (!selectParam) return;
    const query = { ...validQuery(), [selectParam.key]: '없는값' };

    const res = await handle(query, { fetchFn: fakeFetch({}), keys: KEYS });

    expect(res.status).toBe(400);
  });

  it('카탈로그에 없는 파라미터는 원본 요청에 섞이지 않는다', async () => {
    const fetchFn = fakeFetch(payloadWith([ROW()]));

    await handle({ ...validQuery(), 이상한파라미터: 'x' }, { fetchFn, keys: KEYS });

    expect(fetchFn.calls[0]).not.toContain('이상한파라미터');
  });
});

describe('데이터 조회', () => {
  it('정규화된 결과와 캐시 헤더를 준다', async () => {
    const fetchFn = fakeFetch(payloadWith([ROW(), ROW()]));

    const res = await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.items[0]).toMatchObject({ lon: 127, lat: 37.5 });
    expect(res.body.epsg).toBe(ENTRY.epsg || 4326);
    expect(res.headers['Cache-Control']).toContain('s-maxage');
  });

  it('요청 URL에 서비스키를 붙인다', async () => {
    const fetchFn = fakeFetch(payloadWith([ROW()]));

    await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(fetchFn.calls[0]).toContain(encodeURIComponent(KEY));
  });

  it('서버에 키가 없으면 원본을 부르지 않고 안내한다', async () => {
    const fetchFn = fakeFetch(payloadWith([ROW()]));

    const res = await handle(validQuery(), { fetchFn, keys: {} });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('서비스키');
    expect(fetchFn.calls).toHaveLength(0);
  });
});

// ── 서울열린데이터광장 (제공처가 다르면 호출·오류 형식이 다르다) ──────────

const SEOUL_KEY = 'SEOUL-KEY-9999';
const SEOUL_ENTRY = CATALOG.find(e => e.provider === 'seoul');
const KEYS = { 'data.go.kr': KEY, seoul: SEOUL_KEY };

function seoulQuery() {
  const query = { id: SEOUL_ENTRY.id };
  for (const param of (SEOUL_ENTRY.params || []).filter(p => p.required)) {
    query[param.key] = param.type === 'select' ? param.options[0].value : '1';
  }
  return query;
}

function seoulPayload(rows, code = 'INFO-000') {
  const service = SEOUL_ENTRY.path.split('.')[0];
  return {
    [service]: {
      list_total_count: rows.length,
      RESULT: { CODE: code, MESSAGE: '메시지' },
      row: rows
    }
  };
}

const SEOUL_ROW = () => ({ [SEOUL_ENTRY.lon]: '127.0', [SEOUL_ENTRY.lat]: '37.5', name: '대여소' });

describe('서울열린데이터광장', () => {
  it('키와 조건을 경로에 넣어 부른다 (쿼리스트링이 아니다)', async () => {
    const fetchFn = fakeFetch(seoulPayload([SEOUL_ROW()]));

    await handle(seoulQuery(), { fetchFn, keys: KEYS });

    const url = fetchFn.calls[0];
    expect(url).toContain(`/${SEOUL_KEY}/json/`);
    expect(url).not.toContain('serviceKey=');
  });

  it('공공데이터포털 키를 쓰지 않는다', async () => {
    const fetchFn = fakeFetch(seoulPayload([SEOUL_ROW()]));

    await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(fetchFn.calls[0]).not.toContain(KEY);
  });

  it('정상(INFO-000)이면 데이터를 준다', async () => {
    const fetchFn = fetchFn2([SEOUL_ROW(), SEOUL_ROW()]);

    const res = await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('서울시 오류코드도 한국어로 바꾼다', async () => {
    const fetchFn = fakeFetch(seoulPayload([], 'ERROR-300'));

    const res = await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
    expect(res.body.error).not.toContain('ERROR-300');
  });

  it('서울시 키가 없으면 그 사실을 알린다', async () => {
    const fetchFn = fakeFetch(seoulPayload([SEOUL_ROW()]));

    const res = await handle(seoulQuery(), { fetchFn, keys: { 'data.go.kr': KEY } });

    expect(res.status).toBe(500);
    expect(fetchFn.calls).toHaveLength(0);
  });

  /**
   * 서울시는 한 번에 1,000건까지만 준다. 게다가 list_total_count가 전체가 아니라
   * '요청 범위의 건수'라서 그 값만 보면 더 있는지 알 수 없다(1/5로 물으면 5가 온다).
   * 그래서 한 페이지가 꽉 차면 다음 페이지를 마저 받아야 한다.
   */
  function pagedFetch(pageSizes) {
    const calls = [];
    const service = SEOUL_ENTRY.path.split('.')[0];
    let page = 0;
    const fn = async (url) => {
      calls.push(url);
      const size = pageSizes[page++] ?? 0;
      const rows = Array.from({ length: size }, SEOUL_ROW);
      return { ok: true, status: 200, text: async () => JSON.stringify({
        [service]: { list_total_count: size, RESULT: { CODE: 'INFO-000' }, row: rows } }) };
    };
    fn.calls = calls;
    return fn;
  }

  it('한 페이지가 꽉 차면 다음 페이지를 마저 받는다', async () => {
    const max = SEOUL_ENTRY.maxRows;
    const fetchFn = pagedFetch([max, max, 300]);

    const res = await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(fetchFn.calls).toHaveLength(3);
    expect(res.body.count).toBe(max * 2 + 300);
  });

  it('페이지마다 시작·끝 번호를 옮겨 부른다', async () => {
    const max = SEOUL_ENTRY.maxRows;
    const fetchFn = pagedFetch([max, 1]);

    await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(fetchFn.calls[0]).toContain(`/1/${max}/`);
    expect(fetchFn.calls[1]).toContain(`/${max + 1}/${max * 2}/`);
  });

  it('덜 찬 페이지가 나오면 멈춘다', async () => {
    const fetchFn = pagedFetch([300]);

    await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(fetchFn.calls).toHaveLength(1);
  });

  it('상한까지 받고도 더 있으면 잘렸다고 알린다', async () => {
    const max = SEOUL_ENTRY.maxRows;
    const fetchFn = pagedFetch(Array(20).fill(max));

    const res = await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(res.body.truncated).toBe(true);
    expect(res.body.count).toBeLessThanOrEqual(max * (SEOUL_ENTRY.maxPages || 5));
  });

  it('한 번에 받는 제공처도 전체 건수보다 적게 받으면 잘렸다고 알린다', async () => {
    // 전기차 충전소는 서울만 75,959건인데 한 번에 1,000건만 온다.
    // 쪽 나눔을 안 하므로 상한 판정을 못 거쳐 예전에는 조용히 일부만 보여줬다.
    const rows = Array.from({ length: 3 }, ROW);
    const payload = payloadWith(rows);
    payload.totalCount = 500;

    const fetchFn = fakeFetch(payload);
    const res = await handle(validQuery(), { fetchFn, keys: { 'data.go.kr': KEY } });

    expect(res.body.count).toBe(3);
    expect(res.body.total).toBe(500);
    expect(res.body.truncated).toBe(true);
  });

  it('전부 받았으면 잘렸다고 하지 않는다', async () => {
    const rows = Array.from({ length: 3 }, ROW);
    const payload = payloadWith(rows);
    payload.totalCount = 3;

    const fetchFn = fakeFetch(payload);
    const res = await handle(validQuery(), { fetchFn, keys: { 'data.go.kr': KEY } });

    expect(res.body.truncated).toBe(false);
  });

  it('공공데이터포털은 페이지를 넘기지 않는다 (한 번에 받는다)', async () => {
    const fetchFn = fakeFetch(payloadWith(Array.from({ length: 1000 }, ROW)));

    await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(fetchFn.calls).toHaveLength(1);
  });

  it('어떤 오류에서도 서울시 키가 응답에 섞이지 않는다', async () => {
    const fetchFn = fakeFetch(seoulPayload([], 'ERROR-500'));

    const res = await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(JSON.stringify(res.body)).not.toContain(SEOUL_KEY);
  });
});

/** 서울 정상 응답용 헬퍼 */
function fetchFn2(rows) {
  return fakeFetch(seoulPayload(rows));
}

describe('오류를 한국어로 바꾼다', () => {
  const errorPayload = (code, msg) => ({
    response: { header: { resultCode: code, resultMsg: msg } }
  });

  it('일일 요청 한도 초과', async () => {
    const fetchFn = fakeFetch(errorPayload('22', 'LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR'));

    const res = await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('한도');
  });

  it('등록되지 않은 서비스키', async () => {
    const fetchFn = fakeFetch(errorPayload('30', 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'));

    const res = await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(res.body.error).toContain('서비스키');
  });

  it('JSON이 아닌 응답(점검 중 HTML·XML)도 안내로 바꾼다', async () => {
    const fetchFn = fakeFetch('<html>서비스 점검 중</html>');

    const res = await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(res.status).toBe(502);
    expect(typeof res.body.error).toBe('string');
  });

  it('네트워크가 끊기면 안내로 바꾼다', async () => {
    const fetchFn = async () => { throw new Error('network down'); };

    const res = await handle(validQuery(), { fetchFn, keys: KEYS });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });

  it('어떤 오류에서도 서비스키가 응답에 섞이지 않는다', async () => {
    const cases = [
      fakeFetch(errorPayload('22', 'LIMITED')),
      fakeFetch('<html>점검</html>'),
      async () => { throw new Error(`fetch failed for https://x?serviceKey=${KEY}`); }
    ];

    for (const fetchFn of cases) {
      const res = await handle(validQuery(), { fetchFn, keys: KEYS });
      expect(JSON.stringify(res.body)).not.toContain(KEY);
    }
  });
});

// ── 경기데이터드림 ────────────────────────────────────────────────

const GG_KEY = 'GG-KEY-7777';
const GG_ENTRY = {
  id: 'gg-test', provider: 'gg', name: '경기 시험 자료', description: '',
  endpoint: 'https://openapi.gg.go.kr', service: 'TBTEST', params: [],
  maxRows: 1000, maxPages: 3, path: 'TBTEST.1.row',
  lon: 'REFINE_WGS84_LOGT', lat: 'REFINE_WGS84_LAT', epsg: 4326, label: 'FACLT_NM', numeric: []
};

/** 경기 응답 모양: {서비스: [{head:[{list_total_count},{RESULT},{api_version}]}, {row:[…]}]} */
function ggPayload(rows, code = 'INFO-000', total = null) {
  return {
    TBTEST: [
      { head: [{ list_total_count: total === null ? rows.length : total },
               { RESULT: { CODE: code, MESSAGE: '메시지' } },
               { api_version: '1.0' }] },
      { row: rows }
    ]
  };
}
const GG_ROW = () => ({ REFINE_WGS84_LOGT: 127.14, REFINE_WGS84_LAT: 37.41, FACLT_NM: '시험시설' });

describe('경기데이터드림', () => {
  it('KEY·Type·페이지를 쿼리로 붙여 부른다', async () => {
    const fetchFn = fakeFetch(ggPayload([GG_ROW()]));

    await handle({ id: GG_ENTRY.id }, { fetchFn, keys: { gg: GG_KEY }, catalog: [GG_ENTRY] });

    expect(fetchFn.calls[0]).toContain('/TBTEST?KEY=' + GG_KEY);
    expect(fetchFn.calls[0]).toContain('Type=json');
    expect(fetchFn.calls[0]).toContain('pIndex=1');
    expect(fetchFn.calls[0]).toContain('pSize=1000');
  });

  it('배열 속 row를 찾아 정규화한다', async () => {
    const fetchFn = fakeFetch(ggPayload([GG_ROW(), GG_ROW()]));

    const res = await handle({ id: GG_ENTRY.id }, { fetchFn, keys: { gg: GG_KEY }, catalog: [GG_ENTRY] });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.items[0]).toMatchObject({ lon: 127.14, lat: 37.41 });
  });

  it('head의 전체 건수를 그대로 알려준다 (경기는 진짜 총건수를 준다)', async () => {
    const fetchFn = fakeFetch(ggPayload([GG_ROW()], 'INFO-000', 420));

    const res = await handle({ id: GG_ENTRY.id }, { fetchFn, keys: { gg: GG_KEY }, catalog: [GG_ENTRY] });

    expect(res.body.total).toBe(420);
  });

  it('오류코드를 한국어로 바꾼다', async () => {
    const fetchFn = fakeFetch(ggPayload([], 'ERROR-310'));

    const res = await handle({ id: GG_ENTRY.id }, { fetchFn, keys: { gg: GG_KEY }, catalog: [GG_ENTRY] });

    expect(res.status).toBe(502);
    expect(res.body.error).not.toContain('ERROR-310');
  });

  it('키가 없으면 부르지 않는다', async () => {
    const fetchFn = fakeFetch(ggPayload([GG_ROW()]));

    const res = await handle({ id: GG_ENTRY.id }, { fetchFn, keys: {}, catalog: [GG_ENTRY] });

    expect(res.status).toBe(500);
    expect(fetchFn.calls).toHaveLength(0);
  });

  it('브라우저인 척 부른다 (User-Agent가 없으면 차단당한 적이 있다)', async () => {
    const headers = [];
    const fetchFn = async (url, init) => {
      headers.push(init && init.headers);
      return { ok: true, status: 200, text: async () => JSON.stringify(ggPayload([GG_ROW()])) };
    };
    fetchFn.calls = [];

    await handle({ id: GG_ENTRY.id }, { fetchFn, keys: { gg: GG_KEY }, catalog: [GG_ENTRY] });

    expect(headers[0] && headers[0]['User-Agent']).toBeTruthy();
  });
});

describe('카탈로그 자체', () => {
  it('id가 겹치지 않는다 (겹치면 뒤엣것을 영영 못 부른다)', () => {
    const ids = CATALOG.map(entry => entry.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('모든 항목에 좌표 필드와 경로가 있다', () => {
    const broken = CATALOG.filter(e => !e.lon || !e.lat || !e.path);
    expect(broken.map(e => e.name)).toEqual([]);
  });

  it('모든 항목의 제공처를 아는 것으로 둔다', () => {
    const providers = new Set(CATALOG.map(e => e.provider));
    expect([...providers].sort()).toEqual(['data.go.kr', 'gg', 'incheon', 'seoul']);
  });
});

/**
 * 인천데이터포털은 봉투가 두 가지다 (실측, 2026-08-21)
 *   성공: { data: [...], message: 'Success' }
 *   오류: { code, msg, host, result: null }
 * 게다가 쪽 번호가 0부터라 1을 넣으면 빈 배열이 온다.
 */
const INCHEON_KEY = 'INCHEON-KEY-7777';
const INCHEON_ENTRY = CATALOG.find(e => e.provider === 'incheon');
const IN_KEYS = { 'data.go.kr': KEY, seoul: SEOUL_KEY, incheon: INCHEON_KEY };

const incheonQuery = () => ({ id: INCHEON_ENTRY.id });
const incheonOk = (rows) => ({ data: rows, message: 'Success' });
const incheonErr = (code, msg) => ({ code, msg, host: 'idata-was-server1', result: null });
const IN_ROW = () => ({ [INCHEON_ENTRY.lon]: '126.63', [INCHEON_ENTRY.lat]: '37.46', LBRRY_NM: '율목도서관' });

describe('인천데이터포털', () => {
  it('serviceUri 뒤에 apiKey와 returnType을 붙여 부른다', async () => {
    const fetchFn = fakeFetch(incheonOk([IN_ROW()]));

    await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    const url = fetchFn.calls[0];
    expect(url).toContain('/openapi/');
    expect(url).toContain(`apiKey=${INCHEON_KEY}`);
    expect(url).toContain('returnType=json');
    expect(url).not.toContain('serviceKey=');
  });

  it('다른 포털 키를 쓰지 않는다', async () => {
    const fetchFn = fakeFetch(incheonOk([IN_ROW()]));

    await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    expect(fetchFn.calls[0]).not.toContain(KEY);
    expect(fetchFn.calls[0]).not.toContain(SEOUL_KEY);
  });

  it('필수인 pageNo를 빠뜨리지 않는다 (없으면 706이 온다)', async () => {
    const fetchFn = fakeFetch(incheonOk([IN_ROW()]));

    await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    expect(fetchFn.calls[0]).toContain('pageNo=0');
  });

  it('성공 봉투({data, message})에서 데이터를 읽는다', async () => {
    const fetchFn = fakeFetch(incheonOk([IN_ROW(), IN_ROW()]));

    const res = await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('활용신청하지 않은 API(707)는 그 사실을 한국어로 알린다', async () => {
    const fetchFn = fakeFetch(incheonErr('707', 'NOT_FOUND_SERVICE_HISTORY-해당 API서비스가 없거나 신청하지 않은 서비스입니다.'));

    const res = await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('활용신청');
    expect(res.body.error).not.toContain('NOT_FOUND_SERVICE_HISTORY');
  });

  it('잘못된 키(701)도 한국어로 바꾼다', async () => {
    const fetchFn = fakeFetch(incheonErr('701', 'NOT_FOUND_APIKEY_ISSUE_HISTORY-확인되지 않는 KEY입니다.'));

    const res = await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('인증키');
  });

  it('인천 키가 없으면 원본을 부르지 않는다', async () => {
    const fetchFn = fakeFetch(incheonOk([IN_ROW()]));

    const res = await handle(incheonQuery(), { fetchFn, keys: { 'data.go.kr': KEY } });

    expect(res.status).toBe(500);
    expect(fetchFn.calls).toHaveLength(0);
  });

  it('어떤 오류에서도 인천 키가 응답에 섞이지 않는다', async () => {
    const fetchFn = fakeFetch(incheonErr('707', `키는 ${INCHEON_KEY} 입니다`));

    const res = await handle(incheonQuery(), { fetchFn, keys: IN_KEYS });

    expect(JSON.stringify(res.body)).not.toContain(INCHEON_KEY);
  });
});
