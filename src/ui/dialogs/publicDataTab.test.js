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

describe('갈래로 접어 보여주기', () => {
  const MIXED = [
    { id: 'a', name: '서울 공공도서관', description: '', category: '교육', params: [] },
    { id: 'b', name: '서울 버스정류소', description: '', category: '교통', params: [] },
    { id: 'c', name: '서울 지하철역', description: '', category: '교통', params: [] },
    { id: 'd', name: '분류없는것', description: '', params: [] }
  ];

  it('갈래마다 묶고 개수를 보여준다', () => {
    const html = renderCatalogList(MIXED, '');

    expect(html).toContain('교통');
    expect(html).toContain('교육');
    expect(html).toContain('2개');   // 교통 2건
  });

  it('갈래는 접힌 채로 시작한다 (350종이 한 번에 펼쳐지면 못 쓴다)', () => {
    const root = document.createElement('div');
    root.innerHTML = renderCatalogList(MIXED, '');

    expect(root.querySelectorAll('.builtin-category.open')).toHaveLength(0);
  });

  it('갈래 머리를 누르면 펼쳐진다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: MIXED }) })) });

    root.querySelector('[data-pubdata-cat]').click();

    expect(root.querySelectorAll('.builtin-category.open').length).toBe(1);
  });

  it('갈래가 없는 항목은 기타로 간다', () => {
    expect(renderCatalogList(MIXED, '')).toContain('기타');
  });

  it('검색 중에는 갈래를 접지 않고 결과만 보여준다', () => {
    const html = renderCatalogList(MIXED, '버스');

    expect(html).toContain('버스정류소');
    expect(html).not.toContain('builtin-category');
  });
});

describe('검색 (항목이 수백 개다)', () => {
  const MANY = [
    { id: 'a', name: '서울 공공도서관', description: '도서관 위치', params: [] },
    { id: 'b', name: '서울 버스정류소', description: '정류소 위치', params: [] },
    { id: 'c', name: '일반음식점 인허가', description: '음식점', params: [] }
  ];

  it('이름으로 걸러낸다', () => {
    expect(renderCatalogList(MANY, '도서')).toContain('공공도서관');
    expect(renderCatalogList(MANY, '도서')).not.toContain('버스정류소');
  });

  it('설명으로도 걸러낸다', () => {
    expect(renderCatalogList(MANY, '정류소')).toContain('버스정류소');
  });

  it('검색어가 없으면 전부 보여준다', () => {
    const html = renderCatalogList(MANY, '');
    expect(html).toContain('공공도서관');
    expect(html).toContain('일반음식점');
  });

  it('찾는 게 없으면 그렇다고 알려준다', () => {
    expect(renderCatalogList(MANY, '없는데이터')).toContain('없습니다');
  });

  it('검색창과 개수를 함께 그린다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: MANY }) })) });

    expect(root.querySelector('[data-pubdata-search]')).toBeTruthy();
    expect(root.textContent).toContain('3');
  });

  it('검색창에 입력하면 목록이 좁아진다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: MANY }) })) });

    const box = root.querySelector('[data-pubdata-search]');
    box.value = '음식';
    box.dispatchEvent(new Event('input', { bubbles: true }));

    expect(root.querySelectorAll('.public-data-item')).toHaveLength(1);
  });
});

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

