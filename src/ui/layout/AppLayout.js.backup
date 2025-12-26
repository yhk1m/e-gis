/**
 * AppLayout - 전체 앱 레이아웃 구조 생성
 */

export class AppLayout {
  constructor(containerId = 'app') {
    this.container = document.getElementById(containerId);
  }

  /**
   * 레이아웃 HTML 생성 및 삽입
   */
  render() {
    this.container.innerHTML = `
      <!-- 메뉴바 -->
      <header id="menubar">
        <div class="menu-left">
          <span class="app-title">eGIS</span>
        </div>
        <div class="menu-center">
          <div class="menu-items">
            <div class="menu-item dropdown" data-menu="project">
              <button class="menu-button">프로젝트</button>
              <div class="dropdown-menu" id="menu-project">
                <div class="dropdown-item" data-action="project-new">새 프로젝트</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="project-open">열기...</div>
                <div class="dropdown-item" data-action="project-save">저장</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="edit">
              <button class="menu-button">편집</button>
              <div class="dropdown-menu" id="menu-edit">
                <div class="dropdown-item" data-action="edit-undo">실행 취소</div>
                <div class="dropdown-item" data-action="edit-redo">다시 실행</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="edit-delete">선택 피처 삭제</div>
                <div class="dropdown-item" data-action="edit-select-all">모두 선택</div>
                <div class="dropdown-item" data-action="edit-deselect">선택 해제</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="view">
              <button class="menu-button">보기</button>
              <div class="dropdown-menu" id="menu-view">
                <div class="dropdown-item" data-action="view-zoom-in">확대</div>
                <div class="dropdown-item" data-action="view-zoom-out">축소</div>
                <div class="dropdown-item" data-action="view-full-extent">전체 범위</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="view-zoom-layer">선택 레이어로 이동</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="view-toggle-panel">패널 표시/숨기기</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="layer">
              <button class="menu-button">레이어</button>
              <div class="dropdown-menu" id="menu-layer">
                <div class="dropdown-item" data-action="layer-add">새 레이어</div>
                <div class="dropdown-item" data-action="layer-remove">레이어 삭제</div>
                <div class="dropdown-item" data-action="layer-rename">이름 변경</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-attribute-table">속성 테이블</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="layer-clear-all">모든 레이어 삭제</div>
              </div>
            </div>
            <div class="menu-item dropdown" data-menu="analysis">
              <button class="menu-button">분석</button>
              <div class="dropdown-menu" id="menu-analysis">
                <div class="dropdown-item" data-action="analysis-measure-distance">거리 측정</div>
                <div class="dropdown-item" data-action="analysis-measure-area">면적 측정</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" data-action="analysis-clear-measures">측정 결과 지우기</div>
              </div>
            </div>
          </div>
        </div>
        <div class="menu-right">
          <button id="theme-toggle" class="theme-toggle" title="테마 전환">
            <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </header>

      <!-- 툴바 -->
      <div id="toolbar">
        <div class="toolbar-group" data-group="navigation">
          <button class="btn-icon" data-tool="pan" title="이동">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="zoom-in" title="확대">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button class="btn-icon" data-tool="zoom-out" title="축소">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
          <button class="btn-icon" data-tool="zoom-extent" title="전체 범위">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="select">
          <button class="btn-icon" data-tool="select" title="선택">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="draw">
          <button class="btn-icon" data-tool="draw-point" title="점 그리기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-line" title="선 그리기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="19" x2="19" y2="5"/>
              <circle cx="5" cy="19" r="2" fill="currentColor"/>
              <circle cx="19" cy="5" r="2" fill="currentColor"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="draw-polygon" title="면 그리기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-group" data-group="measure">
          <button class="btn-icon" data-tool="measure-distance" title="거리 측정">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"/>
            </svg>
          </button>
          <button class="btn-icon" data-tool="measure-area" title="면적 측정">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 3v18"/>
            </svg>
          </button>
        </div>

        <div class="toolbar-spacer"></div>
      </div>

      <!-- 메인 컨테이너 -->
      <div id="main-container">
        <!-- 왼쪽 패널 -->
        <aside id="left-panel">
          <!-- 브라우저 패널 -->
          <div id="browser-panel">
            <div class="panel-header">
              <span class="panel-header-title">브라우저</span>
            </div>
            <div class="panel-content">
              <div class="file-drop-zone" id="file-drop-zone">
                <p>파일을 드래그하거나 클릭하여 업로드</p>
                <p class="file-types">GeoJSON, SHP, GPKG</p>
              </div>
            </div>
          </div>

          <!-- 레이어 패널 -->
          <div id="layer-panel">
            <div class="panel-header">
              <span class="panel-header-title">레이어</span>
              <div class="panel-header-actions">
                <button class="btn-icon btn-small" title="레이어 추가">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="panel-content">
              <ul id="layer-list" class="layer-list">
                <!-- 레이어 항목들이 여기에 동적으로 추가됨 -->
              </ul>
            </div>
          </div>
        </aside>

        <!-- 패널 리사이저 -->
        <div class="panel-resizer" id="panel-resizer"></div>

        <!-- 지도 컨테이너 -->
        <main id="map-container">
          <div id="map"></div>
        </main>
      </div>

      <!-- 상태표시줄 -->
      <footer id="statusbar">
        <div class="statusbar-item coordinates" id="status-coords">
          <span class="coord-label">좌표:</span>
          <span class="coord-value">---, ---</span>
        </div>
        <div class="statusbar-item scale" id="status-scale">
          <span class="scale-label">축척:</span>
          <span class="scale-value">---</span>
        </div>
        <div class="statusbar-item crs" id="status-crs" title="좌표계 변경">
          <span class="crs-value">EPSG:4326</span>
        </div>
        <div class="statusbar-spacer"></div>
        <div class="statusbar-item">
          <span id="status-message">준비</span>
        </div>
      </footer>
    `;

    this.addStyles();
    this.initResizer();
  }

