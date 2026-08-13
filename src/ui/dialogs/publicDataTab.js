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

import {
  renderParamForm, collectParams, renderPreview,
  addPointLayer, addGridLayer, addHeatmapLayer, numericFields
} from './publicDataLoad.js';

/** 목록은 자주 바뀌지 않는다. 다이얼로그를 여닫을 때마다 다시 부르지 않는다. */
let cachedItems = null;

/** 지금 보고 있는 항목과 불러온 결과 */
let state = { entry: null, result: null, fetchFn: null, onLayerAdded: null, keyword: '', region: '전체' };

/** 목록 요청 세대 번호 — 늦게 도착한 응답이 새 화면을 덮지 않게 한다 */
let mountSeq = 0;

/** 안내/오류 문구 한 줄 */
export function renderNotice(message) {
  return `<div class="public-data-notice">${message}</div>`;
}

/** 항목 하나 */
function renderItem(item) {
  return `
    <button class="public-data-item" data-pubdata-id="${item.id}">
      <span class="public-data-item-name">${item.name}</span>
      <span class="public-data-item-desc">${item.description || ''}</span>
    </button>
  `;
}

/**
 * 카탈로그 목록.
 *
 * 350종이 넘어 그냥 늘어놓으면 못 찾는다.
 *  - 평소에는 갈래별로 접어 둔다 (기본 데이터 탭의 분류와 같은 모양)
 *  - 검색 중에는 갈래를 접지 않고 걸린 것만 죽 보여준다
 */
