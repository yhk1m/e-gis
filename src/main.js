/**
 * eGIS - 교육용 GIS 웹 애플리케이션
 * 메인 엔트리 포인트
 */

import './styles/main.css';
import { AppLayout } from './ui/layout/AppLayout.js';
import { mapManager } from './core/MapManager.js';
import { layerManager } from './core/LayerManager.js';
import { themeManager } from './utils/ThemeManager.js';
import { eventBus, Events } from './utils/EventBus.js';
import { LayerPanel } from './ui/panels/LayerPanel.js';
import { BrowserPanel } from './ui/panels/BrowserPanel.js';
import { toolManager } from './tools/ToolManager.js';
import { attributeTable } from './ui/panels/AttributeTable.js';
import { coordinateSystem } from './core/CoordinateSystem.js';
import { projectManager } from './core/ProjectManager.js';
import { historyManager } from './core/HistoryManager.js';
import { autoSaveManager } from './core/AutoSaveManager.js';
import { choroplethPanel } from './ui/panels/ChoroplethPanel.js';
import { tableJoinPanel } from './ui/panels/TableJoinPanel.js';
import { labelPanel } from './ui/panels/LabelPanel.js';
import { bufferPanel } from './ui/panels/BufferPanel.js';
import { exportPanel } from './ui/panels/ExportPanel.js';
import { fieldCalculatorPanel } from './ui/panels/FieldCalculatorPanel.js';
import { spatialOperationsPanel } from './ui/panels/SpatialOperationsPanel.js';
import { heatmapPanel } from './ui/panels/HeatmapPanel.js';
import { bookmarkPanel } from './ui/panels/BookmarkPanel.js';
import { coordinateImportPanel } from './ui/panels/CoordinateImportPanel.js';
import { chartMapPanel } from './ui/panels/ChartMapPanel.js';
import { isochronePanel } from './ui/panels/IsochronePanel.js';
import { routingPanel } from './ui/panels/RoutingPanel.js';
import { drawingPanel } from './ui/panels/DrawingPanel.js';
import { cloudPanel } from './ui/panels/CloudPanel.js';
import { myPagePanel } from './ui/panels/MyPagePanel.js';
import { supabaseManager } from './core/SupabaseManager.js';
import { geocodingService } from './services/GeocodingService.js';
import { geojsonLoader } from './loaders/GeoJSONLoader.js';
import { shapefileLoader } from './loaders/ShapefileLoader.js';
import { geopackageLoader } from './loaders/GeoPackageLoader.js';

/**
 * 앱 초기화
 */
function initApp() {
  console.log('eGIS 시작!');

  // 0. 히스토리 관리자 초기화
  historyManager.init();

  // 1. 좌표계 시스템 초기화
  coordinateSystem.init();

  // 2. 테마 초기화
  themeManager.init();

  // 3. 레이아웃 렌더링
  const layout = new AppLayout('app');
  layout.render();

  // 4. 지도 초기화
  mapManager.init('map', {
    center: [127.5, 36.5],
    zoom: 7
  });

  // 4.5 자동 저장 관리자 초기화 (지도 초기화 후)
  autoSaveManager.init();

  // 4.6 Supabase 클라우드 관리자 초기화
  supabaseManager.init().then(() => {
    updateHeaderAuth();
  });

  // 4.7 헤더 로그인 버튼 이벤트
  initHeaderAuth();

  // 5. 패널 초기화
  new LayerPanel('layer-list');
  new BrowserPanel('file-drop-zone');

  // 6. 테마 토글 버튼 이벤트
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    themeManager.toggle();
  });

  // 7. 상태표시줄 이벤트 바인딩
  initStatusBar();

  // 8. 툴바 이벤트 바인딩
  initToolbar();

  // 9. 윈도우 리사이즈 시 지도 크기 갱신
  window.addEventListener('resize', () => {
    mapManager.updateSize();
  });

  // 10. 메뉴바 초기화
  initMenubar();

  // 11. 위치 검색 초기화
  initLocationSearch();



  // 12. 키보드 단축키 설정
  document.addEventListener('keydown', (e) => {
    // Ctrl+Z: 실행 취소
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (historyManager.undo()) {
        showStatusMessage('실행 취소되었습니다.');
      }
    }
    // Ctrl+Shift+Z: 다시 실행
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (historyManager.redo()) {
        showStatusMessage('다시 실행되었습니다.');
      }
    }
  });

  // 레이어 추가 버튼 이벤트 (파일 추가)
  const btnAddLayer = document.getElementById('btn-add-layer');
  if (btnAddLayer) {
    btnAddLayer.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.geojson,.json,.zip,.shp,.dbf,.shx,.prj,.gpkg';
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          try {
            showStatusMessage('로딩 중: ' + file.name);
            await loadFileByExtension(file);
            showStatusMessage(file.name + ' 로드 완료');
          } catch (error) {
            console.error('파일 로드 실패:', error);
            showStatusMessage('파일 로드 실패: ' + error.message);
          }
        }
        fileInput.remove();
      });

      fileInput.click();
    });
  }

  console.log('eGIS 초기화 완료!');
}

