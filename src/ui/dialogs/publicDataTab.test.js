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
