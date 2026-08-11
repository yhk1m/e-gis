// © 2026 김용현
/**
 * publicDataTab - 데이터 불러오기 다이얼로그의 '공공데이터' 탭 내용.
 *
 * BuiltinDataDialog는 이미 1,000줄이 넘어 탭 자리만 내주고, 내용은 여기서 만든다.
 *
 * 목록·데이터는 모두 /api/pubdata(중계 함수)에서 받는다. 서비스키는 서버에만 있고
 * 엔드포인트·좌표 필드 매핑도 서버 사정이라, 이 파일은 그것들을 알지 못한다.
 *
 * 화면 흐름: 목록 → 항목 선택(선택지 입력) → 불러오기 → 미리보기 → 레이어 추가
 */

import { renderParamForm, collectParams, renderPreview, addPointLayer } from './publicDataLoad.js';

/** 목록은 자주 바뀌지 않는다. 다이얼로그를 여닫을 때마다 다시 부르지 않는다. */
let cachedItems = null;

/** 지금 보고 있는 항목과 불러온 결과 */
let state = { entry: null, result: null, fetchFn: null, onLayerAdded: null };

/** 목록 요청 세대 번호 — 늦게 도착한 응답이 새 화면을 덮지 않게 한다 */
let mountSeq = 0;

/** 안내/오류 문구 한 줄 */
export function renderNotice(message) {
  return `<div class="public-data-notice">${message}</div>`;
}

/** 카탈로그 목록 → 고를 수 있는 버튼들 */
export function renderCatalogList(items) {
  if (!items || items.length === 0) {
    return renderNotice('불러올 수 있는 공공데이터가 없습니다.');
  }

  const rows = items.map(item => `
    <button class="public-data-item" data-pubdata-id="${item.id}">
      <span class="public-data-item-name">${item.name}</span>
      <span class="public-data-item-desc">${item.description || ''}</span>
    </button>
  `).join('');

  return `<div class="public-data-list">${rows}</div>`;
}

/** 항목 상세 — 선택지와 불러오기 버튼 */
function renderDetail(entry) {
  return `
    <div class="public-data-detail">
      <div class="public-data-detail-head">
        <button class="public-data-back" data-pubdata-back>← 목록</button>
        <span class="public-data-item-name">${entry.name}</span>
      </div>
      <div class="public-data-form" data-pubdata-form>${renderParamForm(entry)}</div>
      <button class="btn btn-primary public-data-load" data-pubdata-load>불러오기</button>
      <div data-pubdata-result></div>
    </div>
  `;
}

/** 미리보기 아래에 붙는 레이어 만들기 버튼 */
function renderActions() {
  return `
    <div class="public-data-actions">
      <button class="btn btn-primary" data-pubdata-add="point">포인트로 추가</button>
    </div>
  `;
}

