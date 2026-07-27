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

    const pointLayers = this.getPointLayers();

    // 선택 중인 레이어가 포인트면 미리 골라 준다.
    this.selectedLayerId = resolveInitialLayerId(pointLayers, layerManager.getSelectedLayerId()) || null;

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay isochrone-modal active';
    this.modal.innerHTML = this.getModalHTML(pointLayers);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateFeatureList();
    this.updateAnalyzeButton();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(pointLayers) {
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
          <small class="form-hint">주요도로만 쓰면 가볍고 빠릅니다. 전체 도로는 골목까지 반영합니다.</small>
        </div>

        <div class="form-group">
          <label for="isochrone-layer">포인트 레이어</label>
          <select id="isochrone-layer">${layerOptions}</select>
        </div>

        <div class="form-row">
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
        </div>

        <div class="form-group" id="isochrone-merge-group" style="display:none">
          <label class="checkbox-label">
            <input type="checkbox" id="isochrone-merge" checked>
            <span>도달 범위 합치기</span>
          </label>
          <small class="form-hint">끄면 지점마다 범위 경계선이 그대로 보입니다. 켜면 하나의 영역으로 합쳐집니다.</small>
        </div>

        <div id="isochrone-speed-group">
          <div class="form-group">
            <label for="local-mode">이동 수단</label>
            <select id="local-mode">
              <option value="foot">도보 — 자동차전용도로 제외</option>
              <option value="bike">자전거 — 자동차전용도로 제외</option>
              <option value="car" selected>자동차 — 모든 도로</option>
            </select>
          </div>
          <div class="form-group">
            <label for="local-speed">이동 속도 (km/h)</label>
            <input type="number" id="local-speed" value="40" min="1" max="200" step="1">
            <small class="form-hint">이동 수단은 지날 수 있는 도로를, 속도는 걸리는 시간을 정합니다. 수단을 바꾸면 기본 속도가 채워지고, 값은 직접 고칠 수 있습니다.</small>
          </div>
        </div>

        <div class="form-group">
          <label for="intervals-input">시간 간격 (분)</label>
          <div class="intervals-input">
            <input type="text" id="intervals-input" value="5, 10, 15" placeholder="예: 5, 10, 15, 30">
            <small class="form-hint">쉼표로 구분하여 원하는 시간(분)을 입력하세요</small>
          </div>
        </div>

        <div class="isochrone-info">
          <p>등시선(Isochrone)은 특정 지점에서 일정 시간 안에 도달할 수 있는 영역을 표시합니다.</p>
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
    const layerSelect = document.getElementById('isochrone-layer');
    const featureSelect = document.getElementById('isochrone-feature');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    analyzeBtn.addEventListener('click', () => this.analyze());
    clearBtn.addEventListener('click', () => this.clearResults());

    // 쓸 수 있는 내장 도로망 목록을 catalog.json에서 채운다
    populateNetworkSelect('isochrone-engine');

    // 이동 수단을 바꾸면 그 수단의 기본 속도를 채워 준다
    const modeSelect = document.getElementById('local-mode');
    const speedInput = document.getElementById('local-speed');
    modeSelect.addEventListener('change', () => {
      speedInput.value = LOCAL_MODES[modeSelect.value].defaultSpeed;
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
   * 분석 버튼 상태 업데이트
   */
  updateAnalyzeButton() {
    const analyzeBtn = document.getElementById('isochrone-analyze');
    if (!analyzeBtn) return;

    const intervals = this.getSelectedIntervals();
    analyzeBtn.disabled = !(this.selectedPoint && intervals.length > 0);
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

    const network = parseNetworkValue(document.getElementById('isochrone-engine').value);

    const intervals = this.getSelectedIntervals();
    if (intervals.length === 0) {
      alert('최소 하나의 간격을 선택해주세요.');
      return;
    }

    // 내장 도로망은 시간 기준만 지원한다 (localRouting.js) — 거리 기준은 ORS 전용이었다
    const rangeType = 'time';
    const engine = network.engine;

    const analyzeBtn = document.getElementById('isochrone-analyze');
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';

    try {
      const mode = LOCAL_MODES[document.getElementById('local-mode').value] || LOCAL_MODES.car;
      const speedKmh = parseFloat(document.getElementById('local-speed').value);

      const result = await isochroneTool.analyze(this.selectedPoint, {
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
