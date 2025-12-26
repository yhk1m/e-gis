/**
 * RoutingPanel - 최단경로 분석 설정 패널
 */

import { routingTool } from '../../tools/RoutingTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { transform } from 'ol/proj';

class RoutingPanel {
  constructor() {
    this.modal = null;
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

    const profiles = routingTool.getProfiles();
    const apiKey = routingTool.getApiKey();
    const pointLayers = this.getPointLayers();
    const state = routingTool.getState();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay routing-modal active';
    this.modal.innerHTML = this.getModalHTML(profiles, apiKey, pointLayers, state);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateStartFeatures();
    this.updateEndFeatures();
    this.updateUI();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(profiles, apiKey, pointLayers, state) {
    const profileOptions = Object.entries(profiles)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('');

    const layerOptions = pointLayers.length > 0
      ? pointLayers.map(l => `<option value="${l.id}">${l.name} (${l.featureCount}개)</option>`).join('')
      : '<option value="">포인트 레이어 없음</option>';

    return `<div class="modal-content routing-content">
      <div class="modal-header">
        <h3>최단경로 분석</h3>
        <button class="modal-close" id="routing-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="routing-api-key">OpenRouteService API 키</label>
          <div class="api-key-input-group">
            <input type="password" id="routing-api-key" value="${apiKey}" placeholder="API 키 입력">
            <button type="button" class="btn btn-sm" id="routing-toggle-api-key">보기</button>
          </div>
          <small class="form-hint">
            <a href="https://openrouteservice.org/dev/#/signup" target="_blank">openrouteservice.org</a>에서 무료 API 키를 발급받으세요
          </small>
        </div>

        <div class="routing-points-section">
          <div class="routing-point-group start-point">
            <div class="routing-point-header">
              <span class="routing-point-marker start">S</span>
              <span class="routing-point-label">출발지</span>
            </div>
            <div class="routing-point-selects">
              <select id="routing-start-layer" class="routing-layer-select">${layerOptions}</select>
              <select id="routing-start-feature" class="routing-feature-select">
                <option value="">피처 선택...</option>
              </select>
            </div>
          </div>

          <div class="waypoints-container" id="waypoints-container">
            <!-- 경유지들이 여기에 추가됨 -->
          </div>

          <div class="add-waypoint-container">
            <button type="button" class="btn btn-sm" id="add-waypoint-btn">+ 경유지 추가</button>
          </div>

          <div class="routing-point-group end-point">
            <div class="routing-point-header">
              <span class="routing-point-marker end">E</span>
              <span class="routing-point-label">도착지</span>
              <button type="button" class="btn btn-sm btn-icon swap-btn" id="routing-swap" title="출발/도착 교환">⇅</button>
            </div>
            <div class="routing-point-selects">
              <select id="routing-end-layer" class="routing-layer-select">${layerOptions}</select>
              <select id="routing-end-feature" class="routing-feature-select">
                <option value="">피처 선택...</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="routing-profile">이동 수단</label>
          <select id="routing-profile">${profileOptions}</select>
        </div>

        <div class="route-result" id="route-result" style="display:none;">
          <div class="route-result-title">경로 정보</div>
          <div class="route-result-content">
            <div class="route-stat">
              <span class="route-stat-label">거리</span>
              <span class="route-stat-value" id="route-distance">-</span>
            </div>
            <div class="route-stat">
              <span class="route-stat-label">예상 시간</span>
              <span class="route-stat-value" id="route-duration">-</span>
            </div>
          </div>
        </div>

        <div class="routing-info">
          <p>OpenStreetMap 도로 데이터를 기반으로 실제 도로를 따라 최단 경로를 계산합니다.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="routing-clear">결과 지우기</button>
        <button class="btn btn-secondary" id="routing-cancel">취소</button>
        <button class="btn btn-primary" id="routing-analyze" disabled>경로 검색</button>
      </div>
    </div>`;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('routing-close');
    const cancelBtn = document.getElementById('routing-cancel');
    const analyzeBtn = document.getElementById('routing-analyze');
    const clearBtn = document.getElementById('routing-clear');
    const swapBtn = document.getElementById('routing-swap');
    const apiKeyInput = document.getElementById('routing-api-key');
    const toggleApiKeyBtn = document.getElementById('routing-toggle-api-key');
    const addWaypointBtn = document.getElementById('add-waypoint-btn');

    const startLayerSelect = document.getElementById('routing-start-layer');
    const startFeatureSelect = document.getElementById('routing-start-feature');
    const endLayerSelect = document.getElementById('routing-end-layer');
    const endFeatureSelect = document.getElementById('routing-end-feature');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    analyzeBtn.addEventListener('click', () => this.analyze());
    clearBtn.addEventListener('click', () => this.clearResults());

    swapBtn.addEventListener('click', () => this.swapPoints());
    addWaypointBtn.addEventListener('click', () => this.addWaypoint());

    apiKeyInput.addEventListener('input', () => {
      routingTool.setApiKey(apiKeyInput.value);
      this.updateUI();
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

    startLayerSelect.addEventListener('change', () => {
      this.updateStartFeatures();
    });

    startFeatureSelect.addEventListener('change', () => {
      this.onStartFeatureSelected();
    });

    endLayerSelect.addEventListener('change', () => {
      this.updateEndFeatures();
    });

    endFeatureSelect.addEventListener('change', () => {
      this.onEndFeatureSelected();
    });
  }

  /**
   * 경유지 추가
   */
  addWaypoint() {
    const container = document.getElementById('waypoints-container');
    const waypointIndex = container.children.length;
    const pointLayers = this.getPointLayers();

    const layerOptions = pointLayers.length > 0
      ? pointLayers.map(l => `<option value="${l.id}">${l.name}</option>`).join('')
      : '<option value="">포인트 레이어 없음</option>';

    const waypointDiv = document.createElement('div');
    waypointDiv.className = 'routing-point-group waypoint';
    waypointDiv.dataset.index = waypointIndex;
    waypointDiv.innerHTML = `
      <div class="routing-point-header">
        <span class="routing-point-marker waypoint">${waypointIndex + 1}</span>
        <span class="routing-point-label">경유지 ${waypointIndex + 1}</span>
        <button type="button" class="btn btn-sm btn-icon remove-waypoint-btn" title="경유지 제거">×</button>
      </div>
      <div class="routing-point-selects">
        <select class="routing-layer-select waypoint-layer">${layerOptions}</select>
        <select class="routing-feature-select waypoint-feature">
          <option value="">피처 선택...</option>
        </select>
      </div>
    `;

    container.appendChild(waypointDiv);

    // 이벤트 바인딩
    const layerSelect = waypointDiv.querySelector('.waypoint-layer');
    const featureSelect = waypointDiv.querySelector('.waypoint-feature');
    const removeBtn = waypointDiv.querySelector('.remove-waypoint-btn');

    layerSelect.addEventListener('change', () => {
      this.updateFeatureSelect(layerSelect.value, featureSelect);
      this.updateWaypoints();
    });

    featureSelect.addEventListener('change', () => {
      this.updateWaypoints();
    });

    removeBtn.addEventListener('click', () => {
      this.removeWaypoint(waypointDiv);
    });

    // 피처 목록 초기화
    if (layerSelect.value) {
      this.updateFeatureSelect(layerSelect.value, featureSelect);
    }

    this.updateWaypointNumbers();
    this.updateUI();
  }

  /**
   * 경유지 제거
   */
  removeWaypoint(waypointDiv) {
    waypointDiv.remove();
    this.updateWaypointNumbers();
    this.updateWaypoints();
    this.updateUI();
  }

  /**
   * 경유지 번호 업데이트
   */
  updateWaypointNumbers() {
    const container = document.getElementById('waypoints-container');
    const waypoints = container.querySelectorAll('.waypoint');

    waypoints.forEach((wp, index) => {
      wp.dataset.index = index;
      wp.querySelector('.routing-point-marker').textContent = index + 1;
      wp.querySelector('.routing-point-label').textContent = `경유지 ${index + 1}`;
    });
  }

  /**
   * 경유지 정보 업데이트
   */
  updateWaypoints() {
    const container = document.getElementById('waypoints-container');
    const waypointDivs = container.querySelectorAll('.waypoint');

    routingTool.clearWaypoints();

    waypointDivs.forEach((wp) => {
      const layerSelect = wp.querySelector('.waypoint-layer');
      const featureSelect = wp.querySelector('.waypoint-feature');

      const point = this.getPointFromSelection(layerSelect.value, featureSelect.value);
      if (point) {
        routingTool.waypoints.push(point);
      }
    });

    routingTool.updateMarkers();
    this.updateUI();
  }

  /**
   * 출발지 피처 목록 업데이트
   */
  updateStartFeatures() {
    const layerSelect = document.getElementById('routing-start-layer');
    const featureSelect = document.getElementById('routing-start-feature');
    this.updateFeatureSelect(layerSelect.value, featureSelect);
    routingTool.startPoint = null;
    routingTool.updateMarkers();
    this.updateUI();
  }

  /**
   * 도착지 피처 목록 업데이트
   */
  updateEndFeatures() {
    const layerSelect = document.getElementById('routing-end-layer');
    const featureSelect = document.getElementById('routing-end-feature');
    this.updateFeatureSelect(layerSelect.value, featureSelect);
    routingTool.endPoint = null;
    routingTool.updateMarkers();
    this.updateUI();
  }

  /**
   * 피처 셀렉트 업데이트
   */
  updateFeatureSelect(layerId, selectElement) {
    selectElement.innerHTML = '<option value="">피처 선택...</option>';

    if (!layerId) return;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    const features = layerInfo.source.getFeatures();

    features.forEach((feature, index) => {
      const props = feature.getProperties();
      let featureName = props.name || props.NAME || props.id || props.ID || `피처 ${index + 1}`;

      if (typeof featureName === 'object') {
        featureName = `피처 ${index + 1}`;
      }

      const option = document.createElement('option');
      option.value = index;
      option.textContent = featureName;
      selectElement.appendChild(option);
    });
  }

  /**
   * 출발지 피처 선택
   */
  onStartFeatureSelected() {
    const layerSelect = document.getElementById('routing-start-layer');
    const featureSelect = document.getElementById('routing-start-feature');

    const point = this.getPointFromSelection(layerSelect.value, featureSelect.value);
    if (point) {
      routingTool.startPoint = point;
      routingTool.updateMarkers();
    } else {
      routingTool.startPoint = null;
      routingTool.updateMarkers();
    }

    this.updateUI();
  }

  /**
   * 도착지 피처 선택
   */
  onEndFeatureSelected() {
    const layerSelect = document.getElementById('routing-end-layer');
    const featureSelect = document.getElementById('routing-end-feature');

    const point = this.getPointFromSelection(layerSelect.value, featureSelect.value);
    if (point) {
      routingTool.endPoint = point;
      routingTool.updateMarkers();
    } else {
      routingTool.endPoint = null;
      routingTool.updateMarkers();
    }

    this.updateUI();
  }

  /**
   * 선택에서 포인트 좌표 가져오기
   */
  getPointFromSelection(layerId, featureIndex) {
    if (!layerId || featureIndex === '') return null;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return null;

    const features = layerInfo.source.getFeatures();
    const feature = features[parseInt(featureIndex)];
    if (!feature) return null;

    const geometry = feature.getGeometry();
    let coordinate;

    if (geometry.getType() === 'Point') {
      coordinate = geometry.getCoordinates();
    } else if (geometry.getType() === 'MultiPoint') {
      coordinate = geometry.getCoordinates()[0];
    }

    if (coordinate) {
      const lonLat = transform(coordinate, 'EPSG:3857', 'EPSG:4326');
      return { lonLat, coordinate };
    }

    return null;
  }

  /**
   * 출발/도착 교환
   */
  swapPoints() {
    const startLayerSelect = document.getElementById('routing-start-layer');
    const startFeatureSelect = document.getElementById('routing-start-feature');
    const endLayerSelect = document.getElementById('routing-end-layer');
    const endFeatureSelect = document.getElementById('routing-end-feature');

    // 값 교환
    const tempLayer = startLayerSelect.value;
    const tempFeature = startFeatureSelect.value;

    startLayerSelect.value = endLayerSelect.value;
    endLayerSelect.value = tempLayer;

    // 피처 목록 업데이트
    this.updateFeatureSelect(startLayerSelect.value, startFeatureSelect);
    this.updateFeatureSelect(endLayerSelect.value, endFeatureSelect);

    // 피처 선택 복원
    startFeatureSelect.value = endFeatureSelect.value;
    endFeatureSelect.value = tempFeature;

    // 도구 상태 업데이트
    routingTool.swapStartEnd();

    this.updateUI();
  }

  /**
   * UI 상태 업데이트
   */
  updateUI() {
    const analyzeBtn = document.getElementById('routing-analyze');
    if (!analyzeBtn) return;

    const apiKey = document.getElementById('routing-api-key').value;
    const state = routingTool.getState();

    const canAnalyze = apiKey && state.startPoint && state.endPoint;
    analyzeBtn.disabled = !canAnalyze;

    // 경로 결과 표시
    const resultDiv = document.getElementById('route-result');
    if (state.routeInfo) {
      resultDiv.style.display = 'block';
      document.getElementById('route-distance').textContent = state.routeInfo.distanceText;
      document.getElementById('route-duration').textContent = state.routeInfo.durationText;
    } else {
      resultDiv.style.display = 'none';
    }
  }

  /**
   * 경로 분석 실행
   */
  async analyze() {
    const apiKey = document.getElementById('routing-api-key').value;
    if (!apiKey) {
      alert('API 키를 입력해주세요.');
      return;
    }

    const state = routingTool.getState();
    if (!state.startPoint || !state.endPoint) {
      alert('출발지와 도착지를 모두 선택해주세요.');
      return;
    }

    const profile = document.getElementById('routing-profile').value;

    const analyzeBtn = document.getElementById('routing-analyze');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '검색 중...';

    try {
      const result = await routingTool.analyze({ profile });

      // 결과 표시
      document.getElementById('route-result').style.display = 'block';
      document.getElementById('route-distance').textContent = result.distanceText;
      document.getElementById('route-duration').textContent = result.durationText;

      alert(`경로 검색 완료!\n거리: ${result.distanceText}\n예상 시간: ${result.durationText}`);

    } catch (error) {
      alert('경로 검색 실패: ' + error.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '경로 검색';
      this.updateUI();
    }
  }

  /**
   * 결과 지우기
   */
  clearResults() {
    routingTool.clear();

    const startFeatureSelect = document.getElementById('routing-start-feature');
    const endFeatureSelect = document.getElementById('routing-end-feature');

    if (startFeatureSelect) startFeatureSelect.value = '';
    if (endFeatureSelect) endFeatureSelect.value = '';

    this.updateUI();
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

export const routingPanel = new RoutingPanel();
