/**
 * SpatialOperationsPanel - 공간 연산 설정 패널
 */

import { spatialOperationsTool } from '../../tools/SpatialOperationsTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { resolveInitialLayerId } from '../../utils/layerSelect.js';

class SpatialOperationsPanel {
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
   * 모달 렌더링
   */
  render() {
    this.close();

    const polygonLayers = spatialOperationsTool.getPolygonLayers();
    const pointLayers = spatialOperationsTool.getPointLayers();
    const operations = spatialOperationsTool.getOperations();

    const canDoPolygonOps = polygonLayers.length >= 2;
    const canCountPoints = polygonLayers.length >= 1 && pointLayers.length >= 1;

    if (!canDoPolygonOps && !canCountPoints) {
      alert('공간 연산을 수행하려면 폴리곤 레이어 2개,\n또는 폴리곤·포인트 레이어가 각각 1개 이상 필요합니다.');
      return;
    }

    // 상태 저장 (연산별 드롭다운 재구성에 사용)
    this.polygonLayers = polygonLayers;
    this.pointLayers = pointLayers;

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay spatial-ops-modal active';
    this.modal.innerHTML = this.getModalHTML(polygonLayers, operations);
    document.body.appendChild(this.modal);

    // 선택 중인 레이어를 쓸 수 있으면 입력 레이어 1로 미리 골라 준다.
    // (updateDescription → populateLayerSelects가 이 값을 유지하고 레이어 2를 다른 것으로 맞춘다)
    const preferredId = resolveInitialLayerId(polygonLayers, layerManager.getSelectedLayerId());
    if (preferredId) {
      document.getElementById('spatial-ops-layer1').value = preferredId;
    }

    this.bindEvents();
    this.updateDescription();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML(layers, operations) {
    const layerOptions = layers.map(l =>
      '<option value="' + l.id + '">' + l.name + ' (' + l.featureCount + ')</option>'
    ).join('');

    const operationOptions = operations.map(op =>
      '<option value="' + op.value + '">' + op.label + '</option>'
    ).join('');

    return '<div class="modal-content spatial-ops-content">' +
      '<div class="modal-header">' +
        '<h3>공간 연산</h3>' +
        '<button class="modal-close" id="spatial-ops-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="form-group">' +
          '<label for="spatial-ops-operation">연산 유형</label>' +
          '<select id="spatial-ops-operation">' + operationOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label id="layer1-label">입력 레이어 1</label>' +
          '<select id="spatial-ops-layer1">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label id="layer2-label">입력 레이어 2</label>' +
          '<select id="spatial-ops-layer2">' + layerOptions + '</select>' +
        '</div>' +
        '<div class="form-group spatial-ops-optgroup" id="spatial-ops-mode-group">' +
          '<label>결과 형태</label>' +
          '<label class="spatial-ops-option">' +
            '<input type="radio" name="spatial-ops-mode" value="clip" checked>' +
            '<span id="mode-clip-label">겹치는 부분만 잘라내기</span>' +
          '</label>' +
          '<label class="spatial-ops-option">' +
            '<input type="radio" name="spatial-ops-mode" value="keep">' +
            '<span id="mode-keep-label">겹치는 피처를 통째로 유지 (자르지 않음)</span>' +
          '</label>' +
          '<small class="spatial-ops-hint" id="mode-hint"></small>' +
        '</div>' +
        '<div class="form-group spatial-ops-optgroup" id="spatial-ops-union-group">' +
          '<label>합집합 방식</label>' +
          '<label class="spatial-ops-option">' +
            '<input type="checkbox" id="spatial-ops-dissolve" checked>' +
            '<span>하나의 도형으로 병합</span>' +
          '</label>' +
          '<small class="spatial-ops-hint">' +
            '체크하면 경계선을 없애고 바깥 윤곽만 남깁니다 (속성 없음). ' +
            '해제하면 각 피처를 그대로 두어 속성이 유지되고 출처레이어 필드가 추가됩니다.' +
          '</small>' +
        '</div>' +
        '<div class="operation-description" id="operation-desc">' +
          '<p>두 레이어가 겹치는 영역을 추출합니다.</p>' +
        '</div>' +
        '<div class="operation-preview">' +
          '<div class="preview-diagram" id="preview-diagram">' +
            '<div class="preview-shape shape1"></div>' +
            '<div class="preview-shape shape2"></div>' +
            '<div class="preview-result"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" id="spatial-ops-cancel">취소</button>' +
        '<button class="btn btn-primary" id="spatial-ops-apply">연산 실행</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 레이어 목록 → option HTML
   */
  layerOptionsHTML(layers) {
    return layers.map(l =>
      '<option value="' + l.id + '">' + l.name + ' (' + l.featureCount + ')</option>'
    ).join('');
  }

  /**
   * 연산 유형에 맞게 레이어1/레이어2 드롭다운 채우기
   */
  populateLayerSelects(operation) {
    const layer1Select = document.getElementById('spatial-ops-layer1');
    const layer2Select = document.getElementById('spatial-ops-layer2');
    if (!layer1Select || !layer2Select) return;

    const prev1 = layer1Select.value;
    const prev2 = layer2Select.value;

    if (operation === 'pointsInPolygon') {
      // 레이어1 = 폴리곤, 레이어2 = 포인트
      layer1Select.innerHTML = this.layerOptionsHTML(this.polygonLayers);
      layer2Select.innerHTML = this.layerOptionsHTML(this.pointLayers);
    } else {
      // 폴리곤 ↔ 폴리곤
      layer1Select.innerHTML = this.layerOptionsHTML(this.polygonLayers);
      layer2Select.innerHTML = this.layerOptionsHTML(this.polygonLayers);
    }

    // 가능하면 이전 선택 유지
    if ([...layer1Select.options].some(o => o.value === prev1)) layer1Select.value = prev1;
    if ([...layer2Select.options].some(o => o.value === prev2)) layer2Select.value = prev2;

    // 같은 목록을 공유하는 연산에서 두 선택이 겹치면 분리
    if (operation !== 'pointsInPolygon' && layer1Select.value === layer2Select.value) {
      const alt = [...layer2Select.options].find(o => o.value !== layer1Select.value);
      if (alt) layer2Select.value = alt.value;
    }
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('spatial-ops-close');
    const cancelBtn = document.getElementById('spatial-ops-cancel');
    const applyBtn = document.getElementById('spatial-ops-apply');
    const operationSelect = document.getElementById('spatial-ops-operation');
    const layer1Select = document.getElementById('spatial-ops-layer1');
    const layer2Select = document.getElementById('spatial-ops-layer2');

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());

    // 연산 변경 시 설명 업데이트
    operationSelect.addEventListener('change', () => this.updateDescription());

    // 레이어 선택 변경 시 다른 선택 확인 (폴리곤↔폴리곤 연산에서만 중복 방지)
    layer1Select.addEventListener('change', () => {
      if (operationSelect.value === 'pointsInPolygon') return;
      if (layer1Select.value === layer2Select.value) {
        const options = layer2Select.options;
        for (let i = 0; i < options.length; i++) {
          if (options[i].value !== layer1Select.value) {
            layer2Select.value = options[i].value;
            break;
          }
        }
      }
    });

    // 연산 실행
    applyBtn.addEventListener('click', () => this.executeOperation());
  }

  /**
   * 연산 설명 업데이트
   */
  updateDescription() {
    const operationSelect = document.getElementById('spatial-ops-operation');
    const descEl = document.getElementById('operation-desc');
    const previewEl = document.getElementById('preview-diagram');
    const layer1Label = document.getElementById('layer1-label');
    const layer2Label = document.getElementById('layer2-label');

    const operation = operationSelect.value;

    const descriptions = {
      intersect: '두 레이어가 겹치는 영역을 추출합니다. 양쪽 레이어의 속성이 모두 승계됩니다.',
      union: '두 레이어의 영역을 합칩니다.',
      difference: '첫 번째 레이어에서 두 번째 레이어와 겹치는 부분을 제거합니다. 입력 레이어의 속성은 유지됩니다.',
      clip: '입력 레이어를 클립 레이어의 범위로 자릅니다. 양쪽 레이어의 속성이 모두 승계됩니다.',
      pointsInPolygon: '폴리곤 안에 들어가는 포인트만 남기고, 각 포인트에 포함하는 폴리곤의 속성을 poly_ 접두사로 추가합니다.'
    };

    const labels = {
      intersect: { l1: '레이어 1', l2: '레이어 2' },
      union: { l1: '레이어 1', l2: '레이어 2' },
      difference: { l1: '입력 레이어 (유지)', l2: '제거할 레이어' },
      clip: { l1: '입력 레이어', l2: '클립 레이어' },
      pointsInPolygon: { l1: '폴리곤 레이어', l2: '포인트 레이어' }
    };

    descEl.innerHTML = '<p>' + (descriptions[operation] || '') + '</p>';
    layer1Label.textContent = labels[operation]?.l1 || '레이어 1';
    layer2Label.textContent = labels[operation]?.l2 || '레이어 2';

    // 연산별 옵션 표시
    this.updateOptions(operation);

    // 연산에 맞게 레이어 드롭다운 재구성
    this.populateLayerSelects(operation);

    // 미리보기 다이어그램 업데이트
    previewEl.className = 'preview-diagram ' + operation;
  }

  /**
   * 연산에 맞는 옵션만 보여준다.
   * - 교차·클리핑·차집합: 자르기 / 피처 통째로 (결과 형태)
   * - 합집합: 하나로 병합 여부
   * - 포인트 추출: 옵션 없음
   */
  updateOptions(operation) {
    const modeGroup = document.getElementById('spatial-ops-mode-group');
    const unionGroup = document.getElementById('spatial-ops-union-group');
    const keepLabel = document.getElementById('mode-keep-label');
    const hint = document.getElementById('mode-hint');
    if (!modeGroup || !unionGroup) return;

    const hasMode = ['intersect', 'clip', 'difference'].includes(operation);

    modeGroup.style.display = hasMode ? '' : 'none';
    unionGroup.style.display = operation === 'union' ? '' : 'none';

    if (!hasMode) return;

    if (operation === 'difference') {
      keepLabel.textContent = '겹치는 피처를 통째로 제외 (자르지 않음)';
      hint.textContent = '겹치는 피처를 잘라내는 대신 통째로 빼고, 남는 피처는 원본 그대로 유지합니다.';
    } else {
      keepLabel.textContent = '겹치는 피처를 통째로 유지 (자르지 않음)';
      hint.textContent = '겹치는 피처를 원본 모양 그대로 남깁니다. 상대 피처가 여럿이면 가장 넓게 겹친 피처의 속성을 가져옵니다.';
    }
  }

  /**
   * 선택된 결과 형태 → 도구 옵션
   */
  readOptions(operation) {
    if (operation === 'union') {
      const dissolve = document.getElementById('spatial-ops-dissolve');
      return { dissolve: dissolve ? dissolve.checked : true };
    }

    const checked = document.querySelector('input[name="spatial-ops-mode"]:checked');
    return { keepFeatures: checked ? checked.value === 'keep' : false };
  }

  /**
   * 연산 실행
   */
  executeOperation() {
    const operation = document.getElementById('spatial-ops-operation').value;
    const layerId1 = document.getElementById('spatial-ops-layer1').value;
    const layerId2 = document.getElementById('spatial-ops-layer2').value;

    // 폴리곤↔폴리곤 연산은 서로 다른 레이어여야 함 (포인트 추출은 타입이 달라 허용)
    if (operation !== 'pointsInPolygon' && layerId1 === layerId2) {
      alert('서로 다른 레이어를 선택해주세요.');
      return;
    }

    const applyBtn = document.getElementById('spatial-ops-apply');
    applyBtn.disabled = true;
    applyBtn.textContent = '처리 중...';

    const options = this.readOptions(operation);

    try {
      let result;

      switch (operation) {
        case 'intersect':
          result = spatialOperationsTool.intersect(layerId1, layerId2, options);
          break;
        case 'union':
          result = spatialOperationsTool.union(layerId1, layerId2, options);
          break;
        case 'difference':
          result = spatialOperationsTool.difference(layerId1, layerId2, options);
          break;
        case 'clip':
          result = spatialOperationsTool.clip(layerId1, layerId2, options);
          break;
        case 'pointsInPolygon':
          result = spatialOperationsTool.pointsInPolygons(layerId1, layerId2);
          break;
        default:
          throw new Error('알 수 없는 연산입니다.');
      }

      if (operation === 'pointsInPolygon') {
        alert(
          `포인트 추출 완료!\n새 레이어: ${result.layerName}\n` +
          `폴리곤 내 포인트 ${result.insidePoints}개 / 전체 ${result.totalPoints}개` +
          (result.insidePoints < result.totalPoints
            ? `\n(폴리곤 밖 포인트 ${result.totalPoints - result.insidePoints}개 제외)`
            : '')
        );
      } else {
        alert(`연산 완료!\n새 레이어: ${result.layerName}\n피처 수: ${result.featureCount}`);
      }
      this.close();
    } catch (error) {
      alert('연산 실패: ' + error.message);
      applyBtn.disabled = false;
      applyBtn.textContent = '연산 실행';
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

export const spatialOperationsPanel = new SpatialOperationsPanel();
