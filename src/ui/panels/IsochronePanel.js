// © 2026 김용현
/**
 * IsochronePanel - 등시선 분석 설정 패널
 * 여러 포인트 피처를 동시에 선택해 등시선 분석 가능
 */

import { isochroneTool } from '../../tools/IsochroneTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { transform } from 'ol/proj';

// 지점마다 API 1회 호출 → 무료 사용량 한도(분당 약 20건) 고려한 경고 임계치
const MANY_POINTS_WARNING = 15;

class IsochronePanel {
  constructor() {
    this.modal = null;
    this.selectedLayerId = null;
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

    // 초기 레이어 선택
    const layerSelect = document.getElementById('isochrone-layer');
    if (layerSelect && layerSelect.value) {
      this.selectedLayerId = layerSelect.value;
    }

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
          <label>시작점 피처 <small style="font-weight:400;opacity:0.7;">(여러 개 선택 가능)</small></label>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;">
              <input type="checkbox" id="isochrone-select-all"> 전체 선택
            </label>
            <span class="point-display" id="point-display">선택된 위치 없음</span>
          </div>
          <div class="isochrone-feature-list" id="isochrone-feature-list"
               style="max-height:180px;overflow-y:auto;border:1px solid var(--border-color,#ccc);border-radius:6px;padding:4px;">
            <div class="isochrone-feature-empty" style="opacity:0.6;padding:8px;font-size:13px;">포인트 레이어를 선택하세요.</div>
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
            <input type="text" id="intervals-input" value="5, 10, 15" placeholder="예: 5, 10, 15, 30">
            <small class="form-hint" id="intervals-hint">쉼표로 구분하여 원하는 시간(분)을 입력하세요</small>
          </div>
        </div>

        <div class="isochrone-info">
          <p>등시선(Isochrone)은 특정 지점에서 일정 시간/거리 내에 도달 가능한 영역을 표시합니다. 여러 지점을 선택하면 지점마다 등시선을 만들어 함께 표시합니다.</p>
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
    const selectAllChk = document.getElementById('isochrone-select-all');

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

    rangeTypeSelect.addEventListener('change', () => {
      this.updateIntervalLabels();
    });

    const intervalsInput = document.getElementById('intervals-input');
    intervalsInput.addEventListener('input', () => this.updateAnalyzeButton());

    layerSelect.addEventListener('change', () => {
      this.selectedLayerId = layerSelect.value;
      this.updateFeatureList();
    });

    // 전체 선택/해제
    if (selectAllChk) {
      selectAllChk.addEventListener('change', () => {
        const checked = selectAllChk.checked;
        document.querySelectorAll('.isochrone-feature-check').forEach(chk => {
          chk.checked = checked;
        });
        this.onFeatureSelectionChanged();
      });
    }
  }

  /**
   * 피처 목록(체크박스) 업데이트
   */
  updateFeatureList() {
    const listEl = document.getElementById('isochrone-feature-list');
    const selectAll = document.getElementById('isochrone-select-all');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (selectAll) selectAll.checked = false;

    const emptyMsg = (text) => {
      const div = document.createElement('div');
      div.className = 'isochrone-feature-empty';
      div.style.cssText = 'opacity:0.6;padding:8px;font-size:13px;';
      div.textContent = text;
      listEl.appendChild(div);
    };

    if (!this.selectedLayerId) {
      emptyMsg('포인트 레이어를 선택하세요.');
      this.onFeatureSelectionChanged();
      return;
    }

    const layerInfo = layerManager.getLayer(this.selectedLayerId);
    if (!layerInfo) {
      emptyMsg('레이어를 찾을 수 없습니다.');
      this.onFeatureSelectionChanged();
      return;
    }

    const features = layerInfo.source.getFeatures();
    if (features.length === 0) {
      emptyMsg('피처가 없습니다.');
      this.onFeatureSelectionChanged();
      return;
    }

    features.forEach((feature, index) => {
      const featureName = this.getFeatureLabel(feature, index);

      const label = document.createElement('label');
      label.className = 'isochrone-feature-item';
      label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 4px;cursor:pointer;font-size:13px;';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'isochrone-feature-check';
      chk.value = String(index);
      chk.addEventListener('change', () => this.onFeatureSelectionChanged());

      const span = document.createElement('span');
      span.textContent = featureName;

      label.appendChild(chk);
      label.appendChild(span);
      listEl.appendChild(label);
    });

    this.onFeatureSelectionChanged();
  }

  /**
   * 피처의 표시 이름 계산
   */
  getFeatureLabel(feature, index) {
    const props = feature.getProperties();
    let name = props.name || props.NAME || props.id || props.ID || `피처 ${index + 1}`;
    if (typeof name === 'object') name = `피처 ${index + 1}`;
    return String(name);
  }

