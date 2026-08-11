// © 2026 김용현
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCatalogList, renderNotice, publicDataTab } from './publicDataTab.js';

// 목록 캐시는 모듈 수준에 있다. 테스트끼리 새어 나가지 않게 비운다.
beforeEach(() => publicDataTab._resetCache());

const ITEMS = [
  { id: 'ev-charger', name: '전기차 충전소', description: '지역별 충전소 위치', params: [] },
  { id: 'air', name: '대기오염 측정소', description: '실시간 측정값', params: [] }
];

/** 목록 응답을 주는 가짜 fetch */
const fetchOk = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));

describe('renderCatalogList', () => {
  it('항목 이름과 설명을 그린다', () => {
    const html = renderCatalogList(ITEMS);

    expect(html).toContain('전기차 충전소');
    expect(html).toContain('지역별 충전소 위치');
    expect(html).toContain('대기오염 측정소');
  });

  it('항목마다 id를 실어 둔다 (클릭 처리용)', () => {
    const html = renderCatalogList(ITEMS);

    expect(html).toContain('data-pubdata-id="ev-charger"');
    expect(html).toContain('data-pubdata-id="air"');
  });

  it('목록이 비면 안내 문구를 준다', () => {
    expect(renderCatalogList([])).toContain('없습니다');
  });
});

