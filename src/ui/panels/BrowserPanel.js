/**
 * BrowserPanel - 파일 브라우저 패널 (드래그 앤 드롭)
 */

import { geojsonLoader } from '../../loaders/GeoJSONLoader.js';
import { shapefileLoader } from '../../loaders/ShapefileLoader.js';
import { geopackageLoader } from '../../loaders/GeoPackageLoader.js';
import { demLoader } from '../../loaders/DEMLoader.js';
import { eventBus } from '../../utils/EventBus.js';

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
    this.fileInput.accept = '.geojson,.json,.zip,.shp,.dbf,.shx,.prj,.gpkg,.tif,.tiff';
    this.fileInput.multiple = true;
    this.fileInput.style.display = 'none';
    document.body.appendChild(this.fileInput);

    this.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      this.fileInput.value = ''; // 리셋
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

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    // 전체 윈도우에서도 드롭 가능하게
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      // 드롭 존 바깥에서 드롭한 경우에도 처리
      if (!this.dropZone.contains(e.target)) {
        this.handleFiles(e.dataTransfer.files);
      }
    });
  }

  /**
   * 파일 처리
   */
  async handleFiles(fileList) {
    const files = Array.from(fileList);

    for (const file of files) {
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
        // DEM (GeoTIFF)
        return await demLoader.loadFromFile(file);

      default:
        throw new Error('지원하지 않는 파일 형식입니다. (GeoJSON, ZIP, GPKG, TIF 지원)');
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