/**
 * 상태표시줄 초기화
 */
function initStatusBar() {
  const coordsEl = document.querySelector('#status-coords .coord-value');
  const scaleEl = document.querySelector('#status-scale .scale-value');
  const crsEl = document.getElementById('status-crs');

  // 마우스 이동 시 좌표 업데이트 (선택된 좌표계로 변환)
  eventBus.on(Events.MAP_POINTER_MOVE, ({ lonLat }) => {
    const displayCRS = coordinateSystem.getDisplayCRS();

    if (displayCRS === 'EPSG:4326') {
      coordsEl.textContent = coordinateSystem.formatCoords(lonLat);
    } else {
      const transformed = coordinateSystem.transform(lonLat, 'EPSG:4326', displayCRS);
      coordsEl.textContent = coordinateSystem.formatCoords(transformed);
    }
  });

  // 지도 이동 시 축척 업데이트
  eventBus.on(Events.MAP_MOVEEND, () => {
    const scale = mapManager.getScale();
    scaleEl.textContent = formatScale(scale);
  });

  // CRS 변경 시 표시 업데이트
  eventBus.on(Events.CRS_CHANGED, ({ crs }) => {
    updateCRSDisplay(crs);
  });

  // 초기 축척 표시
  setTimeout(() => {
    const scale = mapManager.getScale();
    scaleEl.textContent = formatScale(scale);
  }, 100);

  // CRS 선택 드롭다운 초기화
  if (crsEl) {
    initCRSSelector(crsEl);
  }
}

/**
 * CRS 선택 드롭다운 초기화
 */
function initCRSSelector(crsEl) {
  const dropdown = document.createElement('div');
  dropdown.className = 'crs-dropdown';
  
  const menuItems = coordinateSystem.getAvailableCRS().map(crs => 
    '<div class="crs-option" data-crs="' + crs.code + '">' +
      '<span class="crs-code">' + crs.code + '</span>' +
      '<span class="crs-name">' + crs.name + '</span>' +
    '</div>'
  ).join('');
  
  dropdown.innerHTML = '<div class="crs-dropdown-menu">' + menuItems + '</div>';
  crsEl.appendChild(dropdown);

  updateCRSDisplay(coordinateSystem.getDisplayCRS());

  crsEl.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  dropdown.querySelectorAll('.crs-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const crs = option.dataset.crs;
      coordinateSystem.setDisplayCRS(crs);
      dropdown.classList.remove('open');
    });
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
  });
}

/**
 * CRS 표시 업데이트
 */
function updateCRSDisplay(crs) {
  const crsValue = document.querySelector('#status-crs .crs-value');
  if (crsValue) {
    crsValue.textContent = crs;
  }
}

/**
 * 축척 포맷팅
 */