export function renderCatalogList(items, keyword = '') {
  if (!items || items.length === 0) {
    return renderNotice('불러올 수 있는 공공데이터가 없습니다.');
  }

  const q = String(keyword || '').trim().toLowerCase();

  if (q) {
    const shown = items.filter(item =>
      `${item.name} ${item.description || ''}`.toLowerCase().includes(q));
    if (shown.length === 0) return renderNotice(`'${keyword}'에 해당하는 데이터가 없습니다.`);
    return `<div class="public-data-list">${shown.map(renderItem).join('')}</div>`;
  }

  // 갈래별로 묶는다. 순서는 서버가 준 순서를 따르고, 갈래가 없으면 기타로 보낸다.
  const groups = new Map();
  for (const item of items) {
    const key = item.category || '기타';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const etc = groups.get('기타');
  if (etc) { groups.delete('기타'); groups.set('기타', etc); }

  return [...groups].map(([name, list]) => `
    <div class="builtin-category" data-pubdata-group="${name}">
      <div class="builtin-category-header" data-pubdata-cat="${name}">
        <span>${name}</span>
        <span class="builtin-badge" style="margin-left:auto; margin-right:8px;">${list.length}개</span>
        <svg class="builtin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="builtin-category-body">
        <div class="public-data-list">${list.map(renderItem).join('')}</div>
      </div>
    </div>
  `).join('');
}

/** 지역 단추 — 서울·경기가 섞이므로 갈라 볼 수 있게 한다 */
function renderRegionChips(items, region) {
  const regions = [...new Set(items.map(item => item.region).filter(Boolean))];
  if (regions.length < 2) return '';

  const chip = (name, count) => `
    <button class="public-data-chip${region === name ? ' active' : ''}"
            data-pubdata-region="${name}">${name} ${count}</button>`;

  return `<div class="public-data-regions">
      ${chip('전체', items.length)}
      ${regions.map(r => chip(r, items.filter(i => i.region === r).length)).join('')}
    </div>`;
}

/** 검색창 + 결과 수 */
function renderSearchBox(items, keyword = '') {
  return `
    <div class="public-data-searchbar">
      <input type="text" class="public-data-search" data-pubdata-search
             placeholder="데이터 검색 (예: 도서관, 주차장, 음식점)" value="${keyword}">
      <span class="public-data-count">${items.length}종</span>
    </div>
  `;
}

/** 고른 지역만 남긴다 */
function byRegion(items, region) {
  return !region || region === '전체' ? items : items.filter(item => item.region === region);
}

/** 지역 단추 + 검색창 + 목록 */
function renderBrowse(items, keyword = '', region = '전체') {
  const shown = byRegion(items, region);
  return renderRegionChips(items, region) +
    renderSearchBox(shown, keyword) +
    `<div data-pubdata-listbox>${renderCatalogList(shown, keyword)}</div>`;
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
      <button class="btn btn-secondary" data-pubdata-add="grid">격자 집계</button>
      <button class="btn btn-secondary" data-pubdata-add="heatmap">히트맵</button>
    </div>
    <div data-pubdata-grid-options></div>
  `;
}

/** 격자 집계 옵션 — 칸 크기와 집계 방식 */
function renderGridOptions(result) {
  const fields = numericFields(result);
  const fieldOptions = fields.map(f => `<option value="${f}">${f}</option>`).join('');

  return `
    <div class="public-data-grid-options">
      <label class="public-data-field">
        <span>격자 크기</span>
        <select class="public-data-param" data-grid="cellSize">
          <option value="500">500m</option>
          <option value="1000" selected>1km</option>
          <option value="5000">5km</option>
          <option value="10000">10km</option>
        </select>
      </label>
      <label class="public-data-field">
        <span>집계</span>
        <select class="public-data-param" data-grid="method">
          <option value="count">개수</option>
          ${fields.length ? '<option value="sum">합계</option><option value="avg">평균</option>' : ''}
        </select>
      </label>
      ${fields.length ? `
      <label class="public-data-field" data-grid-field-row style="display:none;">
        <span>대상 값</span>
        <select class="public-data-param" data-grid="field">${fieldOptions}</select>
      </label>` : ''}
      <button class="btn btn-primary" data-pubdata-grid-create>격자 만들기</button>
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
      root.innerHTML = renderBrowse(cachedItems, state.keyword, state.region);
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
      if (!stale()) root.innerHTML = renderBrowse(cachedItems, state.keyword, state.region);
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

    root.addEventListener('input', (event) => {
      const box = event.target.closest('[data-pubdata-search]');
      if (!box) return;
      state.keyword = box.value;
      const listBox = root.querySelector('[data-pubdata-listbox]');
      if (listBox) listBox.innerHTML = renderCatalogList(byRegion(cachedItems, state.region), state.keyword);
    });

    root.addEventListener('click', (event) => {
      const item = event.target.closest('[data-pubdata-id]');
      if (item) {
        const entry = (cachedItems || []).find(e => e.id === item.dataset.pubdataId);
        if (entry) this._openEntry(root, entry);
        return;
      }

      const chip = event.target.closest('[data-pubdata-region]');
      if (chip) {
        state.region = chip.dataset.pubdataRegion;
        root.innerHTML = renderBrowse(cachedItems, state.keyword, state.region);
        return;
      }

      const catHead = event.target.closest('[data-pubdata-cat]');
      if (catHead) {
        catHead.parentElement.classList.toggle('open');
        return;
      }

      if (event.target.closest('[data-pubdata-back]')) {
        state.entry = null;
        state.result = null;
        root.innerHTML = renderBrowse(cachedItems, state.keyword, state.region);
        return;
      }

      if (event.target.closest('[data-pubdata-load]')) {
        this._load(root);
        return;
      }

      if (event.target.closest('[data-pubdata-grid-create]')) {
        this._createGrid(root);
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

    // 격자는 칸 크기·집계 방식을 먼저 고른다
    if (kind === 'grid') {
      const box = root.querySelector('[data-pubdata-grid-options]');
      if (box) {
        box.innerHTML = box.innerHTML.trim() ? '' : renderGridOptions(result);
        this._bindGridMethod(box);
      }
      return;
    }

    try {
      if (kind === 'point') addPointLayer(this._layerName(entry), result);
      if (kind === 'heatmap') addHeatmapLayer(this._layerName(entry), result);
      if (state.onLayerAdded) state.onLayerAdded();
    } catch (e) {
      this._showError(root, e);
    }
  },

  /** 합계·평균을 고르면 대상 값 선택칸을 보여준다 */
  _bindGridMethod(box) {
    const method = box.querySelector('[data-grid="method"]');
    const fieldRow = box.querySelector('[data-grid-field-row]');
    if (!method || !fieldRow) return;

    method.addEventListener('change', () => {
      fieldRow.style.display = method.value === 'count' ? 'none' : '';
    });
  },

  /** 고른 옵션으로 격자 레이어를 만든다 */
  _createGrid(root) {
    const { entry, result } = state;
    if (!entry || !result) return;

    const box = root.querySelector('[data-pubdata-grid-options]');
    const read = (key) => {
      const el = box && box.querySelector(`[data-grid="${key}"]`);
      return el ? el.value : null;
    };

    const cellSize = Number(read('cellSize')) || 1000;
    const method = read('method') || 'count';
    const field = read('field');
    const sizeLabel = cellSize >= 1000 ? `${cellSize / 1000}km` : `${cellSize}m`;

    try {
      addGridLayer(`${entry.name} 격자 ${sizeLabel}`, result, { cellSize, method, field });
      if (state.onLayerAdded) state.onLayerAdded();
    } catch (e) {
      this._showError(root, e);
    }
  },

  /** 실패 이유를 미리보기 자리에 그대로 보여준다 */
  _showError(root, error) {
    const resultEl = root.querySelector('[data-pubdata-result]');
    if (resultEl) resultEl.innerHTML = renderNotice(error.message || '레이어를 만들지 못했습니다.');
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
    state = { entry: null, result: null, fetchFn: null, onLayerAdded: null, keyword: '', region: '전체' };
  }
};