describe('격자 집계를 누르면', () => {
  it('칸 크기와 집계 방식을 먼저 고르게 한다', async () => {
    const root = document.createElement('div');
    await openDetail(root, fetchFlow());
    await publicDataTab._load(root);

    root.querySelector('[data-pubdata-add="grid"]').click();

    expect(root.querySelector('[data-grid="cellSize"]')).toBeTruthy();
    expect(root.querySelector('[data-grid="method"]')).toBeTruthy();
    expect(root.querySelector('[data-pubdata-grid-create]')).toBeTruthy();
  });

  it('한 번 더 누르면 옵션을 접는다', async () => {
    const root = document.createElement('div');
    await openDetail(root, fetchFlow());
    await publicDataTab._load(root);

    root.querySelector('[data-pubdata-add="grid"]').click();
    root.querySelector('[data-pubdata-add="grid"]').click();

    expect(root.querySelector('[data-grid="cellSize"]')).toBeFalsy();
  });

  it('격자 만들기를 누르면 격자 레이어가 생긴다', async () => {
    const { layerManager } = await import('../../core/LayerManager.js');
    layerManager.getAllLayers().slice().forEach(l => layerManager.removeLayer(l.id));

    const root = document.createElement('div');
    await openDetail(root, fetchFlow());
    await publicDataTab._load(root);
    root.querySelector('[data-pubdata-add="grid"]').click();
    root.querySelector('[data-grid="cellSize"]').value = '5000';

    root.querySelector('[data-pubdata-grid-create]').click();

    const layer = layerManager.getAllLayers()[0];
    expect(layer.geometryType).toBe('Polygon');
    expect(layer.name).toContain('격자 5km');
  });

  it('만들 수 없으면 이유를 보여준다 (칸이 너무 많을 때 등)', async () => {
    const wide = { items: [
      { lon: 124, lat: 33, props: {} }, { lon: 132, lat: 39, props: {} }
    ], count: 2, skipped: 0, epsg: 4326 };
    const root = document.createElement('div');
    await openDetail(root, fetchFlow(wide));
    await publicDataTab._load(root);
    root.querySelector('[data-pubdata-add="grid"]').click();
    root.querySelector('[data-grid="cellSize"]').value = '500';

    root.querySelector('[data-pubdata-grid-create]').click();

    expect(root.textContent).toContain('격자가 너무 촘촘합니다');
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

describe('지역 나누기 (서울·경기가 섞인다)', () => {
  const TWO = [
    { id: 's1', name: '서울 공공도서관', description: '', category: '교육', region: '서울', params: [] },
    { id: 'g1', name: '경기도 도서관 현황', description: '', category: '교육', region: '경기', params: [] },
    { id: 'g2', name: '경기도 버스정류소', description: '', category: '교통', region: '경기', params: [] }
  ];

  it('지역 단추를 그린다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: TWO }) })) });

    const chips = [...root.querySelectorAll('[data-pubdata-region]')].map(e => e.dataset.pubdataRegion);
    expect(chips).toContain('서울');
    expect(chips).toContain('경기');
    expect(chips).toContain('전체');
  });

  it('지역을 고르면 그 지역만 남는다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: TWO }) })) });

    root.querySelector('[data-pubdata-region="경기"]').click();

    // 접힌 갈래도 DOM에는 남아 있으므로(CSS로 감춘다) 이름으로 확인한다
    const names = [...root.querySelectorAll('.public-data-item-name')].map(e => e.textContent);
    expect(names).toEqual(['경기도 도서관 현황', '경기도 버스정류소']);
    expect(root.textContent).toContain('교통');
    const counts = [...root.querySelectorAll('.builtin-badge')].map(e => e.textContent);
    expect(counts).toEqual(['1개', '1개']);   // 경기: 교육 1, 교통 1
  });

  it('전체를 고르면 다시 다 보인다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: TWO }) })) });

    root.querySelector('[data-pubdata-region="경기"]').click();
    root.querySelector('[data-pubdata-region="전체"]').click();

    const counts = [...root.querySelectorAll('.builtin-badge')].map(e => e.textContent);
    expect(counts).toEqual(['2개', '1개']);   // 교육 2, 교통 1
  });

  it('지역과 검색어가 함께 걸린다', async () => {
    const root = document.createElement('div');
    await publicDataTab.mount(root, { fetchFn: vi.fn(async () => ({ ok: true, json: async () => ({ items: TWO }) })) });

    root.querySelector('[data-pubdata-region="경기"]').click();
    const box = root.querySelector('[data-pubdata-search]');
    box.value = '도서관';
    box.dispatchEvent(new Event('input', { bubbles: true }));

    const names = [...root.querySelectorAll('.public-data-item-name')].map(e => e.textContent);
    expect(names).toEqual(['경기도 도서관 현황']);
  });
});