function formatScale(scale) {
  if (scale >= 1000000) {
    return '1:' + (scale / 1000000).toFixed(1) + 'M';
  } else if (scale >= 1000) {
    return '1:' + (scale / 1000).toFixed(0) + 'K';
  }
  return '1:' + scale.toFixed(0);
}

/**
 * 툴바 초기화
 */
function initToolbar() {
  const toolbar = document.getElementById('toolbar');
  const view = mapManager.getView();

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;

    const tool = btn.dataset.tool;

    // 줌 관련 도구
    switch (tool) {
      case 'zoom-in':
        view.animate({ zoom: view.getZoom() + 1, duration: 250 });
        return;
      case 'zoom-out':
        view.animate({ zoom: view.getZoom() - 1, duration: 250 });
        return;
      case 'zoom-extent':
        view.animate({ center: view.getCenter(), zoom: 7, duration: 500 });
        return;
    }

    // 그리기/선택 도구
    toolManager.toggleTool(tool);
  });
}


/**
 * 메뉴바 초기화
 */
function initMenubar() {
  const menubar = document.getElementById('menubar');

  // 드롭다운 토글
  menubar.addEventListener('click', (e) => {
    const menuButton = e.target.closest('.menu-button');
    if (menuButton) {
      const menuItem = menuButton.closest('.menu-item');

      // 다른 드롭다운 닫기
      document.querySelectorAll('.menu-item.dropdown.open').forEach(item => {
        if (item !== menuItem) item.classList.remove('open');
      });

      // 현재 메뉴 토글
      menuItem.classList.toggle('open');
      return;
    }

    // 드롭다운 메뉴 아이템 클릭
    const dropdownItem = e.target.closest('.dropdown-item');
    if (dropdownItem) {
      const action = dropdownItem.dataset.action;
      handleMenuAction(action);

      // 드롭다운 닫기
      document.querySelectorAll('.menu-item.dropdown.open').forEach(item => {
        item.classList.remove('open');
      });
    }
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-item')) {
      document.querySelectorAll('.menu-item.dropdown.open').forEach(item => {
        item.classList.remove('open');
      });
    }
  });
}

/**
 * 메뉴 액션 처리
 */
