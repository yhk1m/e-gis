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

  it('받을 수 있는 건수보다 자료가 많으면 알려준다', async () => {
    const service = SEOUL_ENTRY.path.split('.')[0];
    const rows = Array.from({ length: 3 }, SEOUL_ROW);
    const fetchFn = fakeFetch({
      [service]: { list_total_count: 5000, RESULT: { CODE: 'INFO-000' }, row: rows }
    });

    const res = await handle(seoulQuery(), { fetchFn, keys: KEYS });

    expect(res.body.total).toBe(5000);
    expect(res.body.truncated).toBe(true);
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
