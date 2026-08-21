// © 2026 김용현
/**
 * FeatureInfoCard - 선택한 피처의 속성을 지도 위 카드로 보여준다.
 *
 * 속성테이블은 패널이라 피처를 고르는 동안 최소화되거나 가려진다.
 * 이 카드는 범례(ChoroplethTool.createLegend)와 같은 지도 오버레이라 그 문제가 없다.
 *
 * 보이는 조건: 선택 도구 활성 AND 버튼 ON AND 선택 피처 1개 이상
 */

import { escapeHtml } from '../utils/escapeHtml.js';
import { makeDraggable } from '../utils/DraggableElement.js';
import { buildFeatureInfoSections } from './featureInfoModel.js';
import { layerManager } from '../core/LayerManager.js';
import { labelTool } from '../tools/LabelTool.js';
import { selectTool } from '../tools/SelectTool.js';

class FeatureInfoCard {
  constructor() {
    this.el = null;
    this.enabled = false;
    this.collapsed = new Set();   // 접어둔 섹션 key
    this.position = null;         // 드래그로 옮긴 위치 { left, top }
    this.size = null;             // 손잡이로 조절한 크기 { width, height }
    this.onChange = null;         // 툴바 버튼 상태 동기화 콜백
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(on) {
    const next = !!on;
    if (this.enabled === next) {
      this.refresh();
      return;
    }
    this.enabled = next;
    if (!next) this.collapsed.clear();
    this.refresh();
    if (typeof this.onChange === 'function') this.onChange();
  }

  /** 표시 조건을 다시 따져 카드를 그리거나 지운다 */
  refresh() {
    const features = selectTool.getIsActive() ? selectTool.getSelectedFeatures() : [];

    if (!this.enabled || features.length === 0) {
      this.remove();
      return;
    }

    this.render(features);
  }

  render(features) {
    const sections = buildFeatureInfoSections(features, {
      findLayer: (feature) => this.findLayer(feature),
      getLabelField: (layerId) => {
        const config = labelTool.getLabelConfig(layerId);
        return config && config.field ? config.field : null;
      }
    });

    const el = this.ensureElement();
    if (!el) return;

    const titleEl = el.querySelector('.feature-info-title');
    if (titleEl) titleEl.textContent = `속성 정보 (${sections.length}개 선택)`;

    const body = el.querySelector('.feature-info-body');
    const scrollTop = body.scrollTop;
    body.innerHTML = sections.map((section) => this.sectionHtml(section)).join('');
    body.scrollTop = scrollTop;
  }

  sectionHtml(section) {
    const isCollapsed = this.collapsed.has(section.key);
    const rows = section.attributes.map((attr) => `
        <div class="feature-info-row">
          <dt title="${escapeHtml(attr.name)}">${escapeHtml(attr.name)}</dt>
          <dd>${escapeHtml(attr.value)}</dd>
        </div>`).join('');

    return `
      <section class="feature-info-section${isCollapsed ? ' collapsed' : ''}" data-key="${escapeHtml(section.key)}">
        <button type="button" class="feature-info-section-header">
          <span class="feature-info-caret">${isCollapsed ? '▸' : '▾'}</span>
          <span class="feature-info-name" title="${escapeHtml(section.title)}">${escapeHtml(section.title)}</span>
          ${section.layerName ? `<span class="feature-info-layer" title="${escapeHtml(section.layerName)}">${escapeHtml(section.layerName)}</span>` : ''}
        </button>
        <dl class="feature-info-attrs">${rows}</dl>
      </section>`;
  }

  ensureElement() {
    if (this.el && this.el.isConnected) return this.el;

    const mapContainer = document.getElementById('map');
    if (!mapContainer) return null;

    const el = document.createElement('div');
    el.className = 'feature-info-card';
    el.innerHTML = `
      <div class="feature-info-header">
        <span class="feature-info-title">속성 정보</span>
        <button type="button" class="feature-info-close" title="닫기">&times;</button>
      </div>
      <div class="feature-info-body"></div>
      <div class="feature-info-resize" title="끌어서 카드 크기 조절"></div>`;

    // 마지막으로 옮긴 자리·크기 그대로 다시 띄운다
    if (this.position) {
      el.style.left = this.position.left;
      el.style.top = this.position.top;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
    if (this.size) {
      el.style.width = this.size.width;
      el.style.height = this.size.height;
      el.style.maxHeight = 'none';
    }

    el.querySelector('.feature-info-resize')
      .addEventListener('pointerdown', (event) => this.startResize(event));

    el.querySelector('.feature-info-close').addEventListener('click', () => {
      this.setEnabled(false);
    });

    // 섹션 헤더 클릭 → 접기/펼치기
    el.querySelector('.feature-info-body').addEventListener('click', (event) => {
      const header = event.target.closest('.feature-info-section-header');
      if (!header) return;
      const section = header.closest('.feature-info-section');
      const key = section && section.dataset.key;
      if (!key) return;

      if (this.collapsed.has(key)) this.collapsed.delete(key);
      else this.collapsed.add(key);

      section.classList.toggle('collapsed');
      const caret = section.querySelector('.feature-info-caret');
      if (caret) caret.textContent = this.collapsed.has(key) ? '▸' : '▾';
    });

    mapContainer.appendChild(el);
    makeDraggable(el, () => mapContainer);

    this.el = el;
    return el;
  }

  /**
   * 우하단 손잡이로 카드 크기 조절.
   * makeDraggable 이 카드 전체의 pointerdown 을 잡으므로 여기서 전파를 끊는다.
   * (MapImageOverlay 의 크기 조절과 같은 방식)
   */
  startResize(event) {
    event.preventDefault();
    event.stopPropagation();

    const el = this.el;
    if (!el) return;

    const mapContainer = document.getElementById('map');
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;

    // 지도 밖으로 넘어가지 않게 상한을 잡는다
    const rect = el.getBoundingClientRect();
    const bounds = mapContainer ? mapContainer.getBoundingClientRect() : null;
    const maxWidth = bounds ? bounds.right - rect.left - 4 : Infinity;
    const maxHeight = bounds ? bounds.bottom - rect.top - 4 : Infinity;

    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

    const onMove = (moveEvent) => {
      const width = clamp(startWidth + moveEvent.clientX - startX, 180, maxWidth);
      const height = clamp(startHeight + moveEvent.clientY - startY, 120, maxHeight);

      el.style.width = `${Math.round(width)}px`;
      el.style.height = `${Math.round(height)}px`;
      el.style.maxHeight = 'none'; // 손으로 정한 크기가 60% 제한보다 우선한다
      this.size = { width: el.style.width, height: el.style.height };
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  remove() {
    if (!this.el) return;
    // 다시 띄울 때 같은 자리·크기로 오도록 기억한다
    if (this.el.style.left) {
      this.position = { left: this.el.style.left, top: this.el.style.top };
    }
    if (this.el.style.height) {
      this.size = { width: this.el.style.width, height: this.el.style.height };
    }
    this.el.remove();
    this.el = null;
  }

  /** 피처가 속한 레이어 찾기 (SelectTool 과 같은 방식) */
  findLayer(feature) {
    const layers = layerManager.getAllLayers();
    for (const layerInfo of layers) {
      if (!layerInfo || !layerInfo.source || typeof layerInfo.source.hasFeature !== 'function') continue;
      if (layerInfo.source.hasFeature(feature)) {
        return { id: layerInfo.id, name: layerInfo.name };
      }
    }
    return null;
  }
}

export const featureInfoCard = new FeatureInfoCard();
