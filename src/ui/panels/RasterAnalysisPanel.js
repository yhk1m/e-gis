/**
 * RasterAnalysisPanel - 래스터 분석 패널
 * DEM 분석 기능 UI
 */

import { rasterAnalysisTool } from '../../tools/RasterAnalysisTool.js';

class RasterAnalysisPanel {
  constructor() {
    this.modal = null;
    this.currentAnalysis = null;
  }

  /**
   * 해발고도(지형음영) 분석 패널 — 고도색 + 음영기복 결합
   */
  showTerrain() {
    this.currentAnalysis = 'terrain';
    this.render();
  }

  /**
   * 래스터 계산기(값 필터) 패널
   */
  showRasterFilter() {
    this.currentAnalysis = 'filter';
    this.render();
  }

  /**
   * Slope 분석 패널
   */
  showSlope() {
    this.currentAnalysis = 'slope';
    this.render();
  }

  /**
   * Aspect 분석 패널
   */
  showAspect() {
    this.currentAnalysis = 'aspect';
    this.render();
  }

  /**
   * Contour 생성 패널
   */
  showContour() {
    this.currentAnalysis = 'contour';
    this.render();
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    const demLayers = rasterAnalysisTool.getDEMLayers();

    if (demLayers.length === 0) {
      alert('DEM 레이어가 없습니다. GeoTIFF 파일을 먼저 불러와주세요.');
      return;
    }

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay raster-analysis-modal active';
    this.modal.innerHTML = this.getModalHTML(demLayers);
    document.body.appendChild(this.modal);

    this.bindEvents();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(demLayers) {
    const layerOptions = demLayers.map(l =>
      `<option value="${l.id}">${l.name}</option>`
    ).join('');

    let title, bodyHTML;

    switch (this.currentAnalysis) {
      case 'terrain':
        title = '해발고도 (지형음영)';
        bodyHTML = this.getTerrainHTML(layerOptions);
        break;
      case 'filter':
        title = '래스터 계산기 (값 필터)';
        bodyHTML = this.getRasterFilterHTML(layerOptions);
        break;
      case 'slope':
        title = '경사도 (Slope)';
        bodyHTML = this.getSlopeHTML(layerOptions);
        break;
      case 'aspect':
        title = '경사방향 (Aspect)';
        bodyHTML = this.getAspectHTML(layerOptions);
        break;
      case 'contour':
        title = '등고선 생성';
        bodyHTML = this.getContourHTML(layerOptions);
        break;
      default:
        title = '래스터 분석';
        bodyHTML = '';
    }

    return `
      <div class="modal-content raster-analysis-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="raster-close">&times;</button>
        </div>
        <div class="modal-body">
          ${bodyHTML}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="raster-cancel">취소</button>
          <button class="btn btn-primary" id="raster-apply">분석 실행</button>
        </div>
      </div>
    `;
  }

  /**
   * 해발고도(지형음영) HTML — 고도색 + 음영기복 결합
   */
  getTerrainHTML(layerOptions) {
    return `
      <div class="analysis-description">
        <p>해발고도를 색으로(저지대 녹색 → 고지대 갈색·흰색), 지형 입체감을 음영으로 함께 표현합니다. 범례에는 실제 고도값(m)이 표시됩니다.</p>
      </div>
      <div class="form-group">
        <label for="raster-layer">입력 DEM 레이어</label>
        <select id="raster-layer">${layerOptions}</select>
      </div>
      <div class="form-group">
        <label for="hillshade-azimuth">
          광원 방위각 (Azimuth): <span id="azimuth-value">315</span>°
        </label>
        <input type="range" id="hillshade-azimuth" min="0" max="360" value="315" step="1">
        <div class="range-labels">
          <span>북(0°)</span>
          <span>동(90°)</span>
          <span>남(180°)</span>
          <span>서(270°)</span>
        </div>
      </div>
      <div class="form-group">
        <label for="hillshade-altitude">
          광원 고도각 (Altitude): <span id="altitude-value">45</span>°
        </label>
        <input type="range" id="hillshade-altitude" min="0" max="90" value="45" step="1">
      </div>
      <div class="form-group">
        <label for="hillshade-zfactor">
          Z 인자 (음영 과장): <span id="zfactor-value">1</span>
        </label>
        <input type="range" id="hillshade-zfactor" min="0.1" max="10" value="1" step="0.1">
      </div>
    `;
  }

  /**
   * 래스터 계산기(값 필터) HTML
   */
  getRasterFilterHTML(layerOptions) {
    return `
      <div class="analysis-description">
        <p>선택한 기준이 지정 범위에 드는 셀만 색칠해 표시합니다. (예: 해발 500~1000m, 향 북~동)</p>
      </div>
      <div class="form-group">
        <label for="raster-layer">입력 DEM 레이어</label>
        <select id="raster-layer">${layerOptions}</select>
      </div>
      <div class="form-group">
        <label for="filter-metric">기준</label>
        <select id="filter-metric">
          <option value="elevation">해발고도 (m)</option>
          <option value="slope">경사도 (°)</option>
          <option value="aspect">경사방향/향 (°)</option>
        </select>
      </div>
      <div class="form-group">
        <label>값 범위</label>
        <div class="filter-range-inputs">
          <input type="number" id="filter-min" placeholder="최소" step="any">
          <span>~</span>
          <input type="number" id="filter-max" placeholder="최대" step="any">
          <span id="filter-unit">m</span>
        </div>
        <div class="filter-hint">비워두면 제한 없음. 향은 0(북)~360이며, 최소&gt;최대로 두면 북향(예: 315~45)처럼 0°를 가로질러 선택됩니다.</div>
      </div>
      <div class="form-group">
        <label for="filter-color">표시 색상</label>
        <input type="color" id="filter-color" value="#e3170a">
      </div>
    `;
  }

  /**
   * Slope HTML
   */
  getSlopeHTML(layerOptions) {
    return `
      <div class="analysis-description">
        <p>지형의 경사도를 계산합니다. 완만한 지역은 녹색, 급경사는 빨간색으로 표시됩니다.</p>
      </div>
      <div class="form-group">
        <label for="raster-layer">입력 DEM 레이어</label>
        <select id="raster-layer">${layerOptions}</select>
      </div>
      <div class="form-group">
        <label for="slope-unit">경사 단위</label>
        <select id="slope-unit">
          <option value="degree" selected>도 (Degrees)</option>
          <option value="percent">퍼센트 (%)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="slope-zfactor">
          Z 인자: <span id="zfactor-value">1</span>
        </label>
        <input type="range" id="slope-zfactor" min="0.1" max="10" value="1" step="0.1">
      </div>
      <div class="slope-legend">
        <div class="legend-title">범례</div>
        <div class="legend-gradient slope-gradient"></div>
        <div class="legend-labels">
          <span>완만</span>
          <span>급경사</span>
        </div>
      </div>
    `;
  }

  /**
   * Aspect HTML
   */
  getAspectHTML(layerOptions) {
    return `
      <div class="analysis-description">
        <p>지형이 향하는 방향(경사방향)을 계산합니다. 북=0°, 동=90°, 남=180°, 서=270°</p>
      </div>
      <div class="form-group">
        <label for="raster-layer">입력 DEM 레이어</label>
        <select id="raster-layer">${layerOptions}</select>
      </div>
      <div class="aspect-legend">
        <div class="legend-title">방향별 색상</div>
        <div class="aspect-compass">
          <div class="compass-n">N</div>
          <div class="compass-e">E</div>
          <div class="compass-s">S</div>
          <div class="compass-w">W</div>
          <div class="compass-center"></div>
        </div>
      </div>
    `;
  }

  /**
   * Contour HTML
   */
  getContourHTML(layerOptions) {
    return `
      <div class="analysis-description">
        <p>DEM에서 등고선을 생성합니다. 5배 간격마다 굵은 주곡선이 표시됩니다.</p>
      </div>
      <div class="form-group">
        <label for="raster-layer">입력 DEM 레이어</label>
        <select id="raster-layer">${layerOptions}</select>
      </div>
      <div class="form-group">
        <label for="contour-interval">등고선 간격 (미터)</label>
        <select id="contour-interval">
          <option value="10">10m</option>
          <option value="20">20m</option>
          <option value="50">50m</option>
          <option value="100" selected>100m</option>
          <option value="200">200m</option>
          <option value="500">500m</option>
        </select>
      </div>
      <div class="contour-preview">
        <div class="contour-line major"></div>
        <span>주곡선 (5배 간격)</span>
        <div class="contour-line minor"></div>
        <span>계곡선 (기본 간격)</span>
      </div>
    `;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('raster-close');
    const cancelBtn = document.getElementById('raster-cancel');
    const applyBtn = document.getElementById('raster-apply');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    applyBtn.addEventListener('click', () => this.runAnalysis());

    // 슬라이더 값 표시
    const azimuthInput = document.getElementById('hillshade-azimuth');
    const altitudeInput = document.getElementById('hillshade-altitude');
    const zfactorInputs = document.querySelectorAll('#hillshade-zfactor, #slope-zfactor');

    if (azimuthInput) {
      azimuthInput.addEventListener('input', (e) => {
        document.getElementById('azimuth-value').textContent = e.target.value;
      });
    }

    if (altitudeInput) {
      altitudeInput.addEventListener('input', (e) => {
        document.getElementById('altitude-value').textContent = e.target.value;
      });
    }

    zfactorInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        document.getElementById('zfactor-value').textContent = e.target.value;
      });
    });

    // 래스터 계산기: 기준 변경 시 단위 표시 갱신
    const filterMetric = document.getElementById('filter-metric');
    if (filterMetric) {
      filterMetric.addEventListener('change', (e) => {
        const unitEl = document.getElementById('filter-unit');
        if (unitEl) unitEl.textContent = e.target.value === 'elevation' ? 'm' : '°';
      });
    }
  }

  /**
   * 분석 실행
   */
  async runAnalysis() {
    const layerSelect = document.getElementById('raster-layer');
    const layerId = layerSelect.value;
    const applyBtn = document.getElementById('raster-apply');

    applyBtn.disabled = true;
    applyBtn.textContent = '분석 중...';

    try {
      let resultLayerId;

      switch (this.currentAnalysis) {
        case 'terrain':
          const tAzimuth = parseFloat(document.getElementById('hillshade-azimuth').value);
          const tAltitude = parseFloat(document.getElementById('hillshade-altitude').value);
          const tZFactor = parseFloat(document.getElementById('hillshade-zfactor').value);
          resultLayerId = rasterAnalysisTool.createTerrain(layerId, { azimuth: tAzimuth, altitude: tAltitude, zFactor: tZFactor });
          break;

        case 'filter':
          const metric = document.getElementById('filter-metric').value;
          const minRaw = document.getElementById('filter-min').value;
          const maxRaw = document.getElementById('filter-max').value;
          const fmin = minRaw === '' ? null : parseFloat(minRaw);
          const fmax = maxRaw === '' ? null : parseFloat(maxRaw);
          const fcolor = document.getElementById('filter-color').value;
          if (fmin === null && fmax === null) {
            throw new Error('최소 또는 최대값을 하나 이상 입력하세요.');
          }
          resultLayerId = rasterAnalysisTool.createRasterFilter(layerId, { metric, min: fmin, max: fmax, color: fcolor });
          break;

        case 'slope':
          const unit = document.getElementById('slope-unit').value;
          const slopeZFactor = parseFloat(document.getElementById('slope-zfactor').value);
          resultLayerId = rasterAnalysisTool.createSlope(layerId, { unit, zFactor: slopeZFactor });
          break;

        case 'aspect':
          resultLayerId = rasterAnalysisTool.createAspect(layerId);
          break;

        case 'contour':
          const interval = parseInt(document.getElementById('contour-interval').value);
          resultLayerId = rasterAnalysisTool.createContour(layerId, { interval });
          break;
      }

      alert('분석 완료! 새 레이어가 생성되었습니다.');
      this.close();
    } catch (error) {
      console.error('분석 실패:', error);
      alert('분석 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '분석 실행';
    }
  }

  /**
   * 모달 닫기
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const rasterAnalysisPanel = new RasterAnalysisPanel();
