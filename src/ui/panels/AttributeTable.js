/**
 * AttributeTable - 속성 테이블 컴포넌트
 * 새 창(팝업 윈도우)으로 열기 - QGIS 스타일
 */

import { eventBus, Events } from '../../utils/EventBus.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';
import Select from 'ol/interaction/Select';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

// 하이라이트 스타일
const HIGHLIGHT_STYLE = new Style({
  fill: new Fill({ color: 'rgba(255, 193, 7, 0.4)' }),
  stroke: new Stroke({ color: '#ffc107', width: 3 }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#ffc107' }),
    stroke: new Stroke({ color: '#fff', width: 2 })
  })
});

export class AttributeTable {
  constructor() {
    this.openWindows = new Map(); // layerId -> window
    this.highlightSelects = new Map(); // layerId -> Select interaction

    this.bindEvents();
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 레이어 테이블 열기 이벤트
    eventBus.on('layer:openTable', ({ layerId }) => {
      this.open(layerId);
    });

    // 레이어 삭제 시 창 닫기
    eventBus.on(Events.LAYER_REMOVED, ({ layerId }) => {
      this.closeWindow(layerId);
    });

    // 피처 변경 시 테이블 갱신
    eventBus.on(Events.FEATURE_CREATED, () => {
      this.refreshAllWindows();
    });

    eventBus.on(Events.FEATURE_DELETED, () => {
      this.refreshAllWindows();
    });
  }

