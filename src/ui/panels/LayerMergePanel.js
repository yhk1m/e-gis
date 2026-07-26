// © 2026 김용현
/**
 * LayerMergePanel - 여러 레이어를 하나로 합치는 패널
 *
 * 레이어 목록에서 미리 고르지 않고, 이 창 안에서 체크해 고른다.
 */

import { layerCombineTool, SOURCE_FIELD } from '../../tools/LayerCombineTool.js';
import { layerManager } from '../../core/LayerManager.js';

const GEOMETRY_LABEL = {
  Point: '점', MultiPoint: '점',
  LineString: '선', MultiLineString: '선',
  Polygon: '면', MultiPolygon: '면'
};

class LayerMergePanel {
  constructor() {
    this.modal = null;
  }

  show() {
    const layers = layerCombineTool.getCompatibleLayers();
    if (layers.length < 2) {
      alert('합칠 레이어가 2개 이상 필요합니다.\n(객체가 있는 벡터 레이어만 합칠 수 있습니다)');
      return;
    }
    this.render(layers);
  }

  render(layers) {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'choropleth-modal'; // 동일한 모달 스타일 사용
    this.modal.innerHTML = this.getModalHTML(layers);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateState();
  }

  getModalHTML(layers) {
    const items = layers.map(l => {
      const geom = GEOMETRY_LABEL[l.geometryType] || l.geometryType || '?';
      return `
        <label class="field-checkbox">
          <input type="checkbox" value="${l.id}">
          <span>${this.escape(l.name)} <small>(${geom} · ${l.featureCount}개)</small></span>
        </label>`;
    }).join('');

    return `<div class="choropleth-content" style="width: 420px;">
      <div class="choropleth-header">
        <h3>레이어 합치기</h3>
        <button class="choropleth-close" id="merge-close">&times;</button>
      </div>
      <div class="choropleth-body">
        <div class="choropleth-form-group">
          <label>합칠 레이어 (2개 이상)</label>
          <label class="field-checkbox" style="border-bottom:1px solid var(--border-color); padding-bottom:6px; margin-bottom:4px">
            <input type="checkbox" id="merge-select-all">
            <span><strong>전체 선택</strong></span>
          </label>
          <div class="join-fields-list" id="merge-layer-list">${items}</div>
          <small class="form-hint" id="merge-count">선택된 레이어 없음</small>
        </div>

        <div class="choropleth-form-group">
          <label for="merge-name">결과 레이어 이름</label>
          <input type="text" id="merge-name" placeholder="비우면 자동으로 정해집니다">
        </div>

        <div class="choropleth-form-group">
          <label class="field-checkbox">
            <input type="checkbox" id="merge-keep-source" checked>
            <span>원본 레이어 이름을 속성(${SOURCE_FIELD})으로 남기기</span>
          </label>
          <label class="field-checkbox">
            <input type="checkbox" id="merge-remove-sources">
            <span>합친 뒤 원본 레이어 삭제</span>
          </label>
        </div>
      </div>
      <div class="choropleth-footer">
        <button class="btn btn-secondary" id="merge-cancel">취소</button>
        <button class="btn btn-primary" id="merge-apply" disabled>합치기</button>
      </div>
    </div>`;
  }

  escape(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  bindEvents() {
    const close = () => this.close();
    document.getElementById('merge-close').addEventListener('click', close);
    document.getElementById('merge-cancel').addEventListener('click', close);
    document.getElementById('merge-apply').addEventListener('click', () => this.apply());

    const list = document.getElementById('merge-layer-list');
    const selectAll = document.getElementById('merge-select-all');

    selectAll.addEventListener('change', () => {
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = selectAll.checked; });
      this.updateState();
    });

    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => this.updateState());
    });
  }

  /** 체크된 레이어 id */
  getSelected() {
    return Array.from(
      document.querySelectorAll('#merge-layer-list input[type="checkbox"]:checked')
    ).map(cb => cb.value);
  }

  updateState() {
    const selected = this.getSelected();
    const all = document.querySelectorAll('#merge-layer-list input[type="checkbox"]');
    const selectAll = document.getElementById('merge-select-all');

    // 전체 선택 체크박스는 개별 선택 상태를 따라간다
    selectAll.checked = selected.length === all.length && all.length > 0;
    selectAll.indeterminate = selected.length > 0 && selected.length < all.length;

    const countEl = document.getElementById('merge-count');
    countEl.textContent = selected.length === 0
      ? '선택된 레이어 없음'
      : `${selected.length}개 선택됨`;

    document.getElementById('merge-apply').disabled = selected.length < 2;
  }

  apply() {
    const layerIds = this.getSelected();
    if (layerIds.length < 2) {
      alert('레이어를 2개 이상 선택해주세요.');
      return;
    }

    try {
      const result = layerCombineTool.merge(layerIds, {
        name: document.getElementById('merge-name').value,
        keepSourceName: document.getElementById('merge-keep-source').checked,
        removeSources: document.getElementById('merge-remove-sources').checked
      });

      const layerInfo = layerManager.getLayer(result.layerId);
      let message = `레이어를 합쳤습니다.\n`
        + `- 합친 레이어: ${result.sourceCount}개\n`
        + `- 객체: ${result.featureCount}개\n`
        + `- 결과 레이어: ${layerInfo ? layerInfo.name : ''}`;

      // 점·선·면이 섞이면 스타일이 한 종류 기준으로만 잡힌다 — 미리 알려 준다
      if (result.geometryTypes.length > 1) {
        message += `\n\n※ 도형 종류가 섞여 있습니다 (${result.geometryTypes.join(', ')}).\n`
          + '스타일은 한 종류 기준으로 적용됩니다.';
      }

      alert(message);
      this.close();
    } catch (error) {
      alert('합치기 실패: ' + error.message);
    }
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const layerMergePanel = new LayerMergePanel();