export const publicDataTab = {
  /** 탭이 처음 열리기 전까지 보여줄 자리 */
  render() {
    return `<div class="public-data-tab" data-public-data-root>${renderNotice('불러오는 중…')}</div>`;
  },

  /**
   * 탭이 열릴 때 목록을 채운다.
   * @param {HTMLElement} root 탭 콘텐츠 요소
   * @param {Object} [options]
   * @param {Function} [options.fetchFn] 테스트에서 주입
   * @param {Function} [options.onLayerAdded] 레이어를 만든 뒤 호출 (다이얼로그 닫기)
   */
  async mount(root, options = {}) {
    if (!root) return;

    state.fetchFn = options.fetchFn || ((url) => fetch(url));
    state.onLayerAdded = options.onLayerAdded || null;
    state.entry = null;      // 탭을 다시 열면 목록부터 본다
    state.result = null;
    this._bind(root);

    if (cachedItems) {
      root.innerHTML = renderCatalogList(cachedItems);
      return;
    }

    root.innerHTML = renderNotice('목록을 불러오는 중…');

    // 서버 첫 호출은 느릴 수 있다. 그 사이 학생이 항목을 열어 놨는데 뒤늦게
    // 도착한 목록이 화면을 덮으면 방금 고른 게 사라진다.
    const mountId = ++mountSeq;
    const stale = () => mountId !== mountSeq || state.entry !== null;

    try {
      const response = await state.fetchFn('/api/pubdata?list=1');
      const body = await response.json();

      if (!response.ok) {
        if (!stale()) root.innerHTML = renderNotice(body && body.error ? body.error : '목록을 불러오지 못했습니다.');
        return;
      }

      cachedItems = (body && body.items) || [];
      if (!stale()) root.innerHTML = renderCatalogList(cachedItems);
    } catch (e) {
      // 로컬에서 `vite dev`만 띄우면 /api가 없어 여기로 온다
      if (!stale()) root.innerHTML = renderNotice('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  },

  /** 항목 상세 화면을 연다 (목록 클릭과 테스트가 함께 쓴다) */
  _openEntry(root, entry) {
    if (!entry) return;
    state.entry = entry;
    state.result = null;
    root.innerHTML = renderDetail(entry);
  },

  /** 클릭 처리는 위임으로 한 번만 건다 */
  _bind(root) {
    if (root._pubdataBound) return;
    root._pubdataBound = true;

    root.addEventListener('click', (event) => {
      const item = event.target.closest('[data-pubdata-id]');
      if (item) {
        const entry = (cachedItems || []).find(e => e.id === item.dataset.pubdataId);
        if (entry) this._openEntry(root, entry);
        return;
      }

      if (event.target.closest('[data-pubdata-back]')) {
        state.entry = null;
        state.result = null;
        root.innerHTML = renderCatalogList(cachedItems);
        return;
      }

      if (event.target.closest('[data-pubdata-load]')) {
        this._load(root);
        return;
      }

      const addBtn = event.target.closest('[data-pubdata-add]');
      if (addBtn) this._add(root, addBtn.dataset.pubdataAdd);
    });
  },

  /** 선택지를 붙여 데이터를 받아온다 */
  async _load(root) {
    const entry = state.entry;
    if (!entry) return;

    const resultEl = root.querySelector('[data-pubdata-result]');
    const formEl = root.querySelector('[data-pubdata-form]');
    if (!resultEl) return;

    resultEl.innerHTML = renderNotice('불러오는 중…');

    const params = collectParams(formEl || root, entry);
    const search = new URLSearchParams({ id: entry.id, ...params });

    try {
      const response = await state.fetchFn(`/api/pubdata?${search.toString()}`);
      const body = await response.json();

      if (!response.ok) {
        state.result = null;
        resultEl.innerHTML = renderNotice(body && body.error ? body.error : '데이터를 불러오지 못했습니다.');
        return;
      }

      state.result = body;
      resultEl.innerHTML = renderPreview(body, entry) + (body.count > 0 ? renderActions() : '');
    } catch (e) {
      state.result = null;
      resultEl.innerHTML = renderNotice('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  },

  /** 미리보기의 결과를 레이어로 만든다 */
  _add(root, kind) {
    const { entry, result } = state;
    if (!entry || !result) return;

    const resultEl = root.querySelector('[data-pubdata-result]');
    try {
      if (kind === 'point') {
        addPointLayer(this._layerName(entry), result);
      }
      if (state.onLayerAdded) state.onLayerAdded();
    } catch (e) {
      if (resultEl) resultEl.innerHTML = renderNotice(e.message || '레이어를 만들지 못했습니다.');
    }
  },

  /** 무엇을 어디에서 받은 자료인지 이름에 남긴다 */
  _layerName(entry) {
    const params = state.result && state.result.usedLabel ? ` (${state.result.usedLabel})` : '';
    return `${entry.name}${params}`;
  },

  /** 테스트·개발용 — 받아둔 목록을 지운다 */
  _resetCache() {
    cachedItems = null;
    mountSeq = 0;
    state = { entry: null, result: null, fetchFn: null, onLayerAdded: null };
  }
};
