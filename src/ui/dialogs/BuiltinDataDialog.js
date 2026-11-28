// © 2026 김용현
/**
 * BuiltinDataDialog - 데이터 불러오기 다이얼로그
 * 탭 구성:
 *  - 실습 데이터: practice_catalog.json 의 그룹 순서대로 섹션을 놓는다
 *      Point(점) / Line(선) / Area(면, 행정경계 폴더) / Raster(래스터, raster_catalog.json) / Flow(흐름) / Attribute(속성정보)
 *      spatial→레이어, coordinate→좌표 가져오기, attribute→미리보기→테이블 결합, raster→다중선택 일괄 로드, flow→흐름도 패널
 *  - 공공데이터: 공공데이터포털 검색 → 레이어
 *  - 스프레드시트: 공개 구글 시트 링크 → 속성 데이터(테이블 결합) 또는 좌표 데이터(포인트 레이어)
 */

import { builtinDataManager } from '../../core/BuiltinDataManager.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';
import { tableJoinTool } from '../../tools/TableJoinTool.js';
import { tableLoader } from '../../loaders/TableLoader.js';
import { googleSheetLoader } from '../../loaders/GoogleSheetLoader.js';
import { publicDataTab } from './publicDataTab.js';
import { flowPanel } from '../panels/FlowPanel.js';

const TAB_FOOTER_TEXT = {
  basic: '점, 선, 면, 흐름, 속성 자료는 눌러서 바로, 래스터는 여러 개 골라 한꺼번에 불러와요',
  public: '공공데이터포털의 자료를 지금 받아서 불러와요',
  sheets: '공개된 구글 스프레드시트 링크로 속성 자료나 좌표 자료를 가져와요'
};

