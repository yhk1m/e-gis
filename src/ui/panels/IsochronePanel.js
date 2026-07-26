/**
 * IsochronePanel - 등시선 분석 설정 패널
 */

import { isochroneTool } from '../../tools/IsochroneTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { buildLayerOptions, resolveInitialLayerId } from '../../utils/layerSelect.js';
import { LOCAL_MODES } from '../../core/localRouting.js';
import { initialNetworkOptions, parseNetworkValue, populateNetworkSelect } from '../roadNetworkSelect.js';
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

    // 선택 중인 레이어가 포인트면 미리 골라 준다.
    this.selectedLayerId = resolveInitialLayerId(pointLayers, layerManager.getSelectedLayerId()) || null;

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
      ? buildLayerOptions(pointLayers, { selectedId: this.selectedLayerId, showCount: true })
      : '<option value="">포인트 레이어 없음</option>';

    return `<div class="modal-content isochrone-content">
      <div class="modal-header">
        <h3>등시선 분석</h3>
        <button class="modal-close" id="isochrone-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="isochrone-engine">도로망</label>
          <select id="isochrone-engine">${initialNetworkOptions()}</select>
          <small class="form-hint">내장 도로망은 API 키가 필요 없고 호출 제한도 없습니다. 주요도로만 쓰면 가볍고, 전체 도로는 골목까지 반영하는 대신 파일이 큽니다.</small>
        </div>
        <div class="form-group" id="isochrone-apikey-group" style="display:none">
          <label for="ors-api-key">OpenRouteService API 키</label>
          <div class="api-key-input-group">
            <input type="password" id="ors-api-key" value="${apiKey}" placeholder="API 키 입력">
            <button type="button" class="btn btn-sm" id="toggle-api-key">보기</button>
            <button type="button" class="btn btn-sm btn-primary" id="save-api-key">저장</button>
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

        <div class="form-group" id="isochrone-merge-group" style="display:none">
          <label class="checkbox-label">
            <input type="checkbox" id="isochrone-merge" checked>
            <span>도달 범위 합치기</span>
          </label>
          <small class="form-hint">끄면 지점마다 범위 경계선이 그대로 보입니다. 켜면 하나의 영역으로 합쳐집니다.</small>
        </div>

        <div class="form-group">
          <label>선택된 좌표</label>
          <div class="point-display" id="point-display">
            선택된 위치 없음
          </div>
        </div>

        <div class="form-group" id="isochrone-profile-group" style="display:none">
          <label for="travel-profile">이동 수단</label>
          <select id="travel-profile">${profileOptions}</select>
        </div>

        <div class="form-group" id="isochrone-speed-group">
          <label for="local-mode">이동 수단</label>
          <select id="local-mode">
            <option value="foot">도보 — 자동차전용도로 제외</option>
            <option value="bike">자전거 — 자동차전용도로 제외</option>
            <option value="car" selected>자동차 — 모든 도로</option>
          </select>
          <label for="local-speed" style="margin-top:8px; display:block">이동 속도 (km/h)</label>
          <input type="number" id="local-speed" value="40" min="1" max="200" step="1">
          <small class="form-hint">이동 수단은 지날 수 있는 도로를, 속도는 걸리는 시간을 정합니다. 수단을 바꾸면 기본 속도가 채워지고, 값은 직접 고칠 수 있습니다.</small>
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
            <input type="text" id="intervals-input" value="5, 10, 15" placeholder="예: 5, 10, 15, 30">
            <small class="form-hint" id="intervals-hint">쉼표로 구분하여 원하는 시간(분)을 입력하세요</small>
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

    const saveApiKeyBtn = document.getElementById('save-api-key');
    saveApiKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        isochroneTool.setApiKey(key);
        alert('API 키가 저장되었습니다.');
      } else {
        alert('API 키를 입력해주세요.');
      }
    });

    // 도로망 선택 — 내장 도로망을 쓰면 API 키 입력을 감춘다
    const engineSelect = document.getElementById('isochrone-engine');
    const apiKeyGroup = document.getElementById('isochrone-apikey-group');
    const profileGroup = document.getElementById('isochrone-profile-group');
    const speedGroup = document.getElementById('isochrone-speed-group');
    // 쓸 수 있는 내장 도로망 목록을 catalog.json에서 채운다
    populateNetworkSelect('isochrone-engine');
    engineSelect.addEventListener('change', () => {
      const isOrs = parseNetworkValue(engineSelect.value).engine === 'ors';
      apiKeyGroup.style.display = isOrs ? '' : 'none';
      // 내장 도로망은 시속을 직접 정한다 — 이동 수단 목록은 API 방식에서만 쓴다
      profileGroup.style.display = isOrs ? '' : 'none';
      speedGroup.style.display = isOrs ? 'none' : '';
      this.updateAnalyzeButton();
    });

    // 이동 수단을 바꾸면 그 수단의 기본 속도를 채워 준다
    const modeSelect = document.getElementById('local-mode');
    const speedInput = document.getElementById('local-speed');
    modeSelect.addEventListener('change', () => {
      speedInput.value = LOCAL_MODES[modeSelect.value].defaultSpeed;
    });

    rangeTypeSelect.addEventListener('change', () => {
      this.updateIntervalLabels();
    });

    const intervalsInput = document.getElementById('intervals-input');
    intervalsInput.addEventListener('input', () => this.updateAnalyzeButton());

    layerSelect.addEventListener('change', () => {
      this.selectedLayerId = layerSelect.value;
      this.updateFeatureList();
    });

    featureSelect.addEventListener('change', () => {
      this.onFeatureSelected();
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

    // 지점이 여럿이면 한 번에 분석할 수 있게 한다 (도달 범위를 합쳐서 보여 준다)
    if (features.length >= 2) {
      const all = document.createElement('option');
      all.value = 'all';
      all.textContent = `전체 지점 (${features.length}개)`;
      featureSelect.appendChild(all);
    }

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
    this.selectedPoints = null;
    this.updatePointDisplay();
    this.updateAnalyzeButton();
  }

  /**
   * 피처 선택 시 처리
   */
  onFeatureSelected() {
    const featureSelect = document.getElementById('isochrone-feature');
    const featureIndex = featureSelect.value;

    this.selectedPoints = null;
    // 합치기 선택은 전체 지점 분석일 때만 의미가 있다
    const mergeGroup = document.getElementById('isochrone-merge-group');
    if (mergeGroup) mergeGroup.style.display = featureIndex === 'all' ? '' : 'none';

    if (!featureIndex || !this.selectedLayerId) {
      this.selectedPoint = null;
      this.selectedCoordinate = null;
      this.updatePointDisplay();
      this.updateAnalyzeButton();
      return;
    }

    const layerInfo = layerManager.getLayer(this.selectedLayerId);
    if (!layerInfo) return;

    // 전체 지점 — 좌표를 모두 모아 둔다
    if (featureIndex === 'all') {
      const points = [];
      layerInfo.source.getFeatures().forEach(f => {
        const g = f.getGeometry();
        if (!g) return;
        const type = g.getType();
        if (type === 'Point') points.push(transform(g.getCoordinates(), 'EPSG:3857', 'EPSG:4326'));
        else if (type === 'MultiPoint') {
          g.getCoordinates().forEach(c => points.push(transform(c, 'EPSG:3857', 'EPSG:4326')));
        }
      });
      this.selectedPoints = points;
      this.selectedPoint = points[0] || null;
      this.selectedCoordinate = null;
      isochroneTool.removeMarker();
      this.updatePointDisplay();
      this.updateAnalyzeButton();
      return;
    }

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

    if (this.selectedPoints) {
      pointDisplay.textContent = `전체 ${this.selectedPoints.length}개 지점 (도달 범위를 합쳐서 표시)`;
      pointDisplay.classList.add('has-point');
    } else if (this.selectedPoint) {
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
    const input = document.getElementById('intervals-input');
    const hint = document.getElementById('intervals-hint');

    if (rangeType === 'time') {
      label.textContent = '시간 간격 (분)';
      input.placeholder = '예: 5, 10, 15, 30';
      hint.textContent = '쉼표로 구분하여 원하는 시간(분)을 입력하세요';
      input.value = '5, 10, 15';
    } else {
      label.textContent = '거리 간격 (km)';
      input.placeholder = '예: 1, 2, 5, 10';
      hint.textContent = '쉼표로 구분하여 원하는 거리(km)를 입력하세요';
      input.value = '1, 2, 5';
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
    const engineEl = document.getElementById('isochrone-engine');
    const needsKey = !engineEl || parseNetworkValue(engineEl.value).engine === 'ors';

    const canAnalyze = (!needsKey || apiKey) && this.selectedPoint && intervals.length > 0;
    analyzeBtn.disabled = !canAnalyze;
  }

  /**
   * 선택된 간격 가져오기
   */
  getSelectedIntervals() {
    const input = document.getElementById('intervals-input');
    const value = input.value.trim();

    if (!value) return [];

    return value.split(',')
      .map(v => parseFloat(v.trim()))
      .filter(v => !isNaN(v) && v > 0)
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
    const network = parseNetworkValue(document.getElementById('isochrone-engine').value);

    if (network.engine === 'ors' && this.selectedPoints) {
      alert('전체 지점 분석은 내장 도로망에서만 됩니다.\n(API 방식은 지점마다 호출이 필요해 호출 제한에 걸립니다)');
      return;
    }
    if (network.engine === 'ors' && !apiKey) {
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
    const engine = network.engine;

    const analyzeBtn = document.getElementById('isochrone-analyze');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';

    try {
      const mode = LOCAL_MODES[document.getElementById('local-mode').value] || LOCAL_MODES.car;
      const speedKmh = parseFloat(document.getElementById('local-speed').value);

      const result = await isochroneTool.analyze(this.selectedPoint, {
        profile,
        intervals,
        rangeType,
        engine,
        points: this.selectedPoints,
        merge: document.getElementById('isochrone-merge').checked,
        chunk: network.chunk,
        onOriginProgress: (done, total) => {
          if (total > 1) analyzeBtn.textContent = `계산 중 ${done}/${total}`;
        },
        speedKmh: engine === 'local' ? speedKmh : 0,
        excludeHighway: mode.excludeHighway,
        localLabel: `${mode.label} ${speedKmh}km/h`,
        // 도로망을 처음 받을 때만 잠깐 걸린다 — 진행률을 버튼에 보여 준다
        onProgress: (loaded, total) => {
          const pct = total ? Math.round(loaded / total * 100) : 0;
          analyzeBtn.textContent = total ? `도로망 받는 중 ${pct}%` : '도로망 받는 중…';
        }
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
    // 출발점 마커는 패널을 쓰는 동안만 필요한 표시다.
    // 남겨 두면 레이어 목록에도 없어서 지울 방법이 없다.
    isochroneTool.removeMarker();
  }
}

export const isochronePanel = new IsochronePanel();