describe('publicDataTab.mount', () => {
  it('목록을 받아 화면에 그린다', async () => {
    const root = document.createElement('div');
    const fetchFn = fetchOk({ items: ITEMS });

    await publicDataTab.mount(root, { fetchFn });

    expect(root.innerHTML).toContain('전기차 충전소');
    expect(fetchFn).toHaveBeenCalledWith('/api/pubdata?list=1');
  });

  it('서버가 응답하지 않으면 원인을 알려준다', async () => {
    const root = document.createElement('div');
    const fetchFn = vi.fn(async () => { throw new Error('network down'); });

    await publicDataTab.mount(root, { fetchFn });

    expect(root.textContent).toContain('목록을 불러오지 못했습니다');
  });

  it('서버가 오류 안내를 주면 그 문장을 그대로 보여준다', async () => {
    const root = document.createElement('div');
    const fetchFn = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: '서버에 서비스키가 설정되어 있지 않습니다.' })
    }));

    await publicDataTab.mount(root, { fetchFn });

    expect(root.textContent).toContain('서비스키');
  });

  it('두 번 불러도 서버를 다시 부르지 않는다 (목록은 자주 안 바뀐다)', async () => {
    const root = document.createElement('div');
    const fetchFn = fetchOk({ items: ITEMS });

    await publicDataTab.mount(root, { fetchFn });
    await publicDataTab.mount(root, { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('renderNotice', () => {
  it('전달한 문장을 그대로 담는다', () => {
    expect(renderNotice('점검 중입니다')).toContain('점검 중입니다');
  });
});

// ── 목록 → 항목 선택 → 불러오기 → 레이어 추가까지의 흐름 ──────────────

const ENTRY_WITH_PARAM = {
  id: 'ev-charger', name: '전기차 충전소', description: '충전소 위치',
  params: [{ key: 'sido', label: '시도', type: 'select', required: true,
             options: [{ value: '11', label: '서울' }] }]
};

const DATA = {
  items: [
    { lon: 127.0, lat: 37.5, props: { statNm: '가' } },
    { lon: 127.1, lat: 37.6, props: { statNm: '나' } }
  ],
  count: 2, skipped: 0, epsg: 4326
};

/** 목록과 데이터를 순서대로 돌려주는 fetch */
function fetchFlow(dataBody = DATA) {
  const calls = [];
  const fn = vi.fn(async (url) => {
    calls.push(url);
    const body = url.includes('list=1') ? { items: [ENTRY_WITH_PARAM] } : dataBody;
    return { ok: true, json: async () => body };
  });
  fn.urls = calls;
  return fn;
}

async function openDetail(root, fetchFn, extra = {}) {
  await publicDataTab.mount(root, { fetchFn, ...extra });
  root.querySelector('[data-pubdata-id="ev-charger"]').click();
  await Promise.resolve();
}

describe('항목을 고르면', () => {
  it('선택지와 불러오기 버튼이 나온다', async () => {
    const root = document.createElement('div');
    await openDetail(root, fetchFlow());

    expect(root.querySelector('[data-param="sido"]')).toBeTruthy();
    expect(root.querySelector('[data-pubdata-load]')).toBeTruthy();
    expect(root.textContent).toContain('전기차 충전소');
  });

  it('목록으로 돌아갈 수 있다', async () => {
    const root = document.createElement('div');
    await openDetail(root, fetchFlow());

    root.querySelector('[data-pubdata-back]').click();
    await Promise.resolve();

    expect(root.querySelector('[data-pubdata-id="ev-charger"]')).toBeTruthy();
  });
});

describe('불러오기를 누르면', () => {
  it('고른 값을 붙여 서버에 요청한다', async () => {
    const root = document.createElement('div');
    const fetchFn = fetchFlow();
    await openDetail(root, fetchFn);

    await publicDataTab._load(root);

    expect(fetchFn.urls[1]).toContain('id=ev-charger');
    expect(fetchFn.urls[1]).toContain('sido=11');
  });

  it('미리보기와 레이어 추가 버튼을 보여준다', async () => {
    const root = document.createElement('div');
    await openDetail(root, fetchFlow());

    await publicDataTab._load(root);

    expect(root.textContent).toContain('2건');
    expect(root.querySelector('[data-pubdata-add="point"]')).toBeTruthy();
  });

  it('서버가 오류를 주면 그 문장을 보여준다', async () => {
    const root = document.createElement('div');
    const fetchFn = vi.fn(async (url) => url.includes('list=1')
      ? { ok: true, json: async () => ({ items: [ENTRY_WITH_PARAM] }) }
      : { ok: false, json: async () => ({ error: '오늘 사용할 수 있는 요청 한도를 모두 썼습니다.' }) });
    await openDetail(root, fetchFn);

    await publicDataTab._load(root);

    expect(root.textContent).toContain('요청 한도');
  });
});

describe('목록이 늦게 도착할 때', () => {
  it('사용자가 이미 항목을 열었으면 화면을 덮지 않는다', async () => {
    // 서버 첫 호출은 느릴 수 있다. 그 사이 학생이 항목을 눌러 놓았는데
    // 뒤늦게 목록이 도착해 화면을 되돌리면 방금 고른 게 사라진다.
    const root = document.createElement('div');
    let release;
    const slow = new Promise(resolve => { release = resolve; });
    const fetchFn = vi.fn(async (url) => {
      if (url.includes('list=1')) {
        await slow;
        return { ok: true, json: async () => ({ items: [ENTRY_WITH_PARAM] }) };
      }
      return { ok: true, json: async () => DATA };
    });

    const mounting = publicDataTab.mount(root, { fetchFn });
    // 목록이 먼저 도착한 것처럼 캐시를 채우고 항목을 연다
    publicDataTab._openEntry(root, ENTRY_WITH_PARAM);
    release();
    await mounting;

    expect(root.querySelector('[data-pubdata-load]')).toBeTruthy();
    expect(root.querySelector('[data-pubdata-id]')).toBeFalsy();
  });

  it('탭을 다시 열면 목록으로 돌아온다', async () => {
    const root = document.createElement('div');
    const fetchFn = fetchFlow();
    await publicDataTab.mount(root, { fetchFn });
    publicDataTab._openEntry(root, ENTRY_WITH_PARAM);

    await publicDataTab.mount(root, { fetchFn });   // 탭을 닫았다 다시 연 상황

    expect(root.querySelector('[data-pubdata-id="ev-charger"]')).toBeTruthy();
  });
});

describe('포인트로 추가를 누르면', () => {
  it('레이어가 생기고 다이얼로그를 닫는다', async () => {
    const { layerManager } = await import('../../core/LayerManager.js');
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));

    const root = document.createElement('div');
    let closed = false;
    await openDetail(root, fetchFlow(), { onLayerAdded: () => { closed = true; } });
    await publicDataTab._load(root);

    root.querySelector('[data-pubdata-add="point"]').click();
    await Promise.resolve();

    const layers = layerManager.getAllLayers();
    expect(layers).toHaveLength(1);
    expect(layers[0].name).toContain('전기차 충전소');
    expect(layers[0].geometryType).toBe('Point');
    expect(closed).toBe(true);
  });
});
