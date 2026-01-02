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
  </style>
</head>
<body>
  <div class="header">
    <div>
      <span class="header-title">${layerInfo.name}</span>
      <span class="header-count">(${features.length}개 피처)</span>
    </div>
    <div class="header-actions">
      <button class="btn" id="btn-zoom-selected" title="선택한 피처로 이동">선택 피처로 이동</button>
      <button class="btn" id="btn-refresh">새로고침</button>
    </div>
  </div>
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

      let selectedFeatureId = null;
      let sortColumn = null;
      let sortAsc = true;

      // 행 클릭 - 선택
      doc.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', function() {
          const featureId = this.dataset.featureId;
          selectFeature(featureId);
        });

        tr.addEventListener('dblclick', function() {
          const featureId = this.dataset.featureId;
          selectFeature(featureId);
          zoomToSelected();
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

      // 새로고침 버튼
      const btnRefresh = doc.getElementById('btn-refresh');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
          self.refreshWindow(layerId);
        });
      }

      function selectFeature(featureId) {
        selectedFeatureId = featureId;

        // UI 업데이트
        doc.querySelectorAll('tbody tr').forEach(tr => {
          tr.classList.remove('selected');
          if (tr.dataset.featureId === featureId) {
            tr.classList.add('selected');
          }
        });

        // 지도 하이라이트
        const feature = featureMap.get(featureId);
        if (feature) {
          const highlightSelect = self.highlightSelects.get(layerId);
          if (highlightSelect) {
            highlightSelect.getFeatures().clear();
            highlightSelect.getFeatures().push(feature);
          }
          eventBus.emit(Events.FEATURE_SELECTED, { feature });
        }
      }

      function zoomToSelected() {
        if (!selectedFeatureId) {
          win.alert('먼저 피처를 선택하세요.');
          return;
        }

        const feature = featureMap.get(selectedFeatureId);
        if (feature) {
          const geometry = feature.getGeometry();
          if (geometry) {
            const extent = geometry.getExtent();
            mapManager.fitExtent(extent, {
              padding: [100, 100, 100, 100],
              maxZoom: 15
            });
          }
        }
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
