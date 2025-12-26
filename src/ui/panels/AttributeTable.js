/**
 * AttributeTable - 속성 테이블 컴포넌트
 */

import { eventBus, Events } from '../../utils/EventBus.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';
import Select from 'ol/interaction/Select';
import { click } from 'ol/events/condition';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';

// 하이라이트 스타일
const HIGHLIGHT_STYLE = new Style({
  fill: new Fill({ color: 'rgba(255, 193, 7, 0.4)' }),
  stroke: new Stroke({ color: '#ffc107', width: 3 }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#ffc107' }),
    stroke: new Stroke({ color: '#fff', width: 2 })
  })
});

export class AttributeTable {
  constructor() {
    this.container = null;
    this.currentLayerId = null;
    this.features = [];
    this.columns = [];
    this.selectedFeatureId = null;
    this.highlightSelect = null;
    this.sortColumn = null;
    this.sortAsc = true;
    this.initialized = false;

    this.bindEvents();
  }

  /**
   * 초기화 (DOM 준비 후 호출)
   */
  init() {
    if (this.initialized) return;
    this.createContainer();
    this.initialized = true;
  }

  /**
   * 컨테이너 생성
   */
  createContainer() {
    // 속성 테이블 패널 생성
    this.container = document.createElement('div');
    this.container.id = 'attribute-panel';
    this.container.className = 'attribute-panel';
    this.container.innerHTML = `
      <div class="attribute-header">
        <div class="attribute-title">
          <span class="attribute-layer-name">속성 테이블</span>
          <span class="attribute-count"></span>
        </div>
        <div class="attribute-actions">
          <button class="btn-icon" id="attr-zoom-selected" title="선택 피처로 이동">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          <button class="btn-icon" id="attr-close" title="닫기">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="attribute-content">
        <table class="attribute-table">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    // main-container 뒤에 삽입
    const mainContainer = document.getElementById('main-container');
    mainContainer.parentNode.insertBefore(this.container, mainContainer.nextSibling);

    // 닫기 버튼
    this.container.querySelector('#attr-close').addEventListener('click', () => {
      this.close();
    });

    // 선택 피처로 이동 버튼
    this.container.querySelector('#attr-zoom-selected').addEventListener('click', () => {
      this.zoomToSelected();
    });
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 레이어 테이블 열기 이벤트
    eventBus.on('layer:openTable', ({ layerId }) => {
      this.open(layerId);
    });

    // 레이어 삭제 시 테이블 닫기
    eventBus.on(Events.LAYER_REMOVED, ({ layerId }) => {
      if (this.currentLayerId === layerId) {
        this.close();
      }
    });

    // 피처 생성/삭제 시 테이블 갱신
    eventBus.on(Events.FEATURE_CREATED, () => {
      if (this.currentLayerId) {
        this.refresh();
      }
    });

    eventBus.on(Events.FEATURE_DELETED, () => {
      if (this.currentLayerId) {
        this.refresh();
      }
    });
  }

  /**
   * 속성 테이블 열기
   */
  open(layerId) {
    // DOM 준비 확인
    this.init();

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    this.currentLayerId = layerId;
    this.features = layerInfo.source.getFeatures();

    // 컬럼 추출
    this.extractColumns();

    // 테이블 렌더링
    this.render();

    // 패널 표시
    this.container.classList.add('open');

    // 하이라이트 인터랙션 설정
    this.setupHighlight(layerInfo);

    // 지도 크기 조정
    setTimeout(() => mapManager.updateSize(), 300);
  }

  /**
   * 속성 테이블 닫기
   */
  close() {
    if (!this.container) return;

    this.container.classList.remove('open');
    this.currentLayerId = null;
    this.features = [];
    this.columns = [];
    this.selectedFeatureId = null;

    // 하이라이트 제거
    this.removeHighlight();

    // 지도 크기 조정
    setTimeout(() => mapManager.updateSize(), 300);
  }

  /**
   * 테이블 새로고침
   */
  refresh() {
    if (!this.currentLayerId) return;

    const layerInfo = layerManager.getLayer(this.currentLayerId);
    if (!layerInfo) {
      this.close();
      return;
    }

    this.features = layerInfo.source.getFeatures();
    this.extractColumns();
    this.render();
  }

  /**
   * 컬럼 추출
   */
  extractColumns() {
    const columnSet = new Set();

    this.features.forEach(feature => {
      const props = feature.getProperties();
      Object.keys(props).forEach(key => {
        if (key !== 'geometry') {
          columnSet.add(key);
        }
      });
    });

    this.columns = Array.from(columnSet);
  }

  /**
   * 테이블 렌더링
   */
  render() {
    const layerInfo = layerManager.getLayer(this.currentLayerId);
    if (!layerInfo) return;

    // 헤더 업데이트
    this.container.querySelector('.attribute-layer-name').textContent = layerInfo.name;
    this.container.querySelector('.attribute-count').textContent = `(${this.features.length}개)`;

    // 정렬 적용
    let sortedFeatures = [...this.features];
    if (this.sortColumn) {
      sortedFeatures.sort((a, b) => {
        const valA = a.get(this.sortColumn) || '';
        const valB = b.get(this.sortColumn) || '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return this.sortAsc ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return this.sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    // 테이블 헤더
    const thead = this.container.querySelector('thead');
    thead.innerHTML = `
      <tr>
        <th class="row-num">#</th>
        ${this.columns.map(col => `
          <th class="sortable ${this.sortColumn === col ? (this.sortAsc ? 'asc' : 'desc') : ''}"
              data-column="${col}">
            ${col}
            <span class="sort-icon"></span>
          </th>
        `).join('')}
      </tr>
    `;

    // 정렬 클릭 이벤트
    thead.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.column;
        if (this.sortColumn === col) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortColumn = col;
          this.sortAsc = true;
        }
        this.render();
      });
    });

    // 테이블 바디
    const tbody = this.container.querySelector('tbody');
    tbody.innerHTML = sortedFeatures.map((feature, index) => {
      const featureId = feature.ol_uid;
      const isSelected = featureId === this.selectedFeatureId;

      return `
        <tr data-feature-id="${featureId}" class="${isSelected ? 'selected' : ''}">
          <td class="row-num">${index + 1}</td>
          ${this.columns.map(col => {
            const value = feature.get(col);
            const displayValue = value !== undefined && value !== null ? value : '';
            return `<td title="${displayValue}">${displayValue}</td>`;
          }).join('')}
        </tr>
      `;
    }).join('');

    // 행 클릭 이벤트
    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const featureId = parseInt(tr.dataset.featureId);
        this.selectFeature(featureId);
      });

      tr.addEventListener('dblclick', () => {
        const featureId = parseInt(tr.dataset.featureId);
        this.selectFeature(featureId);
        this.zoomToSelected();
      });
    });
  }

  /**
   * 피처 선택
   */
  selectFeature(featureId) {
    this.selectedFeatureId = featureId;

    // 테이블 행 하이라이트
    this.container.querySelectorAll('tbody tr').forEach(tr => {
      tr.classList.remove('selected');
      if (parseInt(tr.dataset.featureId) === featureId) {
        tr.classList.add('selected');
        // 스크롤
        tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // 지도에서 하이라이트
    const feature = this.features.find(f => f.ol_uid === featureId);
    if (feature && this.highlightSelect) {
      this.highlightSelect.getFeatures().clear();
      this.highlightSelect.getFeatures().push(feature);
    }

    eventBus.emit(Events.FEATURE_SELECTED, { feature });
  }

  /**
   * 선택된 피처로 이동
   */
  zoomToSelected() {
    const feature = this.features.find(f => f.ol_uid === this.selectedFeatureId);
    if (!feature) return;

    const geometry = feature.getGeometry();
    const extent = geometry.getExtent();

    mapManager.fitExtent(extent, {
      padding: [100, 100, 100, 100],
      maxZoom: 15
    });
  }

  /**
   * 하이라이트 인터랙션 설정
   */
  setupHighlight(layerInfo) {
    this.removeHighlight();

    const map = mapManager.getMap();

    this.highlightSelect = new Select({
      condition: () => false, // 클릭으로 선택 안 함 (테이블에서만)
      style: HIGHLIGHT_STYLE,
      layers: [layerInfo.olLayer]
    });

    map.addInteraction(this.highlightSelect);
  }

  /**
   * 하이라이트 제거
   */
  removeHighlight() {
    if (this.highlightSelect) {
      const map = mapManager.getMap();
      if (map) {
        map.removeInteraction(this.highlightSelect);
      }
      this.highlightSelect = null;
    }
  }

  /**
   * 지도에서 피처 클릭 시 테이블 동기화
   */
  syncFromMap(feature) {
    if (!feature || !this.currentLayerId) return;

    const featureId = feature.ol_uid;
    this.selectFeature(featureId);
  }
}

// 싱글톤 인스턴스
export const attributeTable = new AttributeTable();