  /**
   * 속성 테이블 열기 (새 창)
   */
  open(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    // 이미 열린 창이 있으면 포커스
    if (this.openWindows.has(layerId)) {
      const existingWin = this.openWindows.get(layerId);
      if (existingWin && !existingWin.closed) {
        existingWin.focus();
        return;
      }
    }

    // 피처 및 컬럼 추출
    const features = layerInfo.source.getFeatures();
    const columns = this.extractColumns(features);

    // 새 창 열기
    const windowWidth = 900;
    const windowHeight = 500;
    const left = (screen.width - windowWidth) / 2;
    const top = (screen.height - windowHeight) / 2;

    const win = window.open(
      '',
      `attribute_table_${layerId}`,
      `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!win) {
      alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }

    this.openWindows.set(layerId, win);

    // HTML 작성
    const html = this.generateHTML(layerInfo, features, columns, layerId);
    win.document.write(html);
    win.document.close();

    // 창 닫힘 감지
    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        this.removeHighlight(layerId);
        this.openWindows.delete(layerId);
      }
    }, 500);

    // 하이라이트 인터랙션 설정
    this.setupHighlight(layerId, layerInfo);

    // 창 내부 이벤트 바인딩
    this.bindWindowEvents(win, layerId, features, columns);
  }

  /**
   * 컬럼 추출
   */
  extractColumns(features) {
    const columnSet = new Set();
    features.forEach(feature => {
      const props = feature.getProperties();
      Object.keys(props).forEach(key => {
        if (key !== 'geometry') {
          columnSet.add(key);
        }
      });
    });
    return Array.from(columnSet);
  }

  /**
   * HTML 생성
   */
  generateHTML(layerInfo, features, columns, layerId) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const tableRows = features.map((feature, index) => {
      const featureId = feature.ol_uid;
      const cells = columns.map(col => {
        const value = feature.get(col);
        const displayValue = value !== undefined && value !== null ? value : '';
        return `<td title="${displayValue}">${displayValue}</td>`;
      }).join('');
      return `<tr data-feature-id="${featureId}"><td class="row-num">${index + 1}</td>${cells}</tr>`;
    }).join('');

    const headerCells = columns.map(col =>
      `<th class="sortable" data-column="${col}">${col}<span class="sort-icon"></span></th>`
    ).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>속성 테이블 - ${layerInfo.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      background: ${isDark ? '#1a1a2e' : '#ffffff'};
      color: ${isDark ? '#e4e4e7' : '#333333'};
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: ${isDark ? '#252540' : '#f5f5f5'};
      border-bottom: 1px solid ${isDark ? '#3a3a5c' : '#e0e0e0'};
    }

    .header-title {
      font-weight: 600;
      font-size: 14px;
    }

    .header-count {
      color: ${isDark ? '#a0a0b0' : '#666666'};
      font-size: 12px;
      margin-left: 8px;
    }

    .selection-count {
      color: #4a90d9;
      font-size: 12px;
      margin-left: 8px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      background: ${isDark ? '#3a3a5c' : '#e0e0e0'};
      color: ${isDark ? '#e4e4e7' : '#333333'};
      transition: background 0.2s;
    }

    .btn:hover {
      background: ${isDark ? '#4a4a6c' : '#d0d0d0'};
    }

    .btn-primary {
      background: #4a90d9;
      color: white;
    }

    .btn-primary:hover {
      background: #3a80c9;
    }

    .btn-danger {
      background: #dc3545;
      color: white;
    }

    .btn-danger:hover {
      background: #c82333;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .table-container {
      height: calc(100vh - 50px);
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    thead {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    th {
      background: ${isDark ? '#2a2a45' : '#f0f0f0'};
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid ${isDark ? '#4a4a6c' : '#ccc'};
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }

    th:hover {
      background: ${isDark ? '#353555' : '#e5e5e5'};
    }

    th.sortable .sort-icon::after {
      content: '⇅';
      margin-left: 4px;
      opacity: 0.4;
    }

    th.asc .sort-icon::after {
      content: '↑';
      opacity: 1;
    }

    th.desc .sort-icon::after {
      content: '↓';
      opacity: 1;
    }

    td {
      padding: 6px 10px;
      border-bottom: 1px solid ${isDark ? '#3a3a5c' : '#eee'};
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    td.editable:hover {
      background: ${isDark ? '#3a3a5c' : '#f0f0f0'};
      cursor: text;
    }

    td.editing {
      padding: 2px;
    }

    td.editing input {
      width: 100%;
      padding: 4px 8px;
      border: 2px solid #4a90d9;
      border-radius: 3px;
      font-size: 12px;
      background: ${isDark ? '#1a1a2e' : '#ffffff'};
      color: ${isDark ? '#e4e4e7' : '#333333'};
      outline: none;
    }

    .row-num {
      width: 50px;
      text-align: center;
      color: ${isDark ? '#808090' : '#999'};
      background: ${isDark ? '#222238' : '#fafafa'};
    }

    tr:hover {
      background: ${isDark ? '#2a2a45' : '#f5f5f5'};
    }

    tr.selected {
      background: ${isDark ? '#3a4a5c' : '#e3f2fd'} !important;
    }

    tr.selected td {
      border-color: ${isDark ? '#4a5a6c' : '#bbdefb'};
    }

    .empty-message {
      padding: 40px;
      text-align: center;
      color: ${isDark ? '#808090' : '#999'};
    }

    .help-text {
      font-size: 11px;
      color: ${isDark ? '#808090' : '#999'};
      padding: 8px 16px;
      background: ${isDark ? '#1a1a2e' : '#fafafa'};
      border-bottom: 1px solid ${isDark ? '#3a3a5c' : '#e0e0e0'};
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <span class="header-title">${layerInfo.name}</span>
      <span class="header-count">(${features.length}개 피처)</span>
      <span class="selection-count" id="selection-count"></span>
    </div>
    <div class="header-actions">
      <button class="btn" id="btn-zoom-selected" title="선택한 피처로 이동">선택으로 이동</button>
      <button class="btn btn-danger" id="btn-delete-selected" title="선택한 피처 삭제" disabled>선택 삭제</button>
      <button class="btn" id="btn-refresh">새로고침</button>
    </div>
  </div>
  <div class="help-text">Ctrl+클릭: 다중 선택 | Shift+클릭: 범위 선택 | 더블클릭: 셀 편집 | Delete: 선택 삭제</div>
  <div class="table-container">
    ${features.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th class="row-num">#</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ` : '<div class="empty-message">피처가 없습니다.</div>'}
  </div>
</body>
</html>
    `;
  }

  /**
   * 창 내부 이벤트 바인딩
   */
  bindWindowEvents(win, layerId, features, columns) {
    const self = this;

    // 피처 ID를 문자열로 저장하는 맵 생성
    const featureMap = new Map();
    features.forEach(f => {
      featureMap.set(String(f.ol_uid), f);
    });

    // document.write 후 즉시 이벤트 바인딩 (setTimeout으로 DOM 렌더링 대기)
    setTimeout(function() {
      const doc = win.document;
      if (!doc || !doc.body) return;

      let selectedFeatureIds = new Set();
      let lastSelectedIndex = -1;
      let sortColumn = null;
      let sortAsc = true;
      let editingCell = null;

      const btnDelete = doc.getElementById('btn-delete-selected');
      const selectionCountEl = doc.getElementById('selection-count');

      // 행 클릭 - 선택
      doc.querySelectorAll('tbody tr').forEach((tr, index) => {
        tr.addEventListener('click', function(e) {
          const featureId = this.dataset.featureId;
          const rowIndex = getRowIndex(this);

          if (e.ctrlKey || e.metaKey) {
            // Ctrl+클릭: 토글 선택
            toggleSelection(featureId);
            lastSelectedIndex = rowIndex;
          } else if (e.shiftKey && lastSelectedIndex >= 0) {
            // Shift+클릭: 범위 선택
            rangeSelect(lastSelectedIndex, rowIndex);
          } else {
            // 일반 클릭: 단일 선택
            clearSelection();
            addSelection(featureId);
            lastSelectedIndex = rowIndex;
          }

          updateSelectionUI();
          updateMapHighlight();
        });
      });

      // 셀 더블클릭 - 편집
      doc.querySelectorAll('tbody td:not(.row-num)').forEach((td, cellIndex) => {
        td.classList.add('editable');
        td.addEventListener('dblclick', function(e) {
          e.stopPropagation();
          startEditing(this);
        });
      });

      // 헤더 클릭 - 정렬
      doc.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
          const col = this.dataset.column;
          if (sortColumn === col) {
            sortAsc = !sortAsc;
          } else {
            sortColumn = col;
            sortAsc = true;
          }
          sortTable(col, sortAsc);
          updateSortUI(col, sortAsc);
        });
      });

      // 선택 피처로 이동 버튼
      const btnZoom = doc.getElementById('btn-zoom-selected');
      if (btnZoom) {
        btnZoom.addEventListener('click', zoomToSelected);
      }

      // 선택 삭제 버튼
      if (btnDelete) {
        btnDelete.addEventListener('click', deleteSelected);
      }

      // 새로고침 버튼
      const btnRefresh = doc.getElementById('btn-refresh');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
          self.refreshWindow(layerId);
        });
      }

      // Delete 키 단축키
      doc.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' && selectedFeatureIds.size > 0 && !editingCell) {
          deleteSelected();
        }
        // Escape: 편집 취소
        if (e.key === 'Escape' && editingCell) {
          cancelEditing();
        }
      });

      function getRowIndex(tr) {
        const rows = Array.from(doc.querySelectorAll('tbody tr'));
        return rows.indexOf(tr);
      }

      function getAllRows() {
        return Array.from(doc.querySelectorAll('tbody tr'));
      }

      function toggleSelection(featureId) {
        if (selectedFeatureIds.has(featureId)) {
          selectedFeatureIds.delete(featureId);
        } else {
          selectedFeatureIds.add(featureId);
        }
      }

      function addSelection(featureId) {
        selectedFeatureIds.add(featureId);
      }

      function clearSelection() {
        selectedFeatureIds.clear();
      }

      function rangeSelect(startIndex, endIndex) {
        const rows = getAllRows();
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        for (let i = minIndex; i <= maxIndex; i++) {
          const row = rows[i];
          if (row) {
            selectedFeatureIds.add(row.dataset.featureId);
          }
        }
      }

      function updateSelectionUI() {
        doc.querySelectorAll('tbody tr').forEach(tr => {
          if (selectedFeatureIds.has(tr.dataset.featureId)) {
            tr.classList.add('selected');
          } else {
            tr.classList.remove('selected');
          }
        });

        // 선택 개수 표시
        if (selectionCountEl) {
          if (selectedFeatureIds.size > 0) {
            selectionCountEl.textContent = `(${selectedFeatureIds.size}개 선택됨)`;
          } else {
            selectionCountEl.textContent = '';
          }
        }

        // 삭제 버튼 활성화/비활성화
        if (btnDelete) {
          btnDelete.disabled = selectedFeatureIds.size === 0;
        }
      }

      function updateMapHighlight() {
        const highlightSelect = self.highlightSelects.get(layerId);
        if (highlightSelect) {
          highlightSelect.getFeatures().clear();
          selectedFeatureIds.forEach(fid => {
            const feature = featureMap.get(fid);
            if (feature) {
              highlightSelect.getFeatures().push(feature);
            }
          });
        }

        // 단일 선택 시 이벤트 발생
        if (selectedFeatureIds.size === 1) {
          const fid = selectedFeatureIds.values().next().value;
          const feature = featureMap.get(fid);
          if (feature) {
            eventBus.emit(Events.FEATURE_SELECTED, { feature });
          }
        }
      }

      function zoomToSelected() {
        if (selectedFeatureIds.size === 0) {
          win.alert('먼저 피처를 선택하세요.');
          return;
        }

        // 선택된 모든 피처의 extent 계산
        let fullExtent = null;
        selectedFeatureIds.forEach(fid => {
          const feature = featureMap.get(fid);
          if (feature) {
            const geometry = feature.getGeometry();
            if (geometry) {
              const extent = geometry.getExtent();
              if (!fullExtent) {
                fullExtent = extent.slice();
              } else {
                fullExtent[0] = Math.min(fullExtent[0], extent[0]);
                fullExtent[1] = Math.min(fullExtent[1], extent[1]);
                fullExtent[2] = Math.max(fullExtent[2], extent[2]);
                fullExtent[3] = Math.max(fullExtent[3], extent[3]);
              }
            }
          }
        });

        if (fullExtent) {
          mapManager.fitExtent(fullExtent, {
            padding: [100, 100, 100, 100],
            maxZoom: 15
          });
        }
      }

      function deleteSelected() {
        if (selectedFeatureIds.size === 0) return;

        const count = selectedFeatureIds.size;
        const message = count === 1
          ? '선택한 피처를 삭제하시겠습니까?'
          : `선택한 ${count}개의 피처를 삭제하시겠습니까?`;

        if (!win.confirm(message)) return;

        const layerInfo = layerManager.getLayer(layerId);
        if (!layerInfo || !layerInfo.source) return;

        // 피처 삭제
        selectedFeatureIds.forEach(fid => {
          const feature = featureMap.get(fid);
          if (feature) {
            layerInfo.source.removeFeature(feature);
            featureMap.delete(fid);
          }
        });

        // 테이블에서 행 제거
        selectedFeatureIds.forEach(fid => {
          const row = doc.querySelector(`tbody tr[data-feature-id="${fid}"]`);
          if (row) row.remove();
        });

        // 행 번호 재정렬
        doc.querySelectorAll('tbody tr').forEach((tr, index) => {
          const rowNum = tr.querySelector('.row-num');
          if (rowNum) rowNum.textContent = index + 1;
        });

        // 피처 개수 업데이트
        const countEl = doc.querySelector('.header-count');
        if (countEl) {
          const newCount = featureMap.size;
          countEl.textContent = `(${newCount}개 피처)`;
        }

        // 하이라이트 클리어
        const highlightSelect = self.highlightSelects.get(layerId);
        if (highlightSelect) {
          highlightSelect.getFeatures().clear();
        }

        clearSelection();
        updateSelectionUI();

        eventBus.emit(Events.FEATURE_DELETED, { layerId, count });
      }

      function startEditing(td) {
        if (editingCell) {
          saveEditing();
        }

        const tr = td.closest('tr');
        const featureId = tr.dataset.featureId;
        const feature = featureMap.get(featureId);
        if (!feature) return;

        // 컬럼 인덱스 찾기
        const cells = Array.from(tr.querySelectorAll('td'));
        const cellIndex = cells.indexOf(td) - 1; // row-num 셀 제외
        if (cellIndex < 0 || cellIndex >= columns.length) return;

        const column = columns[cellIndex];
        const currentValue = feature.get(column);

        editingCell = {
          td: td,
          featureId: featureId,
          column: column,
          originalValue: currentValue
        };

        td.classList.add('editing');
        const input = doc.createElement('input');
        input.type = 'text';
        input.value = currentValue !== undefined && currentValue !== null ? currentValue : '';
        td.innerHTML = '';
        td.appendChild(input);
        input.focus();
        input.select();

        input.addEventListener('blur', function() {
          saveEditing();
        });

        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            saveEditing();
          } else if (e.key === 'Escape') {
            cancelEditing();
          }
          e.stopPropagation();
        });
      }

      function saveEditing() {
        if (!editingCell) return;

        const { td, featureId, column, originalValue } = editingCell;
        const input = td.querySelector('input');
        const newValue = input ? input.value : originalValue;

        const feature = featureMap.get(featureId);
        if (feature && newValue !== originalValue) {
          // 숫자 변환 시도
          const numValue = parseFloat(newValue);
          const finalValue = !isNaN(numValue) && newValue.trim() !== '' ? numValue : newValue;
          feature.set(column, finalValue);
        }

        td.classList.remove('editing');
        td.innerHTML = '';
        td.textContent = newValue;
        td.title = newValue;

        editingCell = null;
      }

      function cancelEditing() {
        if (!editingCell) return;

        const { td, originalValue } = editingCell;
        td.classList.remove('editing');
        td.innerHTML = '';
        td.textContent = originalValue !== undefined && originalValue !== null ? originalValue : '';
        td.title = td.textContent;

        editingCell = null;
      }

      function sortTable(column, ascending) {
        const tbody = doc.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
          const aFeatureId = a.dataset.featureId;
          const bFeatureId = b.dataset.featureId;
          const aFeature = featureMap.get(aFeatureId);
          const bFeature = featureMap.get(bFeatureId);

          const valA = aFeature ? aFeature.get(column) : '';
          const valB = bFeature ? bFeature.get(column) : '';

          // 숫자 비교
          const numA = parseFloat(valA);
          const numB = parseFloat(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            return ascending ? numA - numB : numB - numA;
          }

          // 문자열 비교
          const strA = String(valA || '').toLowerCase();
          const strB = String(valB || '').toLowerCase();
          return ascending ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });

        // 행 번호 재정렬 및 DOM 업데이트
        rows.forEach((row, index) => {
          const rowNum = row.querySelector('.row-num');
          if (rowNum) {
            rowNum.textContent = index + 1;
          }
          tbody.appendChild(row);
        });
      }

      function updateSortUI(column, ascending) {
        doc.querySelectorAll('th.sortable').forEach(th => {
          th.classList.remove('asc', 'desc');
          if (th.dataset.column === column) {
            th.classList.add(ascending ? 'asc' : 'desc');
          }
        });
      }
    }, 100);
  }

  /**
   * 창 새로고침
   */
  refreshWindow(layerId) {
    this.closeWindow(layerId);
    this.open(layerId);
  }

  /**
   * 모든 창 새로고침
   */
  refreshAllWindows() {
    for (const layerId of this.openWindows.keys()) {
      this.refreshWindow(layerId);
    }
  }

  /**
   * 창 닫기
   */
  closeWindow(layerId) {
    const win = this.openWindows.get(layerId);
    if (win && !win.closed) {
      win.close();
    }
    this.openWindows.delete(layerId);
    this.removeHighlight(layerId);
  }

  /**
   * 하이라이트 인터랙션 설정
   */
  setupHighlight(layerId, layerInfo) {
    this.removeHighlight(layerId);

    const map = mapManager.getMap();

    const highlightSelect = new Select({
      condition: () => false,
      style: HIGHLIGHT_STYLE,
      layers: [layerInfo.olLayer]
    });

    map.addInteraction(highlightSelect);
    this.highlightSelects.set(layerId, highlightSelect);
  }

  /**
   * 하이라이트 제거
   */
  removeHighlight(layerId) {
    const highlightSelect = this.highlightSelects.get(layerId);
    if (highlightSelect) {
      const map = mapManager.getMap();
      if (map) {
        map.removeInteraction(highlightSelect);
      }
      this.highlightSelects.delete(layerId);
    }
  }
}

// 싱글톤 인스턴스
export const attributeTable = new AttributeTable();