function handleMenuAction(action) {
  switch (action) {
    case 'project-new':
      if (projectManager.hasDirty()) {
        if (confirm('저장하지 않은 변경사항이 있습니다. 새 프로젝트를 시작하시겠습니까?')) {
          projectManager.newProject();
          showStatusMessage('새 프로젝트가 생성되었습니다.');
        }
      } else {
        projectManager.newProject();
        showStatusMessage('새 프로젝트가 생성되었습니다.');
      }
      break;
      
    case 'project-open':
      projectManager.loadFromFile()
        .then(() => {
          showStatusMessage('프로젝트를 불러왔습니다: ' + projectManager.getProjectName());
        })
        .catch((error) => {
          showStatusMessage('프로젝트 불러오기 실패: ' + error.message);
        });
      break;
      
    case 'project-save': {
      const currentName = projectManager.getProjectName();
      const newName = prompt('프로젝트 이름을 입력하세요:', currentName);
      if (newName && newName.trim()) {
        projectManager.setProjectName(newName.trim());
        projectManager.saveToFile();
        showStatusMessage('프로젝트가 저장되었습니다: ' + newName.trim());
      }
      break;
    }
    case 'project-cloud':
      cloudPanel.show();
      break;
    case 'project-export':
      exportPanel.show();
      break;

    // ===== 편집 메뉴 =====
    case 'edit-undo':
      if (historyManager.undo()) {
        showStatusMessage('실행 취소되었습니다.');
      } else {
        showStatusMessage('취소할 작업이 없습니다.');
      }
      break;
    case 'edit-redo':
      if (historyManager.redo()) {
        showStatusMessage('다시 실행되었습니다.');
      } else {
        showStatusMessage('다시 실행할 작업이 없습니다.');
      }
      break;
    case 'edit-delete': {
      // 선택 도구 활성화 후 삭제
      toolManager.activateTool('select');
      const deleted = toolManager.deleteSelectedFeatures();
      if (deleted) {
        showStatusMessage('선택된 피처가 삭제되었습니다.');
      } else {
        showStatusMessage('삭제할 피처를 먼저 선택하세요.');
      }
      break;
    }
    case 'edit-select-all': {
      const selectedLayerId = layerManager.getSelectedLayerId();
      if (!selectedLayerId) {
        showStatusMessage('먼저 레이어 패널에서 레이어를 선택하세요.');
        break;
      }
      toolManager.activateTool('select');
      toolManager.selectAllFeatures();
      const layer = layerManager.getLayer(selectedLayerId);
      const count = layer ? layer.source.getFeatures().length : 0;
      showStatusMessage(count + '개 피처가 선택되었습니다.');
      break;
    }
    case 'edit-deselect':
      toolManager.clearSelection();
      showStatusMessage('선택이 해제되었습니다.');
      break;
    // ===== 보기 메뉴 =====
    case 'view-zoom-in':
      mapManager.getView().animate({ zoom: mapManager.getView().getZoom() + 1, duration: 250 });
      break;
    case 'view-zoom-out':
      mapManager.getView().animate({ zoom: mapManager.getView().getZoom() - 1, duration: 250 });
      break;
    case 'view-full-extent':
      mapManager.getView().animate({ center: mapManager.getView().getCenter(), zoom: 7, duration: 500 });
      break;
    case 'view-zoom-layer': {
      const selectedId = layerManager.getSelectedLayerId();
      if (selectedId) {
        layerManager.zoomToLayer(selectedId);
        showStatusMessage('선택된 레이어로 이동했습니다.');
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'view-toggle-panel': {
      const leftPanel = document.getElementById('left-panel');
      leftPanel.classList.toggle('hidden');
      mapManager.updateSize();
      break;
    }
    case 'view-bookmarks':
      bookmarkPanel.show();
      break;

    // ===== 레이어 메뉴 =====
    case 'layer-add': {
      const layerName = prompt('새 레이어 이름:', '새 레이어');
      if (layerName && layerName.trim()) {
        layerManager.addLayer({ name: layerName.trim() });
        showStatusMessage('레이어가 추가되었습니다: ' + layerName.trim());
      }
      break;
    }
    case 'layer-from-coords':
      coordinateImportPanel.show();
      break;
    case 'layer-remove': {
      const selectedLayerId = layerManager.getSelectedLayerId();
      if (selectedLayerId) {
        const layer = layerManager.getLayer(selectedLayerId);
        if (confirm('"' + layer.name + '" 레이어를 삭제하시겠습니까?')) {
          layerManager.removeLayer(selectedLayerId);
          showStatusMessage('레이어가 삭제되었습니다.');
        }
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'layer-rename': {
      const selLayerId = layerManager.getSelectedLayerId();
      if (selLayerId) {
        const layer = layerManager.getLayer(selLayerId);
        const newName = prompt('새 이름:', layer.name);
        if (newName && newName.trim()) {
          layerManager.renameLayer(selLayerId, newName.trim());
          showStatusMessage('레이어 이름이 변경되었습니다.');
        }
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'layer-attribute-table': {
      const attrLayerId = layerManager.getSelectedLayerId();
      if (attrLayerId) {
        attributeTable.open(attrLayerId);
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'layer-label': {
      labelPanel.open();
      break;
    }
    case 'layer-table-join': {
      const joinLayerId = layerManager.getSelectedLayerId();
      if (joinLayerId) {
        tableJoinPanel.show(joinLayerId);
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'layer-field-calculator': {
      const calcLayerId = layerManager.getSelectedLayerId();
      if (calcLayerId) {
        fieldCalculatorPanel.show(calcLayerId);
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'layer-clear-all':
      if (confirm('모든 레이어를 삭제하시겠습니까?')) {
        layerManager.clear();
        showStatusMessage('모든 레이어가 삭제되었습니다.');
      }
      break;

    // ===== 분석 메뉴 =====
    case 'analysis-measure-distance':
      toolManager.activateTool('measure-distance');
      showStatusMessage('거리 측정: 지도를 클릭하여 측정하세요. 더블클릭으로 종료.');
      break;
    case 'analysis-measure-area':
      toolManager.activateTool('measure-area');
      showStatusMessage('면적 측정: 지도를 클릭하여 측정하세요. 더블클릭으로 종료.');
      break;
    case 'analysis-clear-measures':
      toolManager.clearMeasurements();
      showStatusMessage('측정 결과가 지워졌습니다.');
      break;
    case 'analysis-choropleth': {
      const selectedLayerId = layerManager.getSelectedLayerId();
      if (selectedLayerId) {
        choroplethPanel.show(selectedLayerId);
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'analysis-buffer': {
      const bufferLayerId = layerManager.getSelectedLayerId();
      if (bufferLayerId) {
        bufferPanel.show(bufferLayerId);
      } else {
        showStatusMessage('먼저 레이어를 선택해주세요.');
      }
      break;
    }
    case 'analysis-spatial-ops':
      spatialOperationsPanel.show();
      break;
    case 'analysis-heatmap':
      heatmapPanel.show();
      break;
    case 'analysis-chart-map':
      chartMapPanel.show();
      break;
    case 'analysis-isochrone':
      isochronePanel.show();
      break;
    case 'analysis-routing':
      routingPanel.show();
      break;

    default:
      console.log('메뉴 액션:', action);
  }
}

/**
 * 레이어 추가 메뉴 표시
 */
async function loadFileByExtension(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  switch (ext) {
    case 'geojson':
    case 'json':
      return await geojsonLoader.loadFromFile(file);
    case 'zip':
    case 'shp':
    case 'dbf':
    case 'shx':
    case 'prj':
      return await shapefileLoader.loadFromFile(file);
    case 'gpkg':
      return await geopackageLoader.loadFromFile(file);
    default:
      throw new Error('지원하지 않는 파일 형식입니다.');
  }
}

/**
 * 상태 메시지 표시
 */
function showStatusMessage(message) {
  const statusMessage = document.getElementById('status-message');
  if (statusMessage) {
    statusMessage.textContent = message;

    // 3초 후 기본 메시지로 복원
    setTimeout(() => {
      statusMessage.textContent = '준비';
    }, 3000);
  }
}

/**
 * 헤더 인증 버튼 초기화
 */
function initHeaderAuth() {
  const headerAuth = document.getElementById('header-auth');
  if (!headerAuth) return;

  headerAuth.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.id === 'header-login-btn') {
      cloudPanel.show();
    } else if (btn.id === 'header-mypage-btn') {
      myPagePanel.show();
    } else if (btn.id === 'header-logout-btn') {
      supabaseManager.signOut().then(() => {
        updateHeaderAuth();
        showStatusMessage('로그아웃되었습니다.');
      });
    }
  });

  // 인증 상태 변경 이벤트 구독
  eventBus.on('auth:login', () => updateHeaderAuth());
  eventBus.on('auth:logout', () => updateHeaderAuth());
}

/**
 * 헤더 인증 상태 업데이트
 */
function updateHeaderAuth() {
  const headerAuth = document.getElementById('header-auth');
  if (!headerAuth) return;

  if (supabaseManager.isLoggedIn()) {
    const user = supabaseManager.getUser();
    const isAdmin = supabaseManager.isAdmin();
    headerAuth.innerHTML = `
      <span class="header-user-email">${user.email}${isAdmin ? ' <span class="admin-badge">관리자</span>' : ''}</span>
      <button class="btn btn-sm btn-primary" id="header-mypage-btn">마이페이지</button>
      <button class="btn btn-sm btn-secondary" id="header-logout-btn">로그아웃</button>
    `;
  } else {
    headerAuth.innerHTML = `
      <button class="btn btn-sm btn-primary" id="header-login-btn">로그인</button>
    `;
  }
}

/**
 * 위치 검색 초기화
 */
function initLocationSearch() {
  const searchInput = document.getElementById('location-search-input');
  const searchResults = document.getElementById('search-results');
  const searchClear = document.getElementById('search-clear');

  if (!searchInput || !searchResults) return;

  let debounceTimer = null;
  let selectedIndex = -1;
  let results = [];

  // 입력 이벤트
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();

    // 지우기 버튼 표시/숨김
    searchClear.style.display = query ? 'flex' : 'none';

    // 디바운스
    clearTimeout(debounceTimer);

    if (query.length < 2) {
      hideResults();
      return;
    }

    // 로딩 표시
    searchResults.style.display = 'block';
    searchResults.innerHTML = '<div class="search-loading"></div>';

    debounceTimer = setTimeout(async () => {
      results = await geocodingService.search(query);
      selectedIndex = -1;
      renderResults(results);
    }, 300);
  });

  // 키보드 네비게이션
  searchInput.addEventListener('keydown', (e) => {
    if (!results.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectResult(results[selectedIndex]);
        } else if (results.length > 0) {
          selectResult(results[0]);
        }
        break;
      case 'Escape':
        hideResults();
        searchInput.blur();
        break;
    }
  });

  // 포커스 아웃 시 결과 숨김
  searchInput.addEventListener('blur', () => {
    setTimeout(() => hideResults(), 200);
  });

  // 지우기 버튼
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    hideResults();
    searchInput.focus();
  });

  // 결과 렌더링
  function renderResults(items) {
    if (!items.length) {
      searchResults.innerHTML = '<div class="search-empty"></div>';
      return;
    }

    searchResults.innerHTML = items.map((item, index) => `
      <div class="search-result-item" data-index="${index}">
        <div class="search-result-name">
          ${item.category ? `<span class="search-result-type">${getTypeLabel(item.category)}</span>` : ''}
          ${item.shortName}
        </div>
        <div class="search-result-address">${item.displayName}</div>
      </div>
    `).join('');

    // 클릭 이벤트
    searchResults.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const index = parseInt(el.dataset.index);
        selectResult(results[index]);
      });
    });
  }

  // 선택 상태 업데이트
  function updateSelection() {
    searchResults.querySelectorAll('.search-result-item').forEach((el, idx) => {
      el.classList.toggle('selected', idx === selectedIndex);
      if (idx === selectedIndex) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // 결과 선택 - 지도 이동
  function selectResult(item) {
    hideResults();
    searchInput.value = item.shortName;

    // 지도 이동
    if (item.boundingBox) {
      // boundingBox: [south, north, west, east]
      const extent = [
        parseFloat(item.boundingBox[2]), // west (minX)
        parseFloat(item.boundingBox[0]), // south (minY)
        parseFloat(item.boundingBox[3]), // east (maxX)
        parseFloat(item.boundingBox[1])  // north (maxY)
      ];

      // EPSG:4326 → EPSG:3857 변환
      const transformedExtent = window.ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
      mapManager.fitExtent(transformedExtent, { padding: [50, 50, 50, 50], maxZoom: 18 });
    } else {
      // 중심점으로 이동
      const center = window.ol.proj.fromLonLat([item.lon, item.lat]);
      mapManager.getView().animate({
        center: center,
        zoom: 15,
        duration: 500
      });
    }

    showStatusMessage(`${item.shortName}(으)로 이동했습니다.`);
  }

  // 결과 숨김
  function hideResults() {
    searchResults.style.display = 'none';
    results = [];
    selectedIndex = -1;
  }

  // 카테고리 한글화
  function getTypeLabel(category) {
    const labels = {
      'amenity': '시설',
      'building': '건물',
      'place': '장소',
      'highway': '도로',
      'natural': '자연',
      'tourism': '관광',
      'shop': '상점',
      'office': '사무실',
      'leisure': '레저',
      'boundary': '경계',
      'landuse': '토지',
      'waterway': '수로'
    };
    return labels[category] || category;
  }
}

// DOM 로드 완료 후 앱 초기화
document.addEventListener('DOMContentLoaded', initApp);
