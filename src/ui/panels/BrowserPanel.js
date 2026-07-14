/**
 * BrowserPanel - 파일 브라우저 패널 (드래그 앤 드롭)
 */

import { geojsonLoader } from '../../loaders/GeoJSONLoader.js';
import { shapefileLoader } from '../../loaders/ShapefileLoader.js';
import { geopackageLoader } from '../../loaders/GeoPackageLoader.js';
import { demLoader } from '../../loaders/DEMLoader.js';
import { eventBus } from '../../utils/EventBus.js';
import { collectFilesFromDrop, isShapefileComponent } from '../../utils/fileCollector.js';

export class BrowserPanel {
  constructor(dropZoneId = 'file-drop-zone') {
    this.dropZone = document.getElementById(dropZoneId);
    this.fileInput = null;
    this.init();
  }

  init() {
    this.createFileInput();
    this.bindEvents();
  }

  /**
   * 숨겨진 파일 입력 생성
   */
  createFileInput() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    // .img 파일 호환성을 위해 accept를 넓게 설정
    // 확장자 기반 필터링은 loadFile에서 처리
    this.fileInput.accept = '.geojson,.json,.zip,.shp,.dbf,.shx,.prj,.gpkg,.tif,.tiff,.img,image/tiff,application/octet-stream,*/*';
    this.fileInput.multiple = true;
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (e) => {
      this.loadFiles(e.target.files);
      this.fileInput.value = ''; // 리셋
    });

    // 폴더 선택용 입력 (webkitdirectory) - QGIS처럼 폴더만 골라도 shp+dbf까지 로드
    this.folderInput = document.createElement('input');
    this.folderInput.type = 'file';
    this.folderInput.webkitdirectory = true;
    this.folderInput.multiple = true;
    this.folderInput.style.display = 'none';
    document.body.appendChild(this.folderInput);

    this.folderInput.addEventListener('change', (e) => {
      this.loadFiles(e.target.files);
      this.folderInput.value = '';
    });
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 클릭으로 파일 선택
    this.dropZone.addEventListener('click', () => {
      this.fileInput.click();
    });

    // 폴더 통째로 열기 버튼
    const folderBtn = document.getElementById('btn-open-folder');
    if (folderBtn) {
      folderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.folderInput.click();
      });
    }

    // 드래그 앤 드롭
    this.dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.add('dragover');
    });

    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.add('dragover');
    });

    this.dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.remove('dragover');
    });

    this.dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.remove('dragover');
      // 폴더 드롭 시 내부 파일까지 재귀 수집 (동기적으로 엔트리 확보)
      const files = await collectFilesFromDrop(e.dataTransfer);
      this.loadFiles(files);
    });

    // 전체 윈도우에서도 드롭 가능하게
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      // 드롭 존 바깥에서 드롭한 경우에도 처리
      if (!this.dropZone.contains(e.target)) {
        const files = await collectFilesFromDrop(e.dataTransfer);
        this.loadFiles(files);
      }
    });
  }

  /**
   * 파일 처리 (하위 호환용 별칭)
   */
  async handleFiles(fileList) {
    return this.loadFiles(fileList);
  }

  /**
   * 파일 목록 로드
   * - shapefile 구성 파일(shp/dbf/shx/prj/cpg)은 basename별로 묶어 한 번에 로드
   * - 나머지 파일은 확장자별 로더로 개별 로드
   */
  async loadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const shpComponents = files.filter((f) => isShapefileComponent(f.name));
    const others = files.filter((f) => !isShapefileComponent(f.name));

    // shapefile 세트 일괄 로드
    if (shpComponents.length > 0) {
      try {
        const ids = await shapefileLoader.loadFromFiles(shpComponents);
        if (ids && ids.length > 0) {
          this.showMessage(`Shapefile ${ids.length}개 레이어 로드 완료`, 'success');
        } else {
          this.showMessage('.shp 파일을 찾지 못했습니다. (.dbf/.shx만으로는 로드 불가)', 'error');
        }
      } catch (error) {
        console.error('Shapefile 로드 실패:', error);
        this.showMessage(`Shapefile 로드 실패: ${error.message}`, 'error');
      }
    }

    // 나머지 파일 개별 로드
    for (const file of others) {
      try {
        await this.loadFile(file);
        this.showMessage(`${file.name} 로드 완료`, 'success');
      } catch (error) {
        console.error('파일 로드 실패:', error);
        this.showMessage(`${file.name}: ${error.message}`, 'error');
      }
    }
  }

  /**
   * 파일 타입에 따라 로더 선택
   */
  async loadFile(file) {
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
        // Shapefile (ZIP 또는 개별 파일)
        return await shapefileLoader.loadFromFile(file);

      case 'gpkg':
        // GeoPackage
        return await geopackageLoader.loadFromFile(file);

      case 'tif':
      case 'tiff':
      case 'img':
        // DEM (GeoTIFF, ERDAS IMAGINE)
        return await demLoader.loadFromFile(file);

      default:
        throw new Error('지원하지 않는 파일 형식입니다. (GeoJSON, ZIP, GPKG, TIF, IMG 지원)');
    }
  }

  /**
   * 상태 메시지 표시
   */
  showMessage(message, type = 'info') {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;

      // 색상 설정
      if (type === 'error') {
        statusEl.style.color = 'var(--color-danger)';
      } else if (type === 'success') {
        statusEl.style.color = 'var(--color-accent)';
      } else {
        statusEl.style.color = '';
      }

      // 3초 후 리셋
      setTimeout(() => {
        statusEl.textContent = '준비';
        statusEl.style.color = '';
      }, 3000);
    }
  }
}
