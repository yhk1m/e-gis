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
import { autoSaveManager } from './core/AutoSaveManager.js';
import { historyManager } from './core/HistoryManager.js';
import { selectTool } from './tools/SelectTool.js';
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
import { layerExportPanel } from './ui/panels/LayerExportPanel.js';
import { cartogramPanel } from './ui/panels/CartogramPanel.js';
import { cloudPanel } from './ui/panels/CloudPanel.js';
import { myPagePanel } from './ui/panels/MyPagePanel.js';
import { supabaseManager } from './core/SupabaseManager.js';
import { geocodingService } from './services/GeocodingService.js';
import { fromLonLat } from 'ol/proj';
import { transformExtent } from 'ol/proj';
import GeoJSON from 'ol/format/GeoJSON';
import { geojsonLoader } from './loaders/GeoJSONLoader.js';
import { shapefileLoader } from './loaders/ShapefileLoader.js';
import { geopackageLoader } from './loaders/GeoPackageLoader.js';
import { demLoader } from './loaders/DEMLoader.js';

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

  // 11.5 도움말 버튼 이벤트
  const btnHelp = document.getElementById('btn-help');
  if (btnHelp) {
    btnHelp.addEventListener('click', () => showUserManual());
  }

  // 11.6 최근 파일 목록 초기화
  updateRecentFilesUI();

  // 12. 키보드 단축키 설정
  document.addEventListener('keydown', (e) => {
    // 입력 필드에서는 단축키 무시
    const activeEl = document.activeElement;
    const isInputField = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    );

    // Ctrl+Z: 실행 취소
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey && !isInputField) {
      e.preventDefault();
      if (historyManager.undo()) {
        showStatusMessage('실행 취소되었습니다.');
      }
      return;
    }

    // Ctrl+Shift+Z 또는 Ctrl+Y: 다시 실행
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      if (!isInputField && historyManager.redo()) {
        showStatusMessage('다시 실행되었습니다.');
      }
      return;
    }

    // Ctrl+A: 전체 선택
    if (e.ctrlKey && e.key === 'a' && !isInputField) {
      e.preventDefault();
      selectTool.selectAll();
      return;
    }

    // Ctrl+C: 복사
    if (e.ctrlKey && e.key === 'c' && !isInputField) {
      const selectedFeatures = selectTool.getSelectedFeatures();
      if (selectedFeatures.length > 0) {
        e.preventDefault();
        copyFeaturesToClipboard(selectedFeatures);
      }
      return;
    }

    // Ctrl+V: 붙여넣기
    if (e.ctrlKey && e.key === 'v' && !isInputField) {
      e.preventDefault();
      pasteFromClipboard();
      return;
    }

    // Delete: 선택된 레이어 삭제 (다중 선택 지원)
    if (e.key === 'Delete' && !isInputField) {
      const selectedIds = layerManager.getSelectedLayerIds();
      if (selectedIds.length > 0) {
        const layers = selectedIds.map(id => layerManager.getLayer(id)).filter(Boolean);
        const layerNames = layers.map(l => l.name).join(', ');
        const message = selectedIds.length === 1
          ? `"${layerNames}" 레이어를 삭제하시겠습니까?`
          : `${selectedIds.length}개 레이어를 삭제하시겠습니까?\n(${layerNames})`;

        if (confirm(message)) {
          selectedIds.forEach(id => layerManager.removeLayer(id));
          showStatusMessage(`${selectedIds.length}개 레이어가 삭제되었습니다.`);
        }
      }
    }
  });

  // 레이어 추가 버튼 이벤트 (파일 추가)
  const btnAddLayer = document.getElementById('btn-add-layer');
  if (btnAddLayer) {
    btnAddLayer.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.geojson,.json,.zip,.shp,.dbf,.shx,.prj,.gpkg,.tif,.tiff,.img,image/tiff,application/octet-stream,*/*';
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
            // 최근 파일에 추가
            const ext = file.name.split('.').pop().toLowerCase();
            addRecentFile(file.name, ext);
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
  const scaleInput = document.getElementById('scale-input');
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
    if (document.activeElement !== scaleInput) {
      scaleInput.value = formatScale(scale);
    }
  });

  // CRS 변경 시 표시 업데이트
  eventBus.on(Events.CRS_CHANGED, ({ crs }) => {
    updateCRSDisplay(crs);
  });

  // 초기 축척 표시
  setTimeout(() => {
    const scale = mapManager.getScale();
    scaleInput.value = formatScale(scale);
  }, 100);

  // 축척 입력 처리
  if (scaleInput) {
    // Enter 키로 축척 적용
    scaleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyScaleFromInput(scaleInput);
        scaleInput.blur();
      } else if (e.key === 'Escape') {
        // ESC로 취소하고 현재 축척으로 복원
        const scale = mapManager.getScale();
        scaleInput.value = formatScale(scale);
        scaleInput.blur();
      }
    });

    // 포커스 아웃 시 축척 적용
    scaleInput.addEventListener('blur', () => {
      applyScaleFromInput(scaleInput);
    });

    // 클릭 시 전체 선택
    scaleInput.addEventListener('focus', () => {
      scaleInput.select();
    });
  }

  // CRS 선택 드롭다운 초기화
  if (crsEl) {
    initCRSSelector(crsEl);
  }
}

/**
 * 입력된 축척 값을 지도에 적용
 */
function applyScaleFromInput(inputEl) {
  const inputValue = inputEl.value.replace(/,/g, '').trim();
  const targetScale = parseInt(inputValue, 10);

  if (isNaN(targetScale) || targetScale <= 0) {
    // 유효하지 않은 값이면 현재 축척으로 복원
    const scale = mapManager.getScale();
    inputEl.value = formatScale(scale);
    return;
  }

  // 축척을 줌 레벨로 변환하여 적용
  const targetZoom = mapManager.scaleToZoom(targetScale);
  if (targetZoom !== null) {
    mapManager.getView().animate({
      zoom: targetZoom,
      duration: 300
    });
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
 * 축척 포맷팅 (천 단위 콤마)
 */
function formatScale(scale) {
  return Math.round(scale).toLocaleString('ko-KR');
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
    case 'project-export':
      exportPanel.show();
      break;

    // ===== 편집 메뉴 =====
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
    case 'layer-export':
      layerExportPanel.show();
      break;
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
    case 'analysis-cartogram':
      cartogramPanel.show();
      break;
    case 'analysis-isochrone':
      isochronePanel.show();
      break;
    case 'analysis-routing':
      routingPanel.show();
      break;

    // ===== 래스터 분석 메뉴 (준비중) =====
    case 'raster-coming-soon':
      showComingSoonModal('래스터 분석');
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
    case 'tif':
    case 'tiff':
    case 'img':
      return await demLoader.loadFromFile(file);
    default:
      throw new Error('지원하지 않는 파일 형식입니다. (GeoJSON, ZIP, GPKG, TIF, IMG 지원)');
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
 * 준비중 모달 표시
 */
function showComingSoonModal(featureName) {
  // 기존 모달이 있으면 제거
  const existingModal = document.getElementById('coming-soon-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div class="modal-overlay active" id="coming-soon-modal">
      <div class="modal" style="width: 300px;">
        <div class="modal-header">
          <h3>${featureName}</h3>
          <button class="modal-close" id="coming-soon-close">&times;</button>
        </div>
        <div class="modal-body" style="padding: var(--spacing-lg); text-align: center;">
          <p style="margin: 0; color: var(--text-secondary);">준비중입니다.</p>
        </div>
        <div class="modal-footer" style="padding: var(--spacing-md) var(--spacing-lg); border-top: 1px solid var(--border-color); text-align: right;">
          <button class="btn btn-primary btn-sm" id="coming-soon-ok">확인</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('coming-soon-modal');
  const closeBtn = document.getElementById('coming-soon-close');
  const okBtn = document.getElementById('coming-soon-ok');

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 200);
  };

  closeBtn.addEventListener('click', closeModal);
  okBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
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
      const transformedExtent = transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
      mapManager.fitExtent(transformedExtent, { padding: [50, 50, 50, 50], maxZoom: 18 });
    } else {
      // 중심점으로 이동
      const center = fromLonLat([item.lon, item.lat]);
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

/**
 * 헤더 인증 버튼 이벤트 초기화
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

// 클립보드 (피처 복사/붙여넣기용)
let featureClipboard = [];

// 최근 파일 관리 (최대 5개)
const RECENT_FILES_KEY = 'egis_recent_files';
const MAX_RECENT_FILES = 5;

/**
 * 최근 파일 목록 가져오기
 */
function getRecentFiles() {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * 최근 파일 추가
 */
function addRecentFile(fileName, fileType) {
  const recentFiles = getRecentFiles();

  // 동일한 파일이 있으면 제거
  const filtered = recentFiles.filter(f => f.name !== fileName);

  // 앞에 추가
  filtered.unshift({
    name: fileName,
    type: fileType,
    timestamp: Date.now()
  });

  // 최대 개수 제한
  const limited = filtered.slice(0, MAX_RECENT_FILES);

  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(limited));
  updateRecentFilesUI();
}

/**
 * 최근 파일 UI 업데이트
 */
function updateRecentFilesUI() {
  const recentFilesList = document.getElementById('recent-files-list');
  if (!recentFilesList) return;

  const recentFiles = getRecentFiles();

  if (recentFiles.length === 0) {
    recentFilesList.innerHTML = '<div class="dropdown-item disabled">최근 파일 없음</div>';
    return;
  }

  recentFilesList.innerHTML = recentFiles.map((file, index) => `
    <div class="dropdown-item" data-action="recent-file" data-index="${index}" title="${file.name}">
      ${file.name}
    </div>
  `).join('');
}

/**
 * 피처를 클립보드에 복사
 */
function copyFeaturesToClipboard(features) {
  if (!features || features.length === 0) {
    showStatusMessage('복사할 피처가 없습니다.');
    return;
  }

  // GeoJSON 형식으로 피처 복사
  const geojsonFormat = new GeoJSON();
  featureClipboard = features.map(feature => {
    return geojsonFormat.writeFeatureObject(feature, {
      featureProjection: 'EPSG:3857'
    });
  });

  showStatusMessage(`${features.length}개 피처가 복사되었습니다.`);
}

/**
 * 클립보드에서 피처 붙여넣기
 */
function pasteFromClipboard() {
  if (featureClipboard.length === 0) {
    showStatusMessage('붙여넣을 피처가 없습니다.');
    return;
  }

  const selectedLayerId = layerManager.getSelectedLayerId();
  if (!selectedLayerId) {
    showStatusMessage('붙여넣을 레이어를 먼저 선택하세요.');
    return;
  }

  const layerInfo = layerManager.getLayer(selectedLayerId);
  if (!layerInfo) return;

  const geojsonFormat = new GeoJSON();

  featureClipboard.forEach(featureObj => {
    // 약간 오프셋을 주어 구분 가능하게 함
    const clonedObj = JSON.parse(JSON.stringify(featureObj));

    const feature = geojsonFormat.readFeature(clonedObj, {
      featureProjection: 'EPSG:3857'
    });

    // 새 ID 부여
    feature.setId(Date.now() + '_' + Math.random().toString(36).substr(2, 9));

    layerInfo.source.addFeature(feature);
  });

  layerInfo.featureCount = layerInfo.source.getFeatures().length;
  eventBus.emit(Events.LAYER_ADDED, {});

  showStatusMessage(`${featureClipboard.length}개 피처가 붙여넣기 되었습니다.`);
}

/**
 * 상세 사용 설명서 표시
 */
function showUserManual() {
  const existingModal = document.getElementById('manual-modal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div class="modal-overlay active" id="manual-modal">
      <div class="modal" style="width: 800px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>e-GIS 사용 설명서</h3>
          <button class="modal-close" id="manual-close">&times;</button>
        </div>
        <div class="modal-body" style="padding: var(--spacing-lg); line-height: 2.0;">
          <style>
            #manual-modal ul, #manual-modal p { padding-left: 24px; margin: 8px 0; }
            #manual-modal li { margin: 4px 0; }
          </style>

          <h4 style="margin-top: 0; color: var(--primary-color);">📍 1. 시작하기</h4>
          <p>e-GIS는 교육용 GIS 웹 애플리케이션입니다. 별도의 설치 없이 웹 브라우저에서 바로 사용할 수 있습니다.</p>

          <h4 style="margin-top: 24px; color: var(--primary-color);">📂 2. 파일 불러오기</h4>
          <ul>
            <li><strong>지원 형식:</strong> GeoJSON(.geojson, .json), Shapefile(.zip), GeoPackage(.gpkg), DEM(.tif, .tiff, .img)</li>
            <li><strong>방법 1:</strong> 좌측 패널의 "+" 버튼 클릭 → 파일 선택</li>
            <li><strong>방법 2:</strong> 좌측 "파일 브라우저" 탭에서 파일 드래그 앤 드롭</li>
            <li><strong>방법 3:</strong> 메뉴 → 프로젝트 → 열기로 프로젝트 파일(.egis) 불러오기</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">🗺️ 3. 지도 조작</h4>
          <ul>
            <li><strong>이동:</strong> 마우스 드래그 또는 화살표 키</li>
            <li><strong>확대/축소:</strong> 마우스 휠 또는 툴바의 +/- 버튼</li>
            <li><strong>전체 보기:</strong> 툴바의 지구본 버튼</li>
            <li><strong>위치 검색:</strong> 상단 검색창에 주소나 장소명 입력</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">📋 4. 레이어 관리</h4>
          <ul>
            <li><strong>선택:</strong> 레이어 패널에서 레이어 클릭 (Shift+클릭으로 다중 선택)</li>
            <li><strong>표시/숨기기:</strong> 레이어 이름 왼쪽 눈 아이콘 클릭</li>
            <li><strong>순서 변경:</strong> 레이어를 드래그하여 순서 변경</li>
            <li><strong>삭제:</strong> 레이어 선택 후 Delete 키</li>
            <li><strong>속성 편집:</strong> 레이어 선택 후 메뉴 → 레이어 → 속성 테이블</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">✏️ 5. 도형 그리기</h4>
          <ul>
            <li><strong>점(Point):</strong> 툴바에서 점 도구 선택 → 지도에서 클릭</li>
            <li><strong>선(Line):</strong> 툴바에서 선 도구 선택 → 클릭으로 꼭짓점 추가, 더블클릭으로 완료</li>
            <li><strong>폴리곤(Polygon):</strong> 툴바에서 폴리곤 도구 선택 → 클릭으로 꼭짓점 추가, 더블클릭으로 완료</li>
            <li><strong>멀티포인트(MultiPoint):</strong> 툴바에서 멀티포인트 도구 선택 → 여러 점 클릭, 더블클릭으로 완료</li>
            <li><strong>멀티라인(MultiLine):</strong> 툴바에서 멀티라인 도구 선택 → 여러 선 그리기, 더블클릭으로 각 선 완료</li>
            <li><strong>멀티폴리곤(MultiPolygon):</strong> 툴바에서 멀티폴리곤 도구 선택 → 여러 폴리곤 그리기, 더블클릭으로 각 폴리곤 완료</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">🔍 6. 피처 선택 및 편집</h4>
          <ul>
            <li><strong>선택:</strong> 툴바에서 선택 도구 → 피처 클릭</li>
            <li><strong>다중 선택:</strong> Shift+클릭</li>
            <li><strong>전체 선택:</strong> Ctrl+A</li>
            <li><strong>수정:</strong> 선택 후 꼭짓점 드래그</li>
            <li><strong>삭제:</strong> 선택 후 Delete 키</li>
            <li><strong>복사/붙여넣기:</strong> Ctrl+C / Ctrl+V</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">📊 7. 속성 테이블</h4>
          <ul>
            <li><strong>열기:</strong> 레이어 선택 → 메뉴 → 레이어 → 속성 테이블</li>
            <li><strong>행 선택:</strong> 행 클릭 (Shift+클릭으로 범위 선택, Ctrl+클릭으로 개별 추가)</li>
            <li><strong>전체 선택:</strong> 체크박스 헤더 클릭</li>
            <li><strong>셀 편집:</strong> 셀 더블클릭 → 값 입력 → Enter</li>
            <li><strong>피처 삭제:</strong> 행 선택 후 삭제 버튼</li>
            <li><strong>지도에서 보기:</strong> 행 선택 후 "지도에서 보기" 버튼</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">📐 8. 측정</h4>
          <ul>
            <li><strong>거리 측정:</strong> 메뉴 → 측정 → 거리 측정 → 지도에서 클릭</li>
            <li><strong>면적 측정:</strong> 메뉴 → 측정 → 면적 측정 → 폴리곤 그리기</li>
            <li><strong>측정 삭제:</strong> 메뉴 → 측정 → 측정 결과 지우기</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">🎨 9. 시각화</h4>
          <p style="color: var(--text-secondary); font-style: italic; margin-bottom: 8px;">※ 아래 기능들은 먼저 좌측 레이어 패널에서 대상 레이어를 선택한 후 실행해야 합니다.</p>
          <ul>
            <li><strong>단계구분도:</strong> 레이어 선택 → 메뉴 → 벡터 분석 → 단계구분도 (수치 속성 기반 색상 표현)</li>
            <li><strong>도형표현도:</strong> 레이어 선택 → 메뉴 → 벡터 분석 → 도형표현도 (파이/막대 차트 오버레이)</li>
            <li><strong>히트맵:</strong> 메뉴 → 벡터 분석 → 히트맵 (점 데이터 밀도 시각화)</li>
            <li><strong>카토그램:</strong> 메뉴 → 벡터 분석 → 카토그램 (면적 왜곡 시각화)</li>
            <li><strong>라벨:</strong> 레이어 선택 → 메뉴 → 레이어 → 라벨 설정</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">🔧 10. 공간 분석</h4>
          <p style="color: var(--text-secondary); font-style: italic; margin-bottom: 8px;">※ 버퍼, 테이블 결합, 필드 계산기는 먼저 레이어를 선택해야 합니다.</p>
          <ul>
            <li><strong>버퍼:</strong> 레이어 선택 → 메뉴 → 벡터 분석 → 버퍼 분석</li>
            <li><strong>공간 연산:</strong> 메뉴 → 벡터 분석 → 공간 연산 (합집합, 교집합, 차집합, 클리핑)</li>
            <li><strong>테이블 결합:</strong> 레이어 선택 → 메뉴 → 레이어 → 테이블 결합</li>
            <li><strong>필드 계산기:</strong> 레이어 선택 → 메뉴 → 레이어 → 필드 계산기</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">🛣️ 11. 경로 분석</h4>
          <ul>
            <li><strong>등시선 분석:</strong> 메뉴 → 벡터 분석 → 등시선 분석 (이동 시간 영역)</li>
            <li><strong>최단경로 분석:</strong> 메뉴 → 벡터 분석 → 최단경로 분석</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">💾 12. 저장 및 내보내기</h4>
          <ul>
            <li><strong>프로젝트 저장:</strong> 메뉴 → 프로젝트 → 저장 (.egis 파일)</li>
            <li><strong>레이어 내보내기:</strong> 레이어 선택 → 메뉴 → 레이어 → 레이어 내보내기 (GeoJSON, Shapefile)</li>
            <li><strong>지도 이미지 내보내기:</strong> 메뉴 → 프로젝트 → 지도 내보내기</li>
          </ul>

          <h4 style="margin-top: 24px; color: var(--primary-color);">💡 13. 팁</h4>
          <ul>
            <li>상태 표시줄에서 현재 좌표와 축척을 확인할 수 있습니다.</li>
            <li>축척 입력란에 직접 숫자를 입력하여 원하는 축척으로 이동할 수 있습니다.</li>
            <li>좌표계는 상태 표시줄 우측에서 변경할 수 있습니다 (WGS84, UTM-K 등).</li>
            <li>다크 모드는 우측 상단의 테마 버튼으로 전환합니다.</li>
            <li>북마크 기능으로 자주 사용하는 위치를 저장할 수 있습니다.</li>
          </ul>

          <div style="margin-top: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
            <strong>문의:</strong> cnsageo@cnsa.hs.kr<br>
            <strong>버전:</strong> e-GIS v0.1.0
          </div>
        </div>
        <div class="modal-footer" style="padding: var(--spacing-md) var(--spacing-lg); border-top: 1px solid var(--border-color); text-align: right;">
          <button class="btn btn-primary" id="manual-ok">닫기</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('manual-modal');
  const closeBtn = document.getElementById('manual-close');
  const okBtn = document.getElementById('manual-ok');

  const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 200);
  };

  closeBtn.addEventListener('click', closeModal);
  okBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// DOM 로드 완료 후 앱 초기화
document.addEventListener('DOMContentLoaded', initApp);