  /**
   * 현재 체크된 피처들의 시작점 목록 반환
   * @returns {Array<{lonLat:number[], coordinate:number[], label:string}>}
   */
  getSelectedPoints() {
    const points = [];
    if (!this.selectedLayerId) return points;

    const layerInfo = layerManager.getLayer(this.selectedLayerId);
    if (!layerInfo) return points;

    const features = layerInfo.source.getFeatures();
    const checks = document.querySelectorAll('.isochrone-feature-check:checked');

    checks.forEach(chk => {
      const index = parseInt(chk.value, 10);
      const feature = features[index];
      if (!feature) return;

      const geometry = feature.getGeometry();
      let coordinate;
      if (geometry.getType() === 'Point') {
        coordinate = geometry.getCoordinates();
      } else if (geometry.getType() === 'MultiPoint') {
        coordinate = geometry.getCoordinates()[0];
      }
      if (!coordinate) return;

      const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
      points.push({
        lonLat,
        coordinate,
        label: this.getFeatureLabel(feature, index)
      });
    });

    return points;
  }

  /**
   * 피처 선택 변경 시 처리 (마커/표시/버튼 갱신)
   */
  onFeatureSelectionChanged() {
    const points = this.getSelectedPoints();

    // 마커 표시
    if (points.length > 0) {
      isochroneTool.showMarkers(points.map(p => p.coordinate));
    } else {
      isochroneTool.removeMarker();
    }

    // 전체 선택 체크박스 동기화
    const selectAll = document.getElementById('isochrone-select-all');
    const allChecks = document.querySelectorAll('.isochrone-feature-check');
    if (selectAll && allChecks.length > 0) {
      selectAll.checked = points.length === allChecks.length;
    }

    this.updatePointDisplay(points.length);
    this.updateAnalyzeButton();
  }

  /**
   * 선택 개수 표시 업데이트
   */
  updatePointDisplay(count) {
    const pointDisplay = document.getElementById('point-display');
    if (!pointDisplay) return;

    if (count == null) count = this.getSelectedPoints().length;

    if (count > 0) {
      pointDisplay.textContent = `${count}개 선택됨`;
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

    this.updateAnalyzeButton();
  }

  /**
   * 분석 버튼 상태 업데이트
   */
  updateAnalyzeButton() {
    const analyzeBtn = document.getElementById('isochrone-analyze');
    if (!analyzeBtn) return;

    const apiKey = document.getElementById('ors-api-key').value;
    const intervals = this.getSelectedIntervals();
    const count = this.getSelectedPoints().length;

    analyzeBtn.disabled = !(apiKey && count > 0 && intervals.length > 0);
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
    const points = this.getSelectedPoints();
    if (points.length === 0) {
      alert('시작점을 하나 이상 선택해주세요.');
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

    // 지점이 많으면 API 사용량 안내
    if (points.length > MANY_POINTS_WARNING) {
      const proceed = confirm(
        `${points.length}개 지점을 분석합니다.\n지점마다 API를 1회씩 호출하므로 시간이 걸리고, ` +
        `무료 사용량 한도(분당 약 20건)를 초과할 수 있습니다.\n계속할까요?`
      );
      if (!proceed) return;
    }

    const profile = document.getElementById('travel-profile').value;
    const rangeType = document.getElementById('range-type').value;

    const analyzeBtn = document.getElementById('isochrone-analyze');
    const originalText = analyzeBtn.textContent;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';

    try {
      const result = await isochroneTool.analyzeMultiple(
        points,
        { profile, intervals, rangeType },
        (done, total) => {
          analyzeBtn.textContent = `분석 중... (${done}/${total})`;
        }
      );

      const failCount = result.errors ? result.errors.length : 0;
      const okCount = result.pointCount - failCount;
      let msg = `등시선 분석 완료!\n성공 지점: ${okCount}/${result.pointCount}개, 생성된 영역: ${result.featureCount}개`;
      if (failCount > 0) {
        msg += `\n\n실패한 지점:\n${result.errors.join('\n')}`;
      }
      alert(msg);
    } catch (error) {
      alert('분석 실패: ' + error.message);
    } finally {
      analyzeBtn.textContent = originalText;
      this.updateAnalyzeButton();
    }
  }

  /**
   * 결과 지우기
   */
  clearResults() {
    isochroneTool.clear();

    document.querySelectorAll('.isochrone-feature-check').forEach(chk => {
      chk.checked = false;
    });
    const selectAll = document.getElementById('isochrone-select-all');
    if (selectAll) selectAll.checked = false;

    this.onFeatureSelectionChanged();
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
