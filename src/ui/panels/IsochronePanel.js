/**
 * IsochronePanel - 등시선 분석 설정 패널
 */

import { isochroneTool } from '../../tools/IsochroneTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { transform } from 'ol/proj';

class IsochronePanel {
  constructor() {
    this.modal = null;
    this.selectedPoint = null; // [lon, lat]
    this.selectedCoordinate = null; // map coordinate (EPSG:3857)
    this.selectedLayerId = null;
    this.selectedFeatureId = null;
  }

  /**
   * 패널 열기
   */
  show() {
    this.render();
  }

  /**
   * 포인트 레이어 목록 가져오기
   */
  getPointLayers() {
    return layerManager.getAllLayers().filter(layer => {
      return layer.geometryType === 'Point' || layer.geometryType === 'MultiPoint';
    });
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    const profiles = isochroneTool.getProfiles();
    const apiKey = isochroneTool.getApiKey();
    const pointLayers = this.getPointLayers();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay isochrone-modal active';
    this.modal.innerHTML = this.getModalHTML(profiles, apiKey, pointLayers);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateFeatureList();
    this.updateAnalyzeButton();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(profiles, apiKey, pointLayers) {
    const profileOptions = Object.entries(profiles)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('');

    const layerOptions = pointLayers.length > 0
      ? pointLayers.map(l => `<option value="${l.id}">${l.name} (${l.featureCount}개)</option>`).join('')
      : '<option value="">포인트 레이어 없음</option>';

    return `<div class="modal-content isochrone-content">
      <div class="modal-header">
        <h3>등시선 분석</h3>
        <button class="modal-close" id="isochrone-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="ors-api-key">OpenRouteService API 키</label>
          <div class="api-key-input-group">
            <input type="password" id="ors-api-key" value="${apiKey}" placeholder="API 키 입력">
            <button type="button" class="btn btn-sm" id="toggle-api-key">보기</button>
          </div>
          <small class="form-hint">
            <a href="https://openrouteservice.org/dev/#/signup" target="_blank">openrouteservice.org</a>에서 무료 API 키를 발급받으세요
          </small>
        </div>

        <div class="form-group">
          <label for="isochrone-layer">포인트 레이어</label>
          <select id="isochrone-layer">${layerOptions}</select>
        </div>

        <div class="form-group">
          <label for="isochrone-feature">시작점 피처</label>
          <select id="isochrone-feature">
            <option value="">피처 선택...</option>
          </select>
        </div>

        <div class="form-group">
          <label>선택된 좌표</label>
          <div class="point-display" id="point-display">
            선택된 위치 없음
          </div>
        </div>

        <div class="form-group">
          <label for="travel-profile">이동 수단</label>
          <select id="travel-profile">${profileOptions}</select>
        </div>

        <div class="form-group">
          <label for="range-type">분석 유형</label>
          <select id="range-type">
            <option value="time">시간 기준</option>
            <option value="distance">거리 기준</option>
          </select>
        </div>

        <div class="form-group">
          <label id="intervals-label">시간 간격 (분)</label>
          <div class="intervals-input">
            <div class="interval-checkboxes" id="interval-checkboxes">
              <label class="interval-checkbox">
                <input type="checkbox" value="5" checked> <span>5분</span>
              </label>
              <label class="interval-checkbox">
                <input type="checkbox" value="10" checked> <span>10분</span>
              </label>
              <label class="interval-checkbox">
                <input type="checkbox" value="15" checked> <span>15분</span>
              </label>
              <label class="interval-checkbox">
                <input type="checkbox" value="20"> <span>20분</span>
              </label>
              <label class="interval-checkbox">
                <input type="checkbox" value="30"> <span>30분</span>
              </label>
              <label class="interval-checkbox">
                <input type="checkbox" value="60"> <span>60분</span>
              </label>
            </div>
          </div>
        </div>

        <div class="isochrone-info">
          <p>등시선(Isochrone)은 특정 지점에서 일정 시간/거리 내에 도달 가능한 영역을 표시합니다.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="isochrone-clear">결과 지우기</button>
        <button class="btn btn-secondary" id="isochrone-cancel">취소</button>
        <button class="btn btn-primary" id="isochrone-analyze" disabled>분석 실행</button>
      </div>
    </div>`;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('isochrone-close');
    const cancelBtn = document.getElementById('isochrone-cancel');
    const analyzeBtn = document.getElementById('isochrone-analyze');
    const clearBtn = document.getElementById('isochrone-clear');
    const apiKeyInput = document.getElementById('ors-api-key');
    const toggleApiKeyBtn = document.getElementById('toggle-api-key');
    const rangeTypeSelect = document.getElementById('range-type');
    const layerSelect = document.getElementById('isochrone-layer');
    const featureSelect = document.getElementById('isochrone-feature');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    analyzeBtn.addEventListener('click', () => this.analyze());
    clearBtn.addEventListener('click', () => this.clearResults());

    apiKeyInput.addEventListener('input', () => {
      isochroneTool.setApiKey(apiKeyInput.value);
      this.updateAnalyzeButton();
    });

    toggleApiKeyBtn.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyBtn.textContent = '숨김';
      } else {
        apiKeyInput.type = 'password';
        toggleApiKeyBtn.textContent = '보기';
      }
    });

    rangeTypeSelect.addEventListener('change', () => {
      this.updateIntervalLabels();
    });

    layerSelect.addEventListener('change', () => {
      this.selectedLayerId = layerSelect.value;
      this.updateFeatureList();
    });

    featureSelect.addEventListener('change', () => {
      this.onFeatureSelected();
    });

    // 체크박스 이벤트
    document.querySelectorAll('#interval-checkboxes input').forEach(cb => {
      cb.addEventListener('change', () => this.updateAnalyzeButton());
    });

    // 초기 레이어 선택
    if (layerSelect.value) {
      this.selectedLayerId = layerSelect.value;
    }
  }

  /**
   * 피처 목록 업데이트
   */
  updateFeatureList() {
    const featureSelect = document.getElementById('isochrone-feature');
    featureSelect.innerHTML = '<option value="">피처 선택...</option>';

    if (!this.selectedLayerId) return;

    const layerInfo = layerManager.getLayer(this.selectedLayerId);
    if (!layerInfo) return;

    const features = layerInfo.source.getFeatures();

    features.forEach((feature, index) => {
      // 피처 이름 또는 ID 찾기
      const props = feature.getProperties();
      let featureName = props.name || props.NAME || props.id || props.ID || `피처 ${index + 1}`;

      // geometry 속성 제외
      if (typeof featureName === 'object') {
        featureName = `피처 ${index + 1}`;
      }

      const option = document.createElement('option');
      option.value = index;
      option.textContent = featureName;
      featureSelect.appendChild(option);
    });

    this.selectedPoint = null;
    this.selectedCoordinate = null;
    this.updatePointDisplay();
    this.updateAnalyzeButton();
  }

  /**
   * 피처 선택 시 처리
   */
  onFeatureSelected() {
    const featureSelect = document.getElementById('isochrone-feature');
    const featureIndex = featureSelect.value;

    if (!featureIndex || !this.selectedLayerId) {
      this.selectedPoint = null;
      this.selectedCoordinate = null;
      this.updatePointDisplay();
      this.updateAnalyzeButton();
      return;
    }

    const layerInfo = layerManager.getLayer(this.selectedLayerId);
    if (!layerInfo) return;

    const features = layerInfo.source.getFeatures();
    const feature = features[parseInt(featureIndex)];

    if (!feature) return;

    const geometry = feature.getGeometry();
    let coordinate;

    if (geometry.getType() === 'Point') {
      coordinate = geometry.getCoordinates();
    } else if (geometry.getType() === 'MultiPoint') {
      coordinate = geometry.getCoordinates()[0];
    }

    if (coordinate) {
      this.selectedCoordinate = coordinate;
      // EPSG:3857 -> EPSG:4326 변환
      this.selectedPoint = transform(coordinate, 'EPSG:3857', 'EPSG:4326');

      // 마커 표시
      isochroneTool.showMarker(coordinate);
    }

    this.updatePointDisplay();
    this.updateAnalyzeButton();
  }

  /**
   * 좌표 표시 업데이트
   */
  updatePointDisplay() {
    const pointDisplay = document.getElementById('point-display');

    if (this.selectedPoint) {
      pointDisplay.textContent = `${this.selectedPoint[1].toFixed(6)}, ${this.selectedPoint[0].toFixed(6)}`;
      pointDisplay.classList.add('has-point');
    } else {
      pointDisplay.textContent = '선택된 위치 없음';
      pointDisplay.classList.remove('has-point');
    }
  }

  /**
   * 간격 레이블 업데이트
   */
  updateIntervalLabels() {
    const rangeType = document.getElementById('range-type').value;
    const label = document.getElementById('intervals-label');
    const checkboxes = document.querySelectorAll('#interval-checkboxes .interval-checkbox');

    if (rangeType === 'time') {
      label.textContent = '시간 간격 (분)';
      const timeValues = [5, 10, 15, 20, 30, 60];
      checkboxes.forEach((cb, i) => {
        const input = cb.querySelector('input');
        const span = cb.querySelector('span');
        input.value = timeValues[i];
        span.textContent = `${timeValues[i]}분`;
      });
    } else {
      label.textContent = '거리 간격 (km)';
      const distValues = [1, 2, 3, 5, 10, 20];
      checkboxes.forEach((cb, i) => {
        const input = cb.querySelector('input');
        const span = cb.querySelector('span');
        input.value = distValues[i];
        span.textContent = `${distValues[i]}km`;
      });
    }
  }

  /**
   * 분석 버튼 상태 업데이트
   */
  updateAnalyzeButton() {
    const analyzeBtn = document.getElementById('isochrone-analyze');
    if (!analyzeBtn) return;

    const apiKey = document.getElementById('ors-api-key').value;
    const intervals = this.getSelectedIntervals();

    const canAnalyze = apiKey && this.selectedPoint && intervals.length > 0;
    analyzeBtn.disabled = !canAnalyze;
  }

  /**
   * 선택된 간격 가져오기
   */
  getSelectedIntervals() {
    const checkboxes = document.querySelectorAll('#interval-checkboxes input:checked');
    return Array.from(checkboxes)
      .map(cb => parseInt(cb.value))
      .sort((a, b) => a - b);
  }

  /**
   * 분석 실행
   */
  async analyze() {
    if (!this.selectedPoint) {
      alert('시작점을 선택해주세요.');
      return;
    }

    const apiKey = document.getElementById('ors-api-key').value;
    if (!apiKey) {
      alert('API 키를 입력해주세요.');
      return;
    }

    const intervals = this.getSelectedIntervals();
    if (intervals.length === 0) {
      alert('최소 하나의 간격을 선택해주세요.');
      return;
    }

    const profile = document.getElementById('travel-profile').value;
    const rangeType = document.getElementById('range-type').value;

    const analyzeBtn = document.getElementById('isochrone-analyze');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';

    try {
      const result = await isochroneTool.analyze(this.selectedPoint, {
        profile,
        intervals,
        rangeType
      });

      alert(`등시선 분석 완료!\n생성된 영역: ${result.featureCount}개`);

    } catch (error) {
      alert('분석 실패: ' + error.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '분석 실행';
      this.updateAnalyzeButton();
    }
  }

  /**
   * 결과 지우기
   */
  clearResults() {
    isochroneTool.clear();
    this.selectedPoint = null;
    this.selectedCoordinate = null;

    const featureSelect = document.getElementById('isochrone-feature');
    if (featureSelect) {
      featureSelect.value = '';
    }

    this.updatePointDisplay();
    this.updateAnalyzeButton();
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

export const isochronePanel = new IsochronePanel();