  /**
   * 추가 스타일 삽입
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* 메뉴바 스타일 */
      #menubar {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .app-title {
        font-weight: 700;
        font-size: var(--font-size-lg);
        color: var(--color-primary);
        margin-right: var(--spacing-lg);
      }

      .menu-items {
        display: flex;
        gap: var(--spacing-xs);
      }

      .menu-button {
        padding: var(--spacing-xs) var(--spacing-sm);
        font-size: var(--font-size-sm);
        border-radius: var(--radius-sm);
        transition: background var(--transition-fast);
      }

      .menu-button:hover {
        background: var(--bg-hover);
      }

      /* 테마 아이콘 전환 */
      [data-theme="dark"] .icon-sun {
        display: none !important;
      }
      [data-theme="dark"] .icon-moon {
        display: block !important;
      }
      [data-theme="light"] .icon-sun,
      :root .icon-sun {
        display: block !important;
      }
      [data-theme="light"] .icon-moon,
      :root .icon-moon {
        display: none !important;
      }

      /* 툴바 스타일 */
      .toolbar-spacer {
        flex: 1;
      }

      /* 파일 드롭 존 */
      .file-drop-zone {
        border: 2px dashed var(--border-color);
        border-radius: var(--radius-md);
        padding: var(--spacing-lg);
        text-align: center;
        color: var(--text-muted);
        font-size: var(--font-size-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .file-drop-zone:hover,
      .file-drop-zone.dragover {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
      }

      .file-drop-zone .file-types {
        font-size: var(--font-size-xs);
        margin-top: var(--spacing-xs);
      }

      /* 레이어 리스트 */
      .layer-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .layer-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-sm);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--transition-fast);
      }

      .layer-item:hover {
        background: var(--bg-hover);
      }

      .layer-item.selected {
        background: var(--bg-selected);
      }

      .layer-item input[type="checkbox"] {
        margin: 0;
      }

      .layer-item .layer-name {
        flex: 1;
        font-size: var(--font-size-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* 작은 버튼 */
      .btn-small {
        width: 22px;
        height: 22px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 패널 리사이저 초기화
   */
  initResizer() {
    const resizer = document.getElementById('panel-resizer');
    const leftPanel = document.getElementById('left-panel');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizer.classList.add('active');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      const minWidth = parseInt(getComputedStyle(leftPanel).minWidth);
      const maxWidth = parseInt(getComputedStyle(leftPanel).maxWidth);

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        leftPanel.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // 지도 크기 갱신 이벤트 발생
        window.dispatchEvent(new Event('resize'));
      }
    });
  }
}
