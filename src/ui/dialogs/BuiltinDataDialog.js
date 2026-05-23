// © 2026 김용현
/**
 * BuiltinDataDialog - 내장 데이터 불러오기 다이얼로그
 * 공간정보(GeoJSON→레이어) / 속성정보(XLSX→테이블 결합)
 */

import { builtinDataManager } from '../../core/BuiltinDataManager.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';
import { tableJoinTool } from '../../tools/TableJoinTool.js';

class BuiltinDataDialog {
  constructor() {
    this.overlay = null;
    this.loadingId = null;
    // 속성정보 미리보기 상태
    this._attrData = null;
    this._attrHeaders = null;
    this._attrDataset = null;
    // 래스터 다중선택 상태
    this._selectedRasterIds = new Set();
  }

  /**
   * 다이얼로그 표시
   */
  async show() {
    this.close();
    await builtinDataManager.loadCatalogs();
    this._renderMain();
  }

  // ============================
  //  메인 목록 화면
  // ============================
  _renderMain() {
    const spatialList = builtinDataManager.getSpatialCatalog();
    const attrList = builtinDataManager.getAttributeCatalog();
    const rasterList = builtinDataManager.getRasterCatalog();

    const html = `
      <div class="modal-overlay active" id="builtin-data-overlay">
        <div class="modal" style="width: 540px; max-height: 82vh;">
          <div class="modal-header">
            <h3>📂 데이터 불러오기</h3>
            <button class="modal-close" id="builtin-data-close">&times;</button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <!-- 검색 -->
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
              <input type="text" id="builtin-data-search" placeholder="데이터 검색..."
                style="width: 100%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--bg-input); color: var(--text-primary); font-size: 13px;">
            </div>
            <!-- 데이터 목록 -->
            <div id="builtin-data-list" style="overflow-y: auto; max-height: calc(82vh - 160px);">
              ${this._renderSpatialSection(spatialList)}
              ${this._renderRasterSection(rasterList)}
              ${this._renderAttributeSection(attrList)}
            </div>
          </div>
          <div class="modal-footer" style="font-size: 11px; color: var(--text-muted); justify-content: center;">
            공간정보는 레이어로 추가, 속성정보는 테이블 결합에 활용됩니다
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.overlay = document.getElementById('builtin-data-overlay');
    this._bindMainEvents();
  }

  _renderSpatialSection(list) {
    return `
      <div class="builtin-category" data-category="spatial">
        <div class="builtin-category-header" data-toggle="spatial">
          <span>🗺️ 공간정보 (SHP)</span>
          <span class="builtin-badge" style="margin-left:auto; margin-right:8px;">${list.length}개</span>
          <svg class="builtin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="builtin-category-body">
          ${list.map(d => `
            <div class="builtin-dataset-card" data-id="${d.id}" data-type="spatial">
              <div class="builtin-dataset-main">
                <div class="builtin-dataset-name">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  ${d.name}
                </div>
                <div class="builtin-dataset-desc">${d.description}</div>
              </div>
              <div class="builtin-dataset-meta">
                <span class="builtin-badge">${d.featureCount}개 피처</span>
                <span class="builtin-badge">${d.source}</span>
              </div>
              <div class="builtin-dataset-loading" style="display:none;">
                <span class="builtin-spinner"></span> 불러오는 중...
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _renderRasterSection(list) {
    const groups = builtinDataManager.getRasterCatalogGrouped();
    const totalCount = list.length;

    const emptyMsg = totalCount === 0
      ? '<div style="padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;">GeoTIFF 파일이 없습니다.<br><code>public/data/builtin/raster/</code>에 .tif 파일을 넣고<br><code>npm run catalog</code> 실행하세요.</div>'
      : '';

    const groupsHTML = groups.map(g => `
      <div class="raster-group" data-group="${g.name}">
        <div class="raster-group-header">
          <input type="checkbox" class="raster-group-all" data-group="${g.name}" aria-label="${g.name} 전체 선택">
          <button type="button" class="raster-group-name" data-toggle-group="${g.name}">
            <svg class="raster-group-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            📁 ${g.name}
            <span class="builtin-badge">${g.items.length}</span>
          </button>
        </div>
        <div class="raster-group-body">
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
        <div class="builtin-category-header" data-toggle="raster">
          <span>🏔 래스터 (GeoTIFF)</span>
          <span class="builtin-badge" style="margin-left:auto; margin-right:8px;">${totalCount}개</span>
          <svg class="builtin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="builtin-category-body">
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

  _renderAttributeSection(list) {
    const emptyMsg = list.length === 0
      ? '<div style="padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;">속성 데이터가 없습니다.<br><code>public/data/builtin/attribute_catalog.json</code>에 항목을 추가하세요.</div>'
      : '';
    return `
      <div class="builtin-category" data-category="attribute">
        <div class="builtin-category-header" data-toggle="attribute">
          <span>📊 속성정보 (XLSX)</span>
          <span class="builtin-badge" style="margin-left:auto; margin-right:8px;">${list.length}개</span>
          <svg class="builtin-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="builtin-category-body">
          ${emptyMsg}
          ${list.map(d => `
            <div class="builtin-dataset-card" data-id="${d.id}" data-type="attribute">
              <div class="builtin-dataset-main">
                <div class="builtin-dataset-name">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  ${d.name}
                </div>
                <div class="builtin-dataset-desc">${d.description}</div>
              </div>
              <div class="builtin-dataset-meta">
                <span class="builtin-badge">${d.rowCount}행</span>
                <span class="builtin-badge">${(d.columns || []).length}열</span>
                <span class="builtin-badge">${d.source}</span>
              </div>
              <div class="builtin-dataset-loading" style="display:none;">
                <span class="builtin-spinner"></span> 불러오는 중...
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  _bindMainEvents() {
    document.getElementById('builtin-data-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._escHandler);

    const listEl = document.getElementById('builtin-data-list');

    // 카테고리 / 래스터 그룹 아코디언 + 카드 클릭
    listEl.addEventListener('click', (e) => {
      // 래스터 그룹 폴더 토글
      const groupNameBtn = e.target.closest('.raster-group-name');
      if (groupNameBtn) {
        const grp = groupNameBtn.closest('.raster-group');
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

      // 비-래스터 카드 단일 로드 (spatial, attribute)
      const card = e.target.closest('.builtin-dataset-card');
      if (!card || this.loadingId) return;
      const type = card.dataset.type;
      const id = card.dataset.id;
      if (type === 'spatial') this._loadSpatial(id, card);
      else if (type === 'attribute') this._loadAttribute(id, card);
    });

    // 래스터 체크박스 변경 (이벤트 위임)
    listEl.addEventListener('change', (e) => {
      if (e.target.classList.contains('raster-item-check')) {
        this._toggleRasterItem(e.target.dataset.id, e.target.checked);
        this._syncGroupCheckbox(e.target.dataset.group);
        this._updateRasterBulkUI();
      } else if (e.target.classList.contains('raster-group-all')) {
        this._toggleRasterGroup(e.target.dataset.group, e.target.checked);
        this._updateRasterBulkUI();
      }
    });

    // 검색
    document.getElementById('builtin-data-search').addEventListener('input', (e) => {
      this._filterDatasets(e.target.value);
    });
  }

  // ============================
  //  공간정보 로드
  // ============================
  async _loadSpatial(id, cardEl) {
    this.loadingId = id;
    const loadingEl = cardEl.querySelector('.builtin-dataset-loading');
    const mainEl = cardEl.querySelector('.builtin-dataset-main');
    const metaEl = cardEl.querySelector('.builtin-dataset-meta');
    loadingEl.style.display = 'flex';
    mainEl.style.opacity = '0.5';
    metaEl.style.display = 'none';

    try {
      await builtinDataManager.loadSpatial(id);
      loadingEl.innerHTML = '<span style="color: var(--success-color, #10b981);">✓ 레이어 추가 완료!</span>';
      setTimeout(() => this.close(), 600);
    } catch (error) {
      loadingEl.innerHTML = `<span style="color: var(--danger-color, #ef4444);">✕ ${error.message}</span>`;
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
    const groupCb = this.overlay.querySelector(`.raster-group-all[data-group="${group}"]`);
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
    this.overlay.querySelectorAll('.raster-group-all').forEach(cb => {
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
        if (loadingEl) loadingEl.innerHTML = '<span style="color: var(--success-color, #10b981);">✓</span>';
      } catch (e) {
        failed++;
        if (loadingEl) loadingEl.innerHTML = `<span style="color: var(--danger-color, #ef4444);" title="${e.message}">✕</span>`;
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

    loadBtn.textContent = `✓ ${success}개 완료${failed > 0 ? ` · ✕ ${failed}` : ''}`;
    this.loadingId = null;
    setTimeout(() => this.close(), 900);
  }

  // ============================
  //  속성정보 로드 → 미리보기
  // ============================
  async _loadAttribute(id, cardEl) {
    this.loadingId = id;
    const loadingEl = cardEl.querySelector('.builtin-dataset-loading');
    const mainEl = cardEl.querySelector('.builtin-dataset-main');
    const metaEl = cardEl.querySelector('.builtin-dataset-meta');
    loadingEl.style.display = 'flex';
    mainEl.style.opacity = '0.5';
    metaEl.style.display = 'none';

    try {
      const result = await builtinDataManager.loadAttribute(id);
      this._attrData = result.data;
      this._attrHeaders = result.headers;
      this._attrDataset = result.dataset;
      // 미리보기 화면으로 전환
      this._showAttributePreview(result);
    } catch (error) {
      loadingEl.innerHTML = `<span style="color: var(--danger-color, #ef4444);">✕ ${error.message}</span>`;
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
        <h3>📊 ${fileName}</h3>
        <button class="modal-close" id="builtin-preview-close">&times;</button>
      </div>
      <div class="modal-body" style="padding: 12px 16px; overflow-y: auto;">
        <!-- 데이터 요약 -->
        <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-secondary);">
          ${data.length}행 × ${headers.length}열 | 출처: ${dataset.source || '-'}
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
              <div id="builtin-join-result" style="font-size: 11px; color: var(--text-muted); min-height: 18px;"></div>
            </div>
          `}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="builtin-preview-back">← 목록으로</button>
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
      resultEl.innerHTML = '<span style="color: var(--danger-color, #ef4444);">모든 필드를 선택하세요.</span>';
      return;
    }

    // 키 필드를 제외한 모든 컬럼을 결합
    const joinFields = this._attrHeaders.filter(h => h !== attrKey);

    try {
      const result = tableJoinTool.join(layerId, layerKey, this._attrData, attrKey, joinFields);
      resultEl.innerHTML = `<span style="color: var(--success-color, #10b981);">✓ 결합 완료! ${result.joinedCount}/${result.totalFeatures}개 매칭, ${result.fieldsAdded.length}개 필드 추가</span>`;
      setTimeout(() => this.close(), 1200);
    } catch (error) {
      resultEl.innerHTML = `<span style="color: var(--danger-color, #ef4444);">✕ ${error.message}</span>`;
    }
  }

  // ============================
  //  검색 필터
  // ============================
  _filterDatasets(keyword) {
    const cards = this.overlay.querySelectorAll('.builtin-dataset-card, .raster-card');
    const categories = this.overlay.querySelectorAll('.builtin-category');
    const rasterGroups = this.overlay.querySelectorAll('.raster-group');
    const kw = keyword.toLowerCase().trim();

    if (!kw) {
      cards.forEach(c => c.style.display = '');
      categories.forEach(c => { c.style.display = ''; c.classList.remove('open'); });
      rasterGroups.forEach(g => { g.style.display = ''; g.classList.remove('open'); });
      return;
    }

    const matched = builtinDataManager.search(kw);
    const matchedIds = new Set(matched.map(d => d.id));

    cards.forEach(card => {
      card.style.display = matchedIds.has(card.dataset.id) ? '' : 'none';
    });

    // 래스터 그룹: 안에 매치된 카드가 있으면 펼치고 보이게
    rasterGroups.forEach(grp => {
      const visible = grp.querySelectorAll('.raster-card:not([style*="display: none"])');
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
    this._attrData = null;
    this._attrHeaders = null;
    this._attrDataset = null;
    this._selectedRasterIds.clear();
  }
}

export const builtinDataDialog = new BuiltinDataDialog();