/** 선 SVG 아이콘 (당토 디자인: 이모지 대신 굵기 1.75, 끝 둥글게) */
const svg = (d, size = 16) => `<svg class="bd-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  folderOpen: '<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  line: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M6.5 16.5 10 11l4 2 3.5-5.5"/>',
  area: '<path d="M4 7 11 3l9 5-2 11-11 2z"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  flow: '<path d="M4 17c4-8 12-8 16 0"/><path d="m16 13 4 4-4 4"/>',
  table: '<path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/>',
  map: '<path d="M14.1 6.3 9.9 4.2a2 2 0 0 0-1.8 0L3.6 6.4A1 1 0 0 0 3 7.3v12.1a1 1 0 0 0 1.4.9l3.7-1.9a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.2a1 1 0 0 0 .6-.9V5.3a1 1 0 0 0-1.4-.9l-3.7 1.9a2 2 0 0 1-1.8 0z"/><path d="M15 6v15M9 3v15"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
/** 실습 그룹 id → 아이콘 (카탈로그의 이모지는 쓰지 않는다) */
const GROUP_ICON = {
  'point-data': 'pin', 'line-data': 'line', 'area-data': 'area',
  'raster-data': 'mountain', 'flow-data': 'flow', 'attribute-data': 'table'
};
const groupIcon = (g) => svg(ICON[GROUP_ICON[g.id] || (g.type === 'raster' ? 'mountain' : 'folder')]);
/** 성공과 실패 한 줄 (기호 대신 아이콘) */
const okLine = (text) => `<span class="bd-result ok">${svg(ICON.check, 14)}${text}</span>`;
const errLine = (text) => `<span class="bd-result err">${svg(ICON.x, 14)}${text}</span>`;

const PRACTICE_TYPE_META = {
  spatial: { icon: 'map', label: '공간' },
  attribute: { icon: 'table', label: '속성' },
  coordinate: { icon: 'pin', label: '좌표' },
  raster: { icon: 'mountain', label: '래스터' },
  flow: { icon: 'flow', label: '흐름' }
};

class BuiltinDataDialog {
  constructor() {
    this.overlay = null;
    this.loadingId = null;
    this._activeTab = 'basic';
    // 속성정보 미리보기 상태
    this._attrData = null;
    this._attrHeaders = null;
    this._attrDataset = null;
    // 래스터 다중선택 상태
    this._selectedRasterIds = new Set();
    // 스프레드시트 입력 상태 (미리보기에서 돌아올 때 복원)
    this._lastSheetUrl = '';
    this._lastSheetType = 'attribute';
  }

  /**
   * 다이얼로그 표시
   */
  /**
   * 창 열기
   * @param {'basic'|'public'|'sheets'} [tab='basic'] 처음 보일 탭
   *   — Geocoding 안내창이 'sheets'로 연다
   */
  async show(tab = 'basic') {
    this.close();
    await builtinDataManager.loadCatalogs();
    // close()가 _activeTab을 'basic'으로 되돌리므로 그 뒤에 정한다
    this._activeTab = tab;
    this._renderMain();
  }

  // ============================
  //  메인 화면 (탭 구조)
  // ============================
  _renderMain() {
    const html = `
      <div class="modal-overlay active" id="builtin-data-overlay">
        <div class="modal" style="width: 540px; max-height: 82vh;">
          <div class="modal-header">
            <h3 class="bd-title">${svg(ICON.folderOpen, 18)}데이터 불러오기</h3>
            <button class="modal-close" id="builtin-data-close">&times;</button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <!-- 탭 -->
            <div class="builtin-tabs">
              <button class="builtin-tab" data-tab="basic">${svg(ICON.book)}실습 데이터</button>
              <button class="builtin-tab" data-tab="public">${svg(ICON.globe)}공공데이터</button>
              <button class="builtin-tab" data-tab="sheets">${svg(ICON.sheet)}스프레드시트</button>
            </div>
            <div class="builtin-tab-content" data-tab-content="basic">
              ${this._renderBasicTab()}
            </div>
            <div class="builtin-tab-content" data-tab-content="public" style="display:none;">
              ${publicDataTab.render()}
            </div>
            <div class="builtin-tab-content" data-tab-content="sheets" style="display:none;">
              ${this._renderSheetsTab()}
            </div>
          </div>
          <div class="modal-footer bd-footer">
            <span id="builtin-footer-text"></span>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.overlay = document.getElementById('builtin-data-overlay');
    this._bindMainEvents();
    this._switchTab(this._activeTab);
  }

  _switchTab(tab) {
    this._activeTab = tab;
    this.overlay.querySelectorAll('.builtin-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    this.overlay.querySelectorAll('.builtin-tab-content').forEach(el => {
      el.style.display = el.dataset.tabContent === tab ? '' : 'none';
    });
    const footerEl = this.overlay.querySelector('#builtin-footer-text');
    if (footerEl) footerEl.textContent = TAB_FOOTER_TEXT[tab] || '';

    // 공공데이터 목록은 서버에서 받아온다 — 탭을 처음 열 때만 부른다
    if (tab === 'public') {
      const root = this.overlay.querySelector('[data-public-data-root]');
      publicDataTab.mount(root, { onLayerAdded: () => this.close() });
    }
  }

  // ============================
  //  탭 1: 실습 데이터
  // ============================
  _renderBasicTab() {
    const groups = builtinDataManager.getPracticeCatalog();
    const rasterList = builtinDataManager.getRasterCatalog();

    if (!groups || groups.length === 0) {
      return `
        <div style="padding: 36px 24px; text-align: center; color: var(--text-muted); font-size: 12px; line-height: 1.9;">
          <div class="bd-empty-icon">${svg(ICON.folder, 32)}</div>
          아직 등록된 실습 데이터가 없습니다.<br>
          <code>public/data/builtin/practice_catalog.json</code>에<br>
          데이터 형태별 그룹과 데이터셋을 추가하면 여기에 표시됩니다.
        </div>
      `;
    }

    return `
      <!-- 검색 -->
      <div class="bd-search-row">
        <input type="search" id="builtin-data-search" class="bd-search" placeholder="자료 이름으로 찾기" aria-label="실습 데이터 찾기">
      </div>
      <!-- 데이터 목록 -->
      <div id="builtin-data-list" style="overflow-y: auto; max-height: calc(82vh - 210px);">
        ${groups.map(g => g.type === 'raster'
          ? this._renderRasterSection(rasterList, g)
          : this._renderPracticeSection(g)
        ).join('')}
      </div>
    `;
  }

  /** 섹션 헤더 (아코디언) — 실습 그룹과 래스터 그룹이 같은 모양을 쓴다 */
  _renderSectionHeader(group, count) {
    return `
      <div class="builtin-category-header" data-toggle="${group.id}">
        <span class="bd-group-name">${groupIcon(group)}${group.name}</span>
        <span class="builtin-badge" style="margin-left:auto; margin-right:8px;">${count}개</span>
        <svg class="builtin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    `;
  }

  /**
   * 실습 데이터 섹션 (점/선/면/속성)
   * 데이터셋의 folder 가 같은 것끼리 접이식 폴더로 묶고(예: 행정경계), 폴더가 없는 것은 그 아래에 그대로 놓는다
   */
  _renderPracticeSection(g) {
    const datasets = g.datasets || [];
    const folders = new Map();
    const loose = [];
    for (const d of datasets) {
      if (!d.folder) { loose.push(d); continue; }
      if (!folders.has(d.folder)) folders.set(d.folder, []);
      folders.get(d.folder).push(d);
    }

    const folderHTML = [...folders].map(([name, items]) => `
      <div class="builtin-folder" data-group="${name}">
        <div class="builtin-folder-header">
          <button type="button" class="builtin-folder-name" data-toggle-group="${name}">
            <svg class="builtin-folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            ${svg(ICON.folder, 14)}${name}
            <span class="builtin-badge">${items.length}</span>
          </button>
        </div>
        <div class="builtin-folder-body">
          ${items.map(d => this._renderPracticeCard(g, d)).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div class="builtin-category" data-category="${g.id}">
        ${this._renderSectionHeader(g, datasets.length)}
        <div class="builtin-category-body">
          ${g.description ? `<div class="bd-group-desc">${g.description}</div>` : ''}
          ${datasets.length === 0 ? '<div style="padding: 14px 16px; font-size: 12px; color: var(--text-muted); text-align: center;">아직 등록된 데이터가 없습니다.</div>' : ''}
          ${folderHTML}
          ${loose.map(d => this._renderPracticeCard(g, d)).join('')}
        </div>
      </div>
    `;
  }

  _renderPracticeCard(g, d) {
    const meta = PRACTICE_TYPE_META[d.type] || { icon: 'file', label: d.type };
    return `
      <div class="builtin-dataset-card" data-practice-type="${g.id}" data-id="${d.id}">
        <div class="builtin-dataset-main">
          <div class="builtin-dataset-name">${svg(ICON[meta.icon] || ICON.file)}${d.name}</div>
          <div class="builtin-dataset-desc">${d.description || ''}</div>
        </div>
        <div class="builtin-dataset-meta">
          <span class="builtin-badge">${meta.label}</span>
          ${d.source ? `<span class="builtin-badge">${d.source}</span>` : ''}
        </div>
        <div class="builtin-dataset-loading" style="display:none;">
          <span class="builtin-spinner"></span> 불러오는 중...
        </div>
      </div>
    `;
  }

  _renderRasterSection(list, group) {
    const groups = builtinDataManager.getRasterCatalogGrouped();
    const totalCount = list.length;

    const emptyMsg = totalCount === 0
      ? '<div style="padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;">GeoTIFF 파일이 없습니다.<br><code>public/data/builtin/raster/</code>에 .tif 파일을 넣고<br><code>npm run catalog</code> 실행하세요.</div>'
      : '';

    const groupsHTML = groups.map(g => `
      <div class="builtin-folder" data-group="${g.name}">
        <div class="builtin-folder-header">
          <input type="checkbox" class="builtin-folder-all" data-group="${g.name}" aria-label="${g.name} 전체 선택">
          <button type="button" class="builtin-folder-name" data-toggle-group="${g.name}">
            <svg class="builtin-folder-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            ${svg(ICON.folder, 14)}${g.name}
            <span class="builtin-badge">${g.items.length}</span>
          </button>
        </div>
        <div class="builtin-folder-body">
          ${g.items.map(d => `
            <label class="raster-card" data-id="${d.id}" data-group="${g.name}">
              <input type="checkbox" class="raster-item-check" data-id="${d.id}" data-group="${g.name}">
              <div class="raster-card-content">
                <div class="raster-card-name">${builtinDataManager.stripProvincePrefix(d.name)}</div>
                <div class="raster-card-desc">${d.description}</div>
              </div>
              <div class="raster-card-loading" style="display:none;">
                <span class="builtin-spinner"></span>
              </div>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div class="builtin-category" data-category="raster">
        ${this._renderSectionHeader(group, totalCount)}
        <div class="builtin-category-body">
          ${group.description ? `<div class="bd-group-desc">${group.description}</div>` : ''}
          ${emptyMsg}
          ${totalCount > 0 ? `
            <div class="raster-toolbar">
              <button type="button" class="btn btn-primary btn-sm" id="raster-load-selected" disabled>
                선택 0개 불러오기
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="raster-clear-selection" disabled>
                선택 해제
              </button>
            </div>
            ${groupsHTML}
          ` : ''}
        </div>
      </div>
    `;
  }

  // ============================
  //  탭 2: 스프레드시트
  // ============================
  _renderSheetsTab() {
    return `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: calc(82vh - 170px);">
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.7;">
          구글 스프레드시트의 <b>공유 링크</b>를 붙여 넣으면 자료를 가져와요.
          <ul class="bd-rules">
            <li>시트를 <b>「링크가 있는 모든 사용자」</b>에게 공개해 주세요.</li>
            <li>첫 줄에는 열 이름(머리글)을 적어 주세요.</li>
          </ul>
        </div>

        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; color: var(--text-primary);">스프레드시트 링크</label>
          <input type="text" id="sheet-url-input" placeholder="https://docs.google.com/spreadsheets/d/..."
            value="${this._lastSheetUrl.replace(/"/g, '&quot;')}"
            style="width: 100%; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-primary); font-size: 12px;">
        </div>

        <div>
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">데이터 유형</div>
          <label class="sheet-type-option">
            <input type="radio" name="sheet-data-type" value="attribute" ${this._lastSheetType === 'attribute' ? 'checked' : ''}>
            <div>
              <div class="sheet-type-name">${svg(ICON.table)}속성 데이터</div>
              <div class="sheet-type-desc">지역 이름이나 코드 같은 열로 지금 있는 레이어에 붙여요(테이블 결합)</div>
            </div>
          </label>
          <label class="sheet-type-option">
            <input type="radio" name="sheet-data-type" value="coordinate" ${this._lastSheetType === 'coordinate' ? 'checked' : ''}>
            <div>
              <div class="sheet-type-name">${svg(ICON.pin)}좌표 데이터</div>
              <div class="sheet-type-desc">위도와 경도 열로 점 레이어를 만들어요</div>
            </div>
          </label>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <div id="sheet-load-status" style="flex: 1; font-size: 12px; min-height: 18px; white-space: pre-line; display: flex; align-items: center; gap: 8px;"></div>
          <button type="button" class="btn btn-primary" id="sheet-load-btn" style="flex-shrink: 0; padding: 9px 24px; font-size: 13px;">시트 불러오기</button>
        </div>
      </div>
    `;
  }

  async _loadSheet() {
    const urlInput = document.getElementById('sheet-url-input');
    const statusEl = document.getElementById('sheet-load-status');
    const loadBtn = document.getElementById('sheet-load-btn');
    const typeRadio = this.overlay.querySelector('input[name="sheet-data-type"]:checked');
    const url = urlInput.value.trim();
    const dataType = typeRadio ? typeRadio.value : 'attribute';

    this._lastSheetUrl = url;
    this._lastSheetType = dataType;

    if (!url) {
      statusEl.innerHTML = errLine('스프레드시트 링크를 붙여 넣어 주세요.');
      return;
    }

    loadBtn.disabled = true;
    statusEl.innerHTML = '<span class="builtin-spinner"></span> 시트를 불러오는 중...';

    try {
      const { headers, data } = await googleSheetLoader.load(url);

      if (dataType === 'attribute') {
        this._attrData = data;
        this._attrHeaders = headers;
        this._attrDataset = { source: 'Google 스프레드시트' };
        this._showAttributePreview({
          headers,
          data,
          fileName: '구글 스프레드시트',
          dataset: this._attrDataset
        });
      } else {
        this._showCoordinateImport({ headers, data });
      }
    } catch (error) {
      statusEl.innerHTML = errLine(error.message);
      loadBtn.disabled = false;
    }
  }

  // ============================
  //  스프레드시트 → 좌표 데이터 (포인트 레이어)
  // ============================
  _showCoordinateImport({ headers, data, fileName, latColumn, lonColumn, sourceLabel } = {}) {
    // tableLoader를 그대로 재사용 (좌표 자동감지·포인트 레이어 생성 로직 공유)
    const displayName = fileName || '스프레드시트 좌표';
    const source = sourceLabel || 'Google 스프레드시트';
    tableLoader.data = data;
    tableLoader.headers = headers;
    tableLoader.fileName = displayName;

    const numericCols = tableLoader.getNumericColumns();
    const auto = tableLoader.detectCoordinateColumns();
    // 카탈로그가 지정한 위경도 컬럼을 우선 사용, 없으면 자동 감지
    const detected = {
      latColumn: latColumn || auto.latColumn,
      lonColumn: lonColumn || auto.lonColumn
    };
    const previewRows = data.slice(0, 5);

    const colOptions = (selected) => {
      let opts = '<option value="">컬럼 선택</option>';
      if (numericCols.length > 0) {
        opts += '<optgroup label="숫자형 컬럼">';
        numericCols.forEach(c => {
          opts += `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`;
        });
        opts += '</optgroup>';
      }
      opts += '<optgroup label="모든 컬럼">';
      headers.forEach(c => {
        if (!numericCols.includes(c)) opts += `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`;
      });
      opts += '</optgroup>';
      return opts;
    };

    const selectStyle = 'flex:1; padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-primary);';

    const modal = this.overlay.querySelector('.modal');
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="bd-title">${svg(ICON.pin, 18)}좌표 데이터 가져오기</h3>
        <button class="modal-close" id="builtin-coord-close">&times;</button>
      </div>
      <div class="modal-body" style="padding: 12px 16px; overflow-y: auto;">
        <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-secondary);">
          ${data.length}행, ${headers.length}열. 출처: ${source}
        </div>

        <!-- 미리보기 테이블 -->
        <div style="overflow-x: auto; margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <table class="builtin-preview-table">
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${previewRows.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}
              ${data.length > 5 ? `<tr><td colspan="${headers.length}" style="text-align:center; color:var(--text-muted);">... 외 ${data.length - 5}행</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- 포인트 레이어 설정 -->
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; background: var(--bg-surface, var(--bg-panel));">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">포인트 레이어 설정</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="font-size: 12px; white-space: nowrap; min-width: 80px;">위도(Y) 컬럼</label>
              <select id="builtin-coord-lat" style="${selectStyle}">${colOptions(detected.latColumn)}</select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="font-size: 12px; white-space: nowrap; min-width: 80px;">경도(X) 컬럼</label>
              <select id="builtin-coord-lon" style="${selectStyle}">${colOptions(detected.lonColumn)}</select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="font-size: 12px; white-space: nowrap; min-width: 80px;">레이어 이름</label>
              <input type="text" id="builtin-coord-name" value="${displayName.replace(/"/g, '&quot;')}" style="${selectStyle}">
            </div>
            <div id="builtin-coord-preview" style="font-size: 12px; color: var(--text-muted); min-height: 18px;"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm bd-back" id="builtin-coord-back">${svg(ICON.back, 14)}목록으로</button>
        <button class="btn btn-primary btn-sm" id="builtin-coord-create" disabled>레이어 생성</button>
      </div>
    `;

    document.getElementById('builtin-coord-close').addEventListener('click', () => this.close());
    document.getElementById('builtin-coord-back').addEventListener('click', () => {
      tableLoader.clear();
      this.overlay.remove();
      this.overlay = null;
      this._renderMain();
    });
    document.getElementById('builtin-coord-lat').addEventListener('change', () => this._updateCoordPreview());
    document.getElementById('builtin-coord-lon').addEventListener('change', () => this._updateCoordPreview());
    document.getElementById('builtin-coord-create').addEventListener('click', () => this._createCoordLayer());

    this._updateCoordPreview();
  }

  _updateCoordPreview() {
    const latCol = document.getElementById('builtin-coord-lat').value;
    const lonCol = document.getElementById('builtin-coord-lon').value;
    const createBtn = document.getElementById('builtin-coord-create');
    const previewEl = document.getElementById('builtin-coord-preview');

    if (!latCol || !lonCol || !tableLoader.data) {
      previewEl.textContent = '위도와 경도 컬럼을 선택하세요.';
      createBtn.disabled = true;
      return;
    }

    let validCount = 0;
    let invalidCount = 0;
    for (const row of tableLoader.data) {
      const lat = parseFloat(row[latCol]);
      const lon = parseFloat(row[lonCol]);
      if (!isNaN(lat) && !isNaN(lon) &&
          lat >= -90 && lat <= 90 &&
          lon >= -180 && lon <= 180) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    previewEl.innerHTML = `쓸 수 있는 좌표 <b>${validCount}</b>개, 잘못된 좌표 <b>${invalidCount}</b>개`;
    createBtn.disabled = validCount === 0;
  }

  _createCoordLayer() {
    const latCol = document.getElementById('builtin-coord-lat').value;
    const lonCol = document.getElementById('builtin-coord-lon').value;
    const layerName = document.getElementById('builtin-coord-name').value.trim();
    const previewEl = document.getElementById('builtin-coord-preview');

    try {
      const result = tableLoader.createPointLayer(latCol, lonCol, layerName || '스프레드시트 좌표');
      previewEl.innerHTML = okLine(`점 ${result.featureCount}개로 레이어를 만들었어요${result.skippedCount > 0 ? `. ${result.skippedCount}줄은 좌표가 없어 뺐어요` : ''}`);
      tableLoader.clear();
      setTimeout(() => this.close(), 1200);
    } catch (error) {
      previewEl.innerHTML = errLine(error.message);
    }
  }

  async _loadPracticeDataset(typeId, datasetId, cardEl) {
    this.loadingId = datasetId;
    const loadingEl = cardEl.querySelector('.builtin-dataset-loading');
    const mainEl = cardEl.querySelector('.builtin-dataset-main');
    const metaEl = cardEl.querySelector('.builtin-dataset-meta');
    loadingEl.style.display = 'flex';
    mainEl.style.opacity = '0.5';
    metaEl.style.display = 'none';

    try {
      const result = await builtinDataManager.loadPracticeDataset(typeId, datasetId);
      if (result.type === 'attribute') {
        this._attrData = result.data;
        this._attrHeaders = result.headers;
        this._attrDataset = result.dataset;
        this._showAttributePreview(result);
      } else if (result.type === 'coordinate') {
        // 위경도 데이터 → 좌표 가져오기 화면(포인트 레이어 생성)으로 전환
        this._showCoordinateImport({
          headers: result.headers,
          data: result.data,
          fileName: result.fileName,
          latColumn: result.dataset.latColumn,
          lonColumn: result.dataset.lonColumn,
          sourceLabel: result.dataset.source || result.fileName
        });
      } else if (result.type === 'flow') {
        // 흐름 데이터 → 흐름도 패널로 (위치 매칭·스타일은 거기서)
        this.close();
        flowPanel.showWithTable({
          headers: result.headers, data: result.data, fileName: result.fileName, dataset: result.dataset,
          practiceKey: `${typeId}|${datasetId}` // 패널의 실습 데이터 드롭다운이 고른 자료를 보여 주도록
        });
      } else {
        loadingEl.innerHTML = okLine('레이어를 추가했어요');
        setTimeout(() => this.close(), 600);
      }
    } catch (error) {
      loadingEl.innerHTML = errLine(error.message);
      mainEl.style.opacity = '1';
      metaEl.style.display = 'flex';
      setTimeout(() => {
        loadingEl.style.display = 'none';
        loadingEl.innerHTML = '<span class="builtin-spinner"></span> 불러오는 중...';
      }, 2000);
    } finally {
      this.loadingId = null;
    }
  }

  // ============================
  //  이벤트 바인딩
  // ============================
  _bindMainEvents() {
    document.getElementById('builtin-data-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    // 탭 전환
    this.overlay.querySelectorAll('.builtin-tab').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    const listEl = document.getElementById('builtin-data-list');

    // 카테고리 / 래스터 그룹 아코디언 + 카드 클릭
    listEl.addEventListener('click', (e) => {
      // 폴더 토글 (래스터 광역자치단체 폴더, 실습 데이터의 하위 폴더)
      const groupNameBtn = e.target.closest('.builtin-folder-name');
      if (groupNameBtn) {
        const grp = groupNameBtn.closest('.builtin-folder');
        grp.classList.toggle('open');
        return;
      }

      // 일괄 불러오기 버튼
      if (e.target.closest('#raster-load-selected')) {
        this._loadSelectedRasters();
        return;
      }
      if (e.target.closest('#raster-clear-selection')) {
        this._clearRasterSelection();
        return;
      }

      // 카테고리 아코디언 (단, 래스터 내부 클릭은 위에서 처리됨)
      const header = e.target.closest('.builtin-category-header');
      if (header) {
        const category = header.closest('.builtin-category');
        category.classList.toggle('open');
        return;
      }

      // 비-래스터 카드 단일 로드 (spatial / coordinate / attribute)
      const card = e.target.closest('.builtin-dataset-card');
      if (!card || this.loadingId) return;
      this._loadPracticeDataset(card.dataset.practiceType, card.dataset.id, card);
    });

    // 래스터 체크박스 변경 (이벤트 위임)
    listEl.addEventListener('change', (e) => {
      if (e.target.classList.contains('raster-item-check')) {
        this._toggleRasterItem(e.target.dataset.id, e.target.checked);
        this._syncGroupCheckbox(e.target.dataset.group);
        this._updateRasterBulkUI();
      } else if (e.target.classList.contains('builtin-folder-all')) {
        this._toggleRasterGroup(e.target.dataset.group, e.target.checked);
        this._updateRasterBulkUI();
      }
    });

    // 검색
    document.getElementById('builtin-data-search').addEventListener('input', (e) => {
      this._filterDatasets(e.target.value);
    });

    // 스프레드시트 탭
    const sheetLoadBtn = document.getElementById('sheet-load-btn');
    if (sheetLoadBtn) {
      sheetLoadBtn.addEventListener('click', () => this._loadSheet());
      document.getElementById('sheet-url-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._loadSheet();
      });
    }
  }

  // ============================
  //  래스터(GeoTIFF) 다중선택 + 일괄 로드
  // ============================

  _toggleRasterItem(id, checked) {
    if (checked) this._selectedRasterIds.add(id);
    else this._selectedRasterIds.delete(id);
  }

  _toggleRasterGroup(group, checked) {
    const items = this.overlay.querySelectorAll(`.raster-item-check[data-group="${group}"]`);
    items.forEach(cb => {
      cb.checked = checked;
      this._toggleRasterItem(cb.dataset.id, checked);
    });
  }

  /** 그룹 내 체크 상태를 보고 그룹 헤더 체크박스를 모두/일부/없음으로 동기화 */
  _syncGroupCheckbox(group) {
    const items = this.overlay.querySelectorAll(`.raster-item-check[data-group="${group}"]`);
    const checked = [...items].filter(cb => cb.checked).length;
    const groupCb = this.overlay.querySelector(`.builtin-folder-all[data-group="${group}"]`);
    if (!groupCb) return;
    if (checked === 0) {
      groupCb.checked = false;
      groupCb.indeterminate = false;
    } else if (checked === items.length) {
      groupCb.checked = true;
      groupCb.indeterminate = false;
    } else {
      groupCb.checked = false;
      groupCb.indeterminate = true;
    }
  }

  _updateRasterBulkUI() {
    const count = this._selectedRasterIds.size;
    const loadBtn = this.overlay.querySelector('#raster-load-selected');
    const clearBtn = this.overlay.querySelector('#raster-clear-selection');
    if (loadBtn) {
      loadBtn.textContent = `선택 ${count}개 불러오기`;
      loadBtn.disabled = count === 0 || this.loadingId !== null;
    }
    if (clearBtn) clearBtn.disabled = count === 0;
  }

  _clearRasterSelection() {
    this._selectedRasterIds.clear();
    this.overlay.querySelectorAll('.raster-item-check').forEach(cb => { cb.checked = false; });
    this.overlay.querySelectorAll('.builtin-folder-all').forEach(cb => {
      cb.checked = false;
      cb.indeterminate = false;
    });
    this._updateRasterBulkUI();
  }

  async _loadSelectedRasters() {
    if (this._selectedRasterIds.size === 0 || this.loadingId) return;
    const ids = [...this._selectedRasterIds];
    const loadBtn = this.overlay.querySelector('#raster-load-selected');
    const clearBtn = this.overlay.querySelector('#raster-clear-selection');
    this.loadingId = '__batch__';
    loadBtn.disabled = true;
    clearBtn.disabled = true;

    let success = 0, failed = 0;
    const extents = [];

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const cardEl = this.overlay.querySelector(`.raster-card[data-id="${id}"]`);
      const loadingEl = cardEl?.querySelector('.raster-card-loading');
      if (loadingEl) loadingEl.style.display = 'flex';
      loadBtn.textContent = `불러오는 중... ${i + 1}/${ids.length}`;

      try {
        // 일괄 로드 중에는 개별 fit 끄고 마지막에 통합 fit
        const layerId = await builtinDataManager.loadRaster(id, { fitExtent: false });
        success++;
        const info = layerManager.getLayer(layerId);
        if (info && info.demData) extents.push(info.demData.extent);
        if (loadingEl) loadingEl.innerHTML = `<span class="bd-result ok" aria-label="불러옴">${svg(ICON.check, 14)}</span>`;
      } catch (e) {
        failed++;
        if (loadingEl) loadingEl.innerHTML = `<span class="bd-result err" title="${e.message}" aria-label="불러오지 못함">${svg(ICON.x, 14)}</span>`;
      }
    }

    // 모든 레이어를 포함하는 통합 extent로 fit
    if (extents.length > 0) {
      const union = extents.reduce((u, e) => [
        Math.min(u[0], e[0]),
        Math.min(u[1], e[1]),
        Math.max(u[2], e[2]),
        Math.max(u[3], e[3])
      ]);
      mapManager.fitExtent(union);
    }

    loadBtn.textContent = `${success}개 불러옴${failed > 0 ? `, ${failed}개 못 불러옴` : ''}`;
    this.loadingId = null;
    setTimeout(() => this.close(), 900);
  }

  // ============================
  //  속성정보 로드 → 미리보기
  // ============================
  // ============================
  //  속성정보 미리보기 화면
  // ============================
  _showAttributePreview(result) {
    const { headers, data, fileName, dataset } = result;
    const previewRows = data.slice(0, 5);

    // 레이어 목록 (결합 대상)
    const layers = layerManager.getAllLayers ? layerManager.getAllLayers() : [];
    const layerOptions = layers.map(l =>
      `<option value="${l.id}">${l.name} (${l.featureCount || '?'}개)</option>`
    ).join('');

    const modal = this.overlay.querySelector('.modal');
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="bd-title">${svg(ICON.table, 18)}${fileName}</h3>
        <button class="modal-close" id="builtin-preview-close">&times;</button>
      </div>
      <div class="modal-body" style="padding: 12px 16px; overflow-y: auto;">
        <!-- 데이터 요약 -->
        <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-secondary);">
          ${data.length}행, ${headers.length}열. 출처: ${dataset.source || '-'}
        </div>

        <!-- 미리보기 테이블 -->
        <div style="overflow-x: auto; margin-bottom: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <table class="builtin-preview-table">
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${previewRows.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('')}
              ${data.length > 5 ? `<tr><td colspan="${headers.length}" style="text-align:center; color:var(--text-muted);">... 외 ${data.length - 5}행</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- 테이블 결합 -->
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; background: var(--bg-surface, var(--bg-panel));">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">레이어에 결합</div>
          ${layers.length === 0 ? `
            <div style="font-size: 12px; color: var(--text-muted);">
              결합할 공간 레이어가 없습니다.<br>먼저 공간정보를 불러온 후 속성정보를 결합하세요.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; white-space: nowrap; min-width: 70px;">대상 레이어</label>
                <select id="builtin-join-layer" style="flex:1; padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-primary);">
                  ${layerOptions}
                </select>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; white-space: nowrap; min-width: 70px;">레이어 키</label>
                <select id="builtin-join-layer-key" style="flex:1; padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-primary);">
                  <option value="">레이어를 선택하세요</option>
                </select>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; white-space: nowrap; min-width: 70px;">속성 키</label>
                <select id="builtin-join-attr-key" style="flex:1; padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-primary);">
                  ${headers.map(h => `<option value="${h}" ${h === dataset.keyColumn ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
              </div>
              <div id="builtin-join-result" style="font-size: 12px; color: var(--text-muted); min-height: 18px;"></div>
            </div>
          `}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm bd-back" id="builtin-preview-back">${svg(ICON.back, 14)}목록으로</button>
        ${layers.length > 0 ? '<button class="btn btn-primary btn-sm" id="builtin-join-execute">테이블 결합</button>' : ''}
      </div>
    `;

    // 이벤트 바인딩
    document.getElementById('builtin-preview-close').addEventListener('click', () => this.close());
    document.getElementById('builtin-preview-back').addEventListener('click', () => {
      this._attrData = null;
      this._attrHeaders = null;
      this._attrDataset = null;
      this.overlay.remove();
      this.overlay = null;
      this._renderMain();
    });

    if (layers.length > 0) {
      const layerSelect = document.getElementById('builtin-join-layer');
      const layerKeySelect = document.getElementById('builtin-join-layer-key');

      // 레이어 선택 시 키 필드 업데이트
      const updateLayerKeys = () => {
        const layerId = layerSelect.value;
        const fields = tableJoinTool.getLayerFields(layerId);
        layerKeySelect.innerHTML = fields.map(f => `<option value="${f}">${f}</option>`).join('');
      };
      layerSelect.addEventListener('change', updateLayerKeys);
      updateLayerKeys();

      // 결합 실행
      document.getElementById('builtin-join-execute').addEventListener('click', () => {
        this._executeJoin();
      });
    }
  }

  // ============================
  //  테이블 결합 실행
  // ============================
  _executeJoin() {
    const layerId = document.getElementById('builtin-join-layer').value;
    const layerKey = document.getElementById('builtin-join-layer-key').value;
    const attrKey = document.getElementById('builtin-join-attr-key').value;
    const resultEl = document.getElementById('builtin-join-result');

    if (!layerId || !layerKey || !attrKey) {
      resultEl.innerHTML = errLine('레이어와 키 열을 모두 골라 주세요.');
      return;
    }

    // 키 필드를 제외한 모든 컬럼을 결합
    const joinFields = this._attrHeaders.filter(h => h !== attrKey);

    try {
      const result = tableJoinTool.join(layerId, layerKey, this._attrData, attrKey, joinFields);
      resultEl.innerHTML = okLine(`붙였어요. ${result.totalFeatures}개 가운데 ${result.joinedCount}개가 맞았고, 열 ${result.fieldsAdded.length}개를 더했어요`);
      setTimeout(() => this.close(), 1200);
    } catch (error) {
      resultEl.innerHTML = errLine(error.message);
    }
  }

  // ============================
  //  검색 필터 (공간 데이터 탭)
  // ============================
  _filterDatasets(keyword) {
    const listEl = document.getElementById('builtin-data-list');
    const cards = listEl.querySelectorAll('.builtin-dataset-card, .raster-card');
    const categories = listEl.querySelectorAll('.builtin-category');
    const folders = listEl.querySelectorAll('.builtin-folder');
    const kw = keyword.toLowerCase().trim();

    if (!kw) {
      cards.forEach(c => c.style.display = '');
      categories.forEach(c => { c.style.display = ''; c.classList.remove('open'); });
      folders.forEach(g => { g.style.display = ''; g.classList.remove('open'); });
      return;
    }

    const matched = builtinDataManager.search(kw);
    const matchedIds = new Set(matched.map(d => d.id));

    cards.forEach(card => {
      card.style.display = matchedIds.has(card.dataset.id) ? '' : 'none';
    });

    // 폴더(래스터 광역자치단체·실습 하위 폴더): 안에 매치된 카드가 있으면 펼치고 보이게
    folders.forEach(grp => {
      const visible = grp.querySelectorAll('.raster-card:not([style*="display: none"]), .builtin-dataset-card:not([style*="display: none"])');
      if (visible.length > 0) {
        grp.style.display = '';
        grp.classList.add('open');
      } else {
        grp.style.display = 'none';
      }
    });

    categories.forEach(cat => {
      const visibleCards = cat.querySelectorAll('.builtin-dataset-card:not([style*="display: none"]), .raster-card:not([style*="display: none"])');
      if (visibleCards.length > 0) {
        cat.style.display = '';
        cat.classList.add('open');
      } else {
        cat.style.display = 'none';
      }
    });
  }

  /**
   * 다이얼로그 닫기
   */
  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    this.loadingId = null;
    this._activeTab = 'basic';
    this._attrData = null;
    this._attrHeaders = null;
    this._attrDataset = null;
    this._selectedRasterIds.clear();
    this._lastSheetUrl = '';
    this._lastSheetType = 'attribute';
  }
}

export const builtinDataDialog = new BuiltinDataDialog();
