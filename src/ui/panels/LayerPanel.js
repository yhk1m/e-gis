/**
 * LayerPanel - 레이어 패널 UI 컴포넌트
 */

import { eventBus, Events } from '../../utils/EventBus.js';
import { askText } from '../../utils/askText.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';
import { rasterAnalysisTool } from '../../tools/RasterAnalysisTool.js';
import { cartogramTool } from '../../tools/CartogramTool.js';
import { saveTextAs } from '../../utils/saveFile.js';
import { swatchSpec, swatchHTML } from './layerSwatch.js';
import { flowPanel } from './FlowPanel.js';
import GeoJSON from 'ol/format/GeoJSON';
import { applyLegendVisibility } from '../../tools/legendVisibility.js';
import { showConfirm, showAlert } from '../../utils/dialogs.js';
import { fieldCalculatorPanel } from './FieldCalculatorPanel.js';
import { partitionStyleTargets, commonStyleControls, applyStyleToAll, geometryKind } from './batchStyle.js';

/** 선 아이콘(SVG). 화면 글자에 이모지를 쓰지 않는다 */
const ICON_PATHS = {
  selectMode: '<polyline points="3 7 5 9 9 5"/><line x1="13" y1="7" x2="21" y2="7"/><polyline points="3 16 5 18 9 14"/><line x1="13" y1="16" x2="21" y2="16"/>',
  check: '<polyline points="5 12 10 17 19 7"/>',
  style: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.3 0z"/>',
  duplicate: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  export: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  fieldCalc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="10" y2="11"/><line x1="14" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="10" y2="15"/><line x1="14" y1="15" x2="16" y2="15"/><line x1="8" y1="19" x2="16" y2="19"/>',
  zoom: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9"/><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
};
function icon(name, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/**
 * 슬라이더 + 숫자 입력 한 줄.
 * 대충 맞추는 건 슬라이더가 빠르고, 정확한 값은 숫자로 적는 게 빠르다. 둘 다 준다.
 * @param {string} label - 항목 이름 (예: "면 불투명도")
 * @param {string} cls - 컨트롤 식별 클래스 (예: "fill-opacity")
 * @param {number} value - 현재 값
 * @param {string} unit - 단위 표시 ("%" 또는 "px")
 * @param {number} min - 최솟값
 * @param {number} max - 최댓값
 * @param {number} step - 슬라이더 눈금 (숫자 입력은 자유롭게 받는다)
 */
function sliderRow(label, cls, value, unit, min, max, step) {
  return "<div class=\"style-section\"><label>" + label + ":</label>" +
    "<div class=\"slider-row\">" +
    "<input type=\"range\" class=\"range-slider " + cls + "-slider\"" +
    " min=\"" + min + "\" max=\"" + max + "\" step=\"" + step + "\" value=\"" + value + "\">" +
    "<input type=\"number\" class=\"slider-number " + cls + "-number\"" +
    " min=\"" + min + "\" max=\"" + max + "\" step=\"any\" value=\"" + value + "\">" +
    "<span class=\"slider-unit\">" + unit + "</span>" +
    "</div></div>";
}

/**
 * 슬라이더와 숫자 입력을 한 값으로 묶는다.
 * 어느 쪽을 건드려도 나머지 하나가 따라오고 apply가 불린다.
 *
 * 숫자 입력은 타이핑 도중에도 input이 온다. 지우는 중('')이나 '-'만 친 상태에서
 * 값을 강제로 되돌리면 글자를 못 지운다. 그래서 그때는 넘기고,
 * 포커스를 뗄 때(change) 범위 안으로 정리한다.
 *
 * @param {HTMLElement} picker - 스타일 팝업
 * @param {string} cls - sliderRow에 넘긴 식별 클래스
 * @param {function(number)} apply - 확정된 값으로 실제 스타일을 바꾸는 함수
 */
function bindSliderRow(picker, cls, apply) {
  var slider = picker.querySelector("." + cls + "-slider");
  var number = picker.querySelector("." + cls + "-number");
  if (!slider || !number) return;

  var min = parseFloat(slider.min);
  var max = parseFloat(slider.max);
  var clamp = function(v) { return Math.min(max, Math.max(min, v)); };

  slider.addEventListener("input", function() {
    var v = parseFloat(slider.value);
    number.value = v;
    apply(v);
  });

  number.addEventListener("input", function() {
    if (number.value.trim() === "") return;
    var v = parseFloat(number.value);
    if (isNaN(v)) return;
    v = clamp(v);
    slider.value = v;
    apply(v);
  });

  // 범위를 벗어났거나 비어 있는 채로 떠나면 마지막 유효값으로 되돌린다
  number.addEventListener("change", function() {
    var v = parseFloat(number.value);
    v = isNaN(v) ? parseFloat(slider.value) : clamp(v);
    number.value = v;
    slider.value = v;
    apply(v);
  });
}

/** 선 스타일(실선, 파선, 점선, 일점쇄선) 버튼 줄 */
function strokeDashHTML(current) {
  const opts = [['solid', '실선', '━━━'], ['dashed', '파선', '┅┅┅'], ['dotted', '점선', '┈┈┈'], ['dash-dot', '일점쇄선', '━┅━']];
  return "<div class=\"style-section\"><label>선 스타일:</label><div class=\"stroke-style-options\">" +
    opts.map(function(o) {
      return "<button class=\"stroke-btn" + (current === o[0] ? " active" : "") + "\" data-stroke=\"" + o[0] + "\" title=\"" + o[1] + "\">" + o[2] + "</button>";
    }).join("") +
    "</div></div>";
}

/**
 * 팝업 밖을 누르면 닫는다. 연 직후의 클릭(여는 버튼 자체)은 무시한다.
 * @param {HTMLElement} picker
 */
function closeOnOutsideClick(picker) {
  // 피커 생성 시간 기록
  var pickerCreatedAt = Date.now();

  setTimeout(function() {
    var closePicker = function(ev) {
      // 피커가 DOM에서 제거되었으면 리스너도 제거
      if (!document.body.contains(picker)) {
        document.removeEventListener("click", closePicker);
        return;
      }

      // 생성 후 300ms 이내 클릭은 무시
      if (Date.now() - pickerCreatedAt < 300) {
        return;
      }

      if (!picker.contains(ev.target)) {
        picker.remove();
        document.removeEventListener("click", closePicker);
      }
    };
    document.addEventListener("click", closePicker);
  }, 50);
}

export class LayerPanel {
  constructor(containerId = 'layer-list') {
    this.container = document.getElementById(containerId);
    this.scrollEl = this.container ? this.container.parentElement : null; // .panel-content
    this.draggedItem = null;
    this.marquee = null; // 드래그 선택 상태
    this.selectMode = false; // 「여러 개 선택」 모드: 줄을 누르면 선택에 더하거나 뺀다 (태블릿용)
    this.init();
  }

  init() {
    this.bindEvents();
    this.render();
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 레이어 추가 이벤트
    eventBus.on(Events.LAYER_ADDED, () => this.render());
    eventBus.on(Events.LAYER_REMOVED, () => this.render());
    eventBus.on(Events.LAYER_VISIBILITY_CHANGED, ({ layerId, visible }) => {
      this.toggleLayerLegend(layerId, visible);
      this.render();
    });
    eventBus.on(Events.LAYER_SELECTED, () => this.render());
    eventBus.on(Events.LAYER_ORDER_CHANGED, () => this.render());
    eventBus.on(Events.LAYER_STYLE_CHANGED, () => this.render());

    // 합치기는 레이어 목록을 건드리지 않지만 피처 개수 배지가 달라진다
    eventBus.on(Events.FEATURES_MERGED, () => this.render());

    // 컨테이너 클릭 이벤트 위임
    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // 드래그 앤 드롭 (레이어 순서 변경)
    this.container.addEventListener('dragstart', (e) => this.handleDragStart(e));
    this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.container.addEventListener('drop', (e) => this.handleDrop(e));
    this.container.addEventListener('dragend', (e) => this.handleDragEnd(e));

    // 드래그 박스(마퀴) 선택: 빈 공간에서 드래그 시작
    if (this.scrollEl) {
      this.scrollEl.addEventListener('mousedown', (e) => this.handleMarqueeStart(e));
    }

    // 전체 표시/숨김 마스터 체크박스
    this.selectAllCheckbox = document.getElementById('layer-select-all');
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
    }

    // 「여러 개 선택」 토글 버튼. 머리줄 마크업(AppLayout)은 그대로 두고 여기서 끼워 넣는다
    this.mountSelectModeButton();

    // Esc 로 선택 모드 끄기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selectMode) this.setSelectMode(false);
    });
  }

  /** 레이어 패널 머리줄 오른쪽 버튼 묶음에 선택 모드 버튼을 넣는다 */
  mountSelectModeButton() {
    const tab = this.container && this.container.parentElement && this.container.parentElement.parentElement;
    const actions = tab && tab.querySelector('.panel-header-actions');
    if (!actions || actions.querySelector('.layer-select-mode-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layer-select-mode-btn';
    btn.title = '레이어 여러 개를 눌러서 고르기 (Esc 로 끄기)';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `${icon('selectMode')}<span>여러 개 선택</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setSelectMode(!this.selectMode);
    });
    actions.insertBefore(btn, actions.firstChild);
    this.selectModeBtn = btn;
  }

  /**
   * 선택 모드 켜고 끄기. 끄면 선택이 하나(마지막으로 고른 것) 또는 없음으로 줄어든다.
   */
  setSelectMode(on) {
    const next = !!on;
    if (next === this.selectMode) return;
    this.selectMode = next;
    if (!next) {
      const keep = layerManager.getSelectedLayerId();
      if (keep && layerManager.getLayer(keep)) layerManager.selectLayer(keep); // render 를 부른다
      else layerManager.clearSelection();
    }
    this.render();
  }

  /**
   * 전체 레이어 표시/숨김 토글
   */
  handleSelectAll(visible) {
    layerManager.getAllLayers().forEach(layer => {
      if (layer.visible !== visible) {
        layerManager.toggleVisibility(layer.id);
      }
    });
  }

  /**
   * 마스터 체크박스 상태 갱신 (전체/일부/없음)
   */
  updateSelectAllState() {
    const cb = this.selectAllCheckbox || document.getElementById('layer-select-all');
    if (!cb) return;

    const layers = layerManager.getAllLayers();
    if (layers.length === 0) {
      cb.checked = false;
      cb.indeterminate = false;
      cb.disabled = true;
      return;
    }

    cb.disabled = false;
    const visibleCount = layers.filter(l => l.visible).length;
    cb.checked = visibleCount === layers.length;
    cb.indeterminate = visibleCount > 0 && visibleCount < layers.length;
  }

  /**
   * 드래그 박스(마퀴) 선택 시작
   * 레이어 항목이 아닌 빈 공간에서 마우스를 누르고 끌면 박스로 다중 선택.
   * (레이어 항목 위에서 끄는 것은 기존 순서 변경 드래그로 동작)
   */
  handleMarqueeStart(e) {
    if (e.button !== 0) return; // 좌클릭만
    // 레이어 항목이나 인터랙티브 요소 위에서 시작하면 마퀴 아님
    if (e.target.closest('.layer-item')) return;

    const additive = e.ctrlKey || e.metaKey;
    const baseIds = additive ? layerManager.getSelectedLayerIds() : [];

    const box = document.createElement('div');
    box.className = 'layer-marquee-box';
    this.scrollEl.appendChild(box);

    this.marquee = {
      startX: e.clientX,
      startY: e.clientY,
      box,
      baseIds,
      moved: false
    };

    this._onMarqueeMove = (ev) => this.handleMarqueeMove(ev);
    this._onMarqueeUp = (ev) => this.handleMarqueeEnd(ev);
    document.addEventListener('mousemove', this._onMarqueeMove);
    document.addEventListener('mouseup', this._onMarqueeUp);
    e.preventDefault();
  }

  handleMarqueeMove(e) {
    if (!this.marquee) return;
    const m = this.marquee;
    const dx = e.clientX - m.startX;
    const dy = e.clientY - m.startY;
    if (!m.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // 임계값
    m.moved = true;

    // 뷰포트 좌표 기준 선택 사각형
    const vLeft = Math.min(m.startX, e.clientX);
    const vTop = Math.min(m.startY, e.clientY);
    const vRight = Math.max(m.startX, e.clientX);
    const vBottom = Math.max(m.startY, e.clientY);

    // 마퀴 박스를 스크롤 컨테이너 내부 좌표로 변환하여 그리기
    const pr = this.scrollEl.getBoundingClientRect();
    m.box.style.left = (vLeft - pr.left + this.scrollEl.scrollLeft) + 'px';
    m.box.style.top = (vTop - pr.top + this.scrollEl.scrollTop) + 'px';
    m.box.style.width = (vRight - vLeft) + 'px';
    m.box.style.height = (vBottom - vTop) + 'px';

    // 교차하는 항목 강조 (확정은 mouseup에서)
    this.container.querySelectorAll('.layer-item').forEach(li => {
      const r = li.getBoundingClientRect();
      const hit = !(r.right < vLeft || r.left > vRight || r.bottom < vTop || r.top > vBottom);
      li.classList.toggle('marquee-hit', hit);
    });
  }

  handleMarqueeEnd() {
    if (!this.marquee) return;
    const m = this.marquee;
    document.removeEventListener('mousemove', this._onMarqueeMove);
    document.removeEventListener('mouseup', this._onMarqueeUp);

    if (m.moved) {
      const hitIds = Array.from(this.container.querySelectorAll('.layer-item.marquee-hit'))
        .map(li => li.dataset.layerId);
      const finalIds = Array.from(new Set([...m.baseIds, ...hitIds]));
      layerManager.setSelection(finalIds);
    }

    m.box.remove();
    this.container.querySelectorAll('.marquee-hit').forEach(li => li.classList.remove('marquee-hit'));
    this.marquee = null;
  }

  /**
   * 목록에 괄호로 붙는 개수. 흐름 레이어는 피처가 없어 featureCount 가 0 이라
   * 렌더러가 실제로 그리는 흐름 수(FlowRenderer.getFlowCount)를 쓴다.
   */
  layerCount(layer) {
    if (layer.type !== 'flow') return layer.featureCount;
    return typeof layer.olLayer?.getFlowCount === 'function' ? layer.olLayer.getFlowCount() : 0;
  }

  /**
   * 레이어 목록 렌더링
   */
  render() {
    const layers = layerManager.getAllLayers();
    const selectedIds = layerManager.getSelectedLayerIds();
    const primarySelectedId = layerManager.getSelectedLayerId();

    // 전체 표시/숨김 체크박스 상태 동기화
    this.updateSelectAllState();

    // 선택 모드 표시 (버튼 눌림 상태, 목록 클래스)
    this.container.classList.toggle('select-mode', this.selectMode);
    if (this.selectModeBtn) {
      this.selectModeBtn.classList.toggle('active', this.selectMode);
      this.selectModeBtn.setAttribute('aria-pressed', String(this.selectMode));
    }

    if (layers.length === 0) {
      this.container.innerHTML = `
        <li class="layer-empty">
          레이어가 없습니다.<br>
          파일을 드래그하여 추가하세요.
        </li>
      `;
      return;
    }

    // 위에서 아래 순서로 표시 (zIndex 높은 것이 위)
    const reversedLayers = [...layers].reverse();

    this.container.innerHTML = reversedLayers.map(layer => {
      const isSelected = selectedIds.includes(layer.id);
      const isPrimary = primarySelectedId === layer.id;
      let className = 'layer-item';
      if (isSelected) className += ' selected';
      if (isPrimary) className += ' primary-selected';
      // 선택 모드에서만 보이는 둥근 선택 칸 (네모난 표시 체크박스와 모양을 다르게)
      const selectCheck = this.selectMode
        ? `<span class="layer-select-check" role="checkbox" aria-checked="${isSelected}" title="고르기">${icon('check', 12)}</span>`
        : '';

      return `
        <li class="${className}"
            data-layer-id="${layer.id}"
            draggable="true">
          ${selectCheck}
          <input type="checkbox"
                 class="layer-visibility"
                 ${layer.visible ? 'checked' : ''}
                 title="표시/숨김">
          <span class="layer-color" title="색·테두리 바꾸기">${this.swatchMarkup(layer)}</span>
          <span class="layer-name" title="${layer.name}">${layer.name}</span>
          <span class="layer-count">(${this.layerCount(layer)})</span>
          <button class="layer-menu-btn" title="메뉴">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </li>
      `;
    }).join('');

    // 다중 선택 정보 표시
    if (selectedIds.length > 1) {
      this.showMultiSelectInfo(selectedIds.length);
    } else {
      this.hideMultiSelectInfo();
    }
  }

  /**
   * 레이어 가시성에 맞춰 해당 레이어의 범례(legend) 표시/숨김
   * (id 규약과 접두사 목록은 tools/legendVisibility.js 한 곳에 둔다)
   */
  toggleLayerLegend(layerId, visible) {
    applyLegendVisibility(layerId, visible);
  }

  /**
   * 다중 선택 정보 표시
   */
  showMultiSelectInfo(count) {
    let infoEl = document.querySelector('.layer-multi-select-info');
    if (!infoEl) {
      infoEl = document.createElement('div');
      infoEl.className = 'layer-multi-select-info';
      // 레이어 목록 박스(.panel-content) 바로 위(헤더와 목록 사이)에 간격 없이 붙임
      const panelContent = this.container.parentElement;
      const tab = panelContent.parentElement;
      tab.insertBefore(infoEl, panelContent);
    }
    const ids = layerManager.getSelectedLayerIds();
    const anyVisible = ids.some(id => (layerManager.getLayer(id) || {}).visible);
    const btn = (action, iconName, label, title, extra = '') =>
      `<button type="button" class="multi-select-btn${extra}" data-batch="${action}" title="${title}">${icon(iconName)}<span>${label}</span></button>`;
    infoEl.innerHTML = `
      <span class="multi-select-count">${count}개 레이어 선택됨</span>
      <div class="multi-select-actions">
        ${btn('style', 'style', '스타일', '고른 레이어의 색과 선을 한꺼번에 바꾸기')}
        ${btn('duplicate', 'duplicate', '복사', '고른 레이어를 하나씩 복사하기')}
        ${btn('export', 'export', '내보내기', '고른 레이어를 zip 파일 하나로 내보내기')}
        ${btn('field-calc', 'fieldCalc', '속성 계산', '고른 레이어 모두에 필드 계산하기')}
        ${btn('zoom', 'zoom', '이동', '고른 레이어가 모두 보이게 지도 옮기기')}
        ${btn('visibility', anyVisible ? 'eyeOff' : 'eye', anyVisible ? '숨기기' : '보이기', anyVisible ? '고른 레이어 모두 숨기기' : '고른 레이어 모두 보이기')}
        ${btn('remove', 'trash', '삭제', '고른 레이어 삭제', ' danger')}
        ${btn('clear', 'close', '선택 해제', '선택을 풀고 돌아가기')}
      </div>
    `;

    infoEl.onclick = (e) => {
      const b = e.target.closest('[data-batch]');
      if (!b) return;
      e.stopPropagation();
      // 스타일 팝업은 작업 줄 오른쪽(패널 바깥)에 붙인다. 버튼에 붙이면 패널을 가린다
      this.runBatchAction(b.dataset.batch, layerManager.getSelectedLayerIds(), infoEl);
    };
  }

  /**
   * 고른 레이어 여러 개에 한꺼번에 하는 일. 작업 줄과 다중 우클릭 메뉴가 같이 쓴다.
   * @param {string} action
   * @param {string[]} ids - 고른 순서대로
   */
  async runBatchAction(action, ids, anchorEl = null) {
    if (!ids || ids.length === 0) return;
    switch (action) {
      case 'style':
        this.showColorPicker(ids, anchorEl);
        break;
      case 'duplicate':
        this.duplicateLayers(ids);
        break;
      case 'export':
        try {
          // jszip 을 쓰는 무거운 모듈이라 누를 때 불러온다
          const { exportLayersZip } = await import('../../utils/exportLayersZip.js');
          await exportLayersZip(ids);
        } catch (err) {
          console.error('[LayerPanel] 내보내기 실패', err);
          showAlert('내보내기에 실패했습니다.\n' + (err && err.message ? err.message : ''));
        }
        break;
      case 'field-calc':
        // 선택은 그대로 둔다. 2개 이상이면 패널이 「선택한 레이어 N개 모두」를 미리 고른다
        fieldCalculatorPanel.show();
        break;
      case 'zoom':
        this.zoomToSelectedLayers(ids);
        break;
      case 'visibility': {
        const anyVisible = ids.some(id => (layerManager.getLayer(id) || {}).visible);
        this.setLayersVisible(ids, !anyVisible);
        break;
      }
      case 'show':
        this.setLayersVisible(ids, true);
        break;
      case 'hide':
        this.setLayersVisible(ids, false);
        break;
      case 'remove':
        if (await showConfirm(`${ids.length}개의 레이어를 삭제하시겠습니까?`, { danger: true, okText: '삭제' })) {
          ids.forEach(id => layerManager.removeLayer(id));
          layerManager.clearSelection();
        }
        break;
      case 'clear':
        layerManager.clearSelection();
        this.setSelectMode(false);
        break;
    }
  }

  /** 여러 레이어를 모두 보이거나 모두 숨긴다 */
  setLayersVisible(ids, visible) {
    ids.forEach(id => {
      const layer = layerManager.getLayer(id);
      if (layer && layer.visible !== visible) layerManager.toggleVisibility(id);
    });
  }

  /** 레이어 하나 복사. 복사본 id, 복사할 수 없으면 null */
  duplicateOne(layerId) {
    const newId = layerManager.duplicateLayer(layerId);
    if (newId) {
      const copy = layerManager.getLayer(newId);
      // 복제본에 도구 참조(_cartogramConfig.tool)를 다시 심고 분류색 스타일을 건다.
      // applyCartogramStyle은 updateLayerStyle에 위임한다 — 지우지 말 것.
      if (copy && copy._cartogramConfig) cartogramTool.applyCartogramStyle(newId);
    }
    return newId;
  }

  /** 고른 순서대로 하나씩 복사. 복사할 수 없는 레이어(래스터, 도형표현도 등)는 건너뛰고 한 번만 알린다 */
  duplicateLayers(ids) {
    const skipped = [];
    ids.forEach(id => {
      if (!this.duplicateOne(id)) {
        const l = layerManager.getLayer(id);
        if (l) skipped.push(l.name);
      }
    });
    if (skipped.length > 0) {
      showAlert(`${skipped.length}개 레이어는 복사할 수 없어 건너뛰었습니다.\n${skipped.join(', ')}`);
    }
  }

  /**
   * 다중 선택 정보 숨기기
   */
  hideMultiSelectInfo() {
    const infoEl = document.querySelector('.layer-multi-select-info');
    if (infoEl) infoEl.remove();
  }

  /**
   * 클릭 이벤트 처리
   */
  handleClick(e) {
    const item = e.target.closest('.layer-item');
    if (!item) return;

    const layerId = item.dataset.layerId;

    // 체크박스 클릭 (가시성 토글)
    if (e.target.classList.contains('layer-visibility')) {
      e.stopPropagation();
      // 다중 선택된 레이어들 모두 토글
      const selectedIds = layerManager.getSelectedLayerIds();
      if (selectedIds.length > 1 && selectedIds.includes(layerId)) {
        selectedIds.forEach(id => layerManager.toggleVisibility(id));
      } else {
        layerManager.toggleVisibility(layerId);
      }
      return;
    }

    // 색상 클릭 (색상 변경)
    // 스와치 안에 SVG가 들어 있어 e.target이 <circle>·<rect>가 될 수 있다
    if (e.target.closest('.layer-color')) {
      e.stopPropagation();
      this.showColorPicker(layerId);
      return;
    }

    // 메뉴 버튼 클릭
    if (e.target.closest('.layer-menu-btn')) {
      e.stopPropagation();
      this.showContextMenu(e, layerId);
      return;
    }

    // 선택 모드: 줄을 누르면 선택에 더하거나 뺀다 (Ctrl 클릭과 같음). Shift 는 범위 그대로
    if (this.selectMode && !e.shiftKey) {
      layerManager.toggleLayerSelection(layerId);
      return;
    }

    // 레이어 선택 (Ctrl/Shift 키 지원)
    layerManager.selectLayerWithModifier(layerId, e.ctrlKey || e.metaKey, e.shiftKey);
  }

  /**
   * 더블클릭 이벤트 (레이어로 줌)
   */
  handleDoubleClick(e) {
    const item = e.target.closest('.layer-item');
    if (!item) return;

    // 선택 모드에서는 빠르게 두 번 눌러 고르고 빼는 일이 잦다. 지도가 움직이지 않게 한다
    if (this.selectMode) return;

    const layerId = item.dataset.layerId;
    layerManager.zoomToLayer(layerId);
  }

  /**
   * 컨텍스트 메뉴 표시
   */
  showContextMenu(e, layerId) {
    // 기존 메뉴 제거
    const existingMenu = document.querySelector('.layer-context-menu');
    if (existingMenu) existingMenu.remove();

    const selectedIds = layerManager.getSelectedLayerIds();
    const isMultiSelect = selectedIds.length > 1 && selectedIds.includes(layerId);

    const menu = document.createElement('div');
    menu.className = 'layer-context-menu';

    if (isMultiSelect) {
      // 다중 선택 메뉴
      menu.innerHTML = `
        <div class="context-menu-header">${selectedIds.length}개 레이어 선택됨</div>
        <div class="context-menu-item" data-action="style-all">스타일 한꺼번에 바꾸기</div>
        <div class="context-menu-item" data-action="duplicate-all">선택 레이어 복사</div>
        <div class="context-menu-item" data-action="export-all">내보내기 (zip)</div>
        <div class="context-menu-item" data-action="field-calc-all">속성 계산</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" data-action="zoom-all">선택 레이어로 이동</div>
        <div class="context-menu-item" data-action="show-all">모두 표시</div>
        <div class="context-menu-item" data-action="hide-all">모두 숨기기</div>
        <div class="context-menu-item" data-action="clear-all">선택 해제</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="remove-all">선택 레이어 삭제</div>
      `;
    } else {
      // 단일 선택 메뉴 — 복사/내보내기는 벡터 기반만(래스터·도형표현도는 피처가 없어 불가)
      const info = layerManager.getLayer(layerId);
      const isVector = !!(info && info.type !== 'raster' && info.type !== 'chartmap' && info.source);
      // 래스터는 스타일 팝업에 색상이 없고 불투명도만 있다(단색 필터 결과만 색 변경 가능).
      // '색상 변경'이라고만 적어두면 투명도 조절을 찾지 못한다.
      const isRaster = !!(info && info.type === 'raster');
      const isFilterRaster = isRaster && !!(info.analysisData && info.analysisData.colorScheme === 'filter');
      // 흐름 레이어는 색상 팝업 대신 흐름도 패널이 열린다(showColorPicker 분기)
      const isFlow = !!(info && info.type === 'flow');
      const styleLabel = isFlow ? '흐름도 스타일'
        : isRaster ? (isFilterRaster ? '색상·투명도' : '투명도 조절') : '색상 변경';
      menu.innerHTML = `
        <div class="context-menu-item" data-action="zoom">레이어로 이동</div>
        <div class="context-menu-item" data-action="rename">이름 변경</div>
        ${isVector ? '<div class="context-menu-item" data-action="duplicate">레이어 복사</div>' : ''}
        ${isVector ? '<div class="context-menu-item" data-action="export">내보내기 (GeoJSON)</div>' : ''}
        ${info && info.source ? '<div class="context-menu-item" data-action="table">속성 테이블</div>' : ''}
        <div class="context-menu-item" data-action="color">${styleLabel}</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="remove">삭제</div>
      `;
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (!isMobile) {
      // 데스크톱: 기존과 동일하게 버튼 오른쪽에 표시
      const rect = e.target.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.left = rect.right + 'px';
      menu.style.top = rect.top + 'px';
      document.body.appendChild(menu);
    } else {
      // 모바일: 화면 밖으로 나가지 않도록 위치 보정 (하단 시트 대응)
      const anchor = e.target.closest('.layer-menu-btn') || e.target;
      const rect = anchor.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.visibility = 'hidden';
      document.body.appendChild(menu);

      const menuW = menu.offsetWidth;
      const menuH = menu.offsetHeight;
      const margin = 8;

      // 오른쪽 공간이 부족하면 버튼 왼쪽에 표시
      let left = rect.right;
      if (left + menuW > window.innerWidth - margin) {
        left = rect.left - menuW;
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));

      // 아래 공간이 부족하면 위로 펼침
      let top = rect.top;
      if (top + menuH > window.innerHeight - margin) {
        top = rect.bottom - menuH;
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin));

      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.visibility = '';
    }

    // 메뉴 클릭 이벤트
    menu.addEventListener('click', (ev) => {
      const action = ev.target.dataset.action;
      if (action) {
        this.handleMenuAction(action, layerId, isMultiSelect ? selectedIds : null);
        menu.remove();
      }
    });

    // 외부 클릭 시 메뉴 닫기
    setTimeout(() => {
      const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  /**
   * 메뉴 액션 처리
   */
  async handleMenuAction(action, layerId, selectedIds = null) {
    switch (action) {
      case 'zoom':
        layerManager.zoomToLayer(layerId);
        break;
      case 'rename':
        this.promptRename(layerId);
        break;
      case 'duplicate':
        this.duplicateOne(layerId);
        break;
      case 'export': {
        const info = layerManager.getLayer(layerId);
        if (!info || !info.source) break;
        // GeoJSON 표준 좌표계(EPSG:4326)로 내보내기 — QGIS 등 외부 도구와 호환
        const geojson = new GeoJSON().writeFeaturesObject(info.source.getFeatures(), {
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        });
        const safe = String(info.name || '레이어').replace(/[\\/:*?"<>|]/g, '_');
        saveTextAs(`${safe}.geojson`, JSON.stringify(geojson, null, 2), 'application/geo+json');
        break;
      }
      case 'table':
        eventBus.emit('layer:openTable', { layerId });
        break;
      case 'color':
        this.showColorPicker(layerId);
        break;
      case 'remove':
        if (await showConfirm('이 레이어를 삭제하시겠습니까?', { danger: true, okText: '삭제' })) {
          layerManager.removeLayer(layerId);
        }
        break;
      // 다중 선택 액션 (작업 줄과 같은 곳으로 보낸다)
      case 'style-all':
      case 'duplicate-all':
      case 'export-all':
      case 'field-calc-all':
      case 'zoom-all':
      case 'show-all':
      case 'hide-all':
      case 'clear-all':
      case 'remove-all': {
        const batch = { 'style-all': 'style', 'duplicate-all': 'duplicate', 'export-all': 'export',
          'field-calc-all': 'field-calc', 'zoom-all': 'zoom', 'show-all': 'show', 'hide-all': 'hide',
          'clear-all': 'clear', 'remove-all': 'remove' }[action];
        if (selectedIds) await this.runBatchAction(batch, selectedIds);
        break;
      }
    }
  }

  /**
   * 선택된 레이어들의 범위로 줌
   */
  zoomToSelectedLayers(selectedIds) {
    let combinedExtent = null;

    selectedIds.forEach(id => {
      const layer = layerManager.getLayer(id);
      if (layer && layer.source) {
        const extent = layer.source.getExtent();
        if (extent && extent[0] !== Infinity) {
          if (!combinedExtent) {
            combinedExtent = [...extent];
          } else {
            // 범위 확장
            combinedExtent[0] = Math.min(combinedExtent[0], extent[0]);
            combinedExtent[1] = Math.min(combinedExtent[1], extent[1]);
            combinedExtent[2] = Math.max(combinedExtent[2], extent[2]);
            combinedExtent[3] = Math.max(combinedExtent[3], extent[3]);
          }
        }
      }
    });

    if (combinedExtent) {
      mapManager.fitExtent(combinedExtent, { padding: [50, 50, 50, 50] });
    }
  }

  /**
   * 이름 변경 프롬프트
   */
  promptRename(layerId) {
    const layer = layerManager.getLayer(layerId);
    if (!layer) return;

    // 기본 대화상자 대신 askText(e-GIS 안의 입력 창)
    askText('새 레이어 이름:', layer.name).then((newName) => {
      if (newName && newName.trim()) {
        layerManager.renameLayer(layerId, newName.trim());
      }
    });
  }


  /**
   * 스타일 편집 팝업 표시
   */
  /**
   * 레이어 하나의 스와치 SVG.
   * 점선표는 LayerManager가 갖고 있으므로 여기서 풀어 넘긴다.
   */
  swatchMarkup(layerInfo) {
    const lineDash = layerManager.getLineDash(layerInfo.strokeDash || 'solid');
    return swatchHTML(swatchSpec(layerInfo, lineDash));
  }

  /**
   * 색을 바꾼 뒤 목록의 스와치만 다시 그린다.
   *
   * 예전에는 이 자리마다 .layer-color의 backgroundColor나 borderColor를 직접 찔렀다.
   * 어느 속성을 건드려야 하는지가 일곱 군데에 흩어져 있었고, 그래서 모양이 바뀌면
   * 전부 어긋났다. 스와치를 만드는 곳은 한 군데여야 한다.
   */
  refreshSwatch(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    const el = document.querySelector('[data-layer-id="' + layerId + '"] .layer-color');
    if (el) el.innerHTML = this.swatchMarkup(layerInfo);
  }

  /**
   * 스타일 편집 팝업.
   * @param {string|string[]} layerIdOrIds - 레이어 id 하나, 또는 여러 개(한꺼번에 바꾸기)
   * @param {HTMLElement} [anchorEl] - 여러 개일 때 팝업을 붙일 자리(작업 줄 버튼 등)
   */
  showColorPicker(layerIdOrIds, anchorEl = null) {
    if (Array.isArray(layerIdOrIds)) {
      const ids = layerIdOrIds.filter(Boolean);
      if (ids.length === 0) return;
      if (ids.length === 1) return this.showSingleColorPicker(ids[0]);
      return this.showMultiColorPicker(ids, anchorEl);
    }
    return this.showSingleColorPicker(layerIdOrIds);
  }

  /** 색 견본 한 줄. data 속성 이름만 바꿔 가며 재사용한다 */
  swatchItems(dataAttr, current) {
    return layerManager.getColorSwatches().map(function(s) {
      return "<div class=\"color-item" + (s.color === current ? " active" : "") + "\"" +
        " " + dataAttr + "=\"" + s.color + "\" title=\"" + s.name + "\"" +
        " style=\"background-color: " + s.color + "\"></div>";
    }).join("");
  }

  /** 빈 스타일 팝업 상자 (기존 것은 닫는다) */
  createPickerShell() {
    const existingPicker = document.querySelector(".color-picker-popup");
    if (existingPicker) existingPicker.remove();
    const picker = document.createElement("div");
    picker.className = "color-picker-popup";
    // 강제 인라인 스타일 적용 (기본 위치 포함)
    picker.style.cssText = "position: fixed; left: 300px; top: 100px; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; min-width: 200px; z-index: 99999; box-shadow: 0 4px 20px rgba(0,0,0,0.3);";
    return picker;
  }

  /**
   * 팝업 위치 조정 (화면 밖으로 나가지 않도록).
   * 데스크톱은 기준 요소 오른쪽, 휴대폰은 화면 가운데.
   */
  placePicker(picker, anchorEl) {
    if (window.matchMedia("(max-width: 768px)").matches) {
      // 모바일: 화면 중앙 팝업 (하단 시트에서 좌우 어느 쪽도 공간이 없음)
      picker.style.left = "50%";
      picker.style.top = "50%";
      picker.style.transform = "translate(-50%, -50%)";
      picker.style.maxWidth = "calc(100vw - 24px)";
      picker.style.maxHeight = "80vh";
      picker.style.overflowY = "auto";
    } else if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      picker.style.position = "fixed";
      picker.style.left = (rect.right + 10) + "px";
      picker.style.top = rect.top + "px";

      // 아래로 잘리면 위로 조정
      if (rect.top + pickerRect.height > viewportHeight - 10) {
        picker.style.top = Math.max(10, viewportHeight - pickerRect.height - 10) + "px";
      }

      // 오른쪽으로 잘리면 왼쪽에 표시
      if (rect.right + 10 + pickerRect.width > viewportWidth) {
        picker.style.left = (rect.left - pickerRect.width - 10) + "px";
      }
    }
  }

  /**
   * 여러 레이어 스타일을 한꺼번에 바꾸는 팝업.
   * 창은 첫 레이어 값을 보여 주고, 바꾸는 값은 고른 레이어 모두에 setLayer* 로 건다.
   * 지오메트리가 섞이면 모든 종류에 의미 있는 항목만 보인다(batchStyle.js).
   * 흐름, 도형표현도, 래스터, 히트맵은 건너뛰고 몇 개를 뺐는지 한 줄로 알린다.
   */
  showMultiColorPicker(ids, anchorEl = null) {
    const self = this;
    const { eligible, excluded } = partitionStyleTargets(ids.map(id => layerManager.getLayer(id)));
    const targetIds = eligible.map(l => l.id);
    const controls = commonStyleControls(eligible);
    const has = (c) => controls.includes(c);
    const first = eligible[0] || {};
    const allPoints = eligible.length > 0 && eligible.every(l => geometryKind(l) === 'point');

    const picker = this.createPickerShell();
    picker.classList.add("multi");

    let html = "<div class=\"color-picker-header\">스타일 편집 (레이어 " + eligible.length + "개)</div>";
    if (excluded.length > 0) {
      html += "<div class=\"style-excluded-note\">" + excluded.length + "개 레이어는 스타일을 바꿀 수 없어 뺐습니다.</div>";
    }
    if (eligible.length === 0) {
      html += "<div class=\"style-section\" style=\"font-size:12px;color:var(--text-secondary,#888)\">고른 레이어 중에 스타일을 바꿀 수 있는 레이어가 없습니다.</div>";
    }

    const currentFillColor = first.fillColor || first.color;
    const currentStrokeColor = geometryKind(first) === 'line' ? first.color : (first.strokeColor || first.color);

    if (has('fillColor')) {
      const classified = eligible.filter(l => layerManager.isClassified(l));
      if (classified.length === eligible.length) {
        html += "<div class=\"style-section\" style=\"font-size:12px;color:var(--text-secondary,#888)\">면 색상은 분류 설정이 결정합니다.</div>";
      } else {
        html += "<div class=\"style-section\"><label>면 색상:</label><div class=\"color-picker-grid\">" + this.swatchItems("data-fill-color", currentFillColor) + "</div>";
        html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentFillColor + "\" class=\"fill-color-input\"></div>";
        if (classified.length > 0) {
          html += "<div style=\"font-size:12px;color:var(--text-secondary,#888);margin-top:4px\">분류 레이어 " + classified.length + "개는 면 색상이 그대로입니다.</div>";
        }
        html += "</div>";
      }
    }
    if (has('fillOpacity')) {
      const v = first.fillOpacity !== undefined ? first.fillOpacity : 0.3;
      html += sliderRow("면 불투명도", "fill-opacity", Math.round(v * 100), "%", 0, 100, 1);
    }
    if (has('strokeColor')) {
      html += "<div class=\"style-section\"><label>" + (allPoints ? "테두리 색상" : "선 색상") + ":</label><div class=\"color-picker-grid\">" + this.swatchItems("data-stroke-color", currentStrokeColor) + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentStrokeColor + "\" class=\"stroke-color-input\"></div></div>";
    }
    if (has('strokeOpacity')) {
      const v = first.strokeOpacity !== undefined ? first.strokeOpacity : 1.0;
      html += sliderRow("선 투명도", "stroke-opacity", Math.round(v * 100), "%", 0, 100, 1);
    }
    if (has('strokeWidth')) {
      const v = first.strokeWidth !== undefined ? first.strokeWidth : 2;
      html += sliderRow(allPoints ? "테두리 두께" : "선 두께", "stroke-width", v, "px", 0, 10, 0.5);
    }
    if (has('strokeDash')) {
      html += strokeDashHTML(first.strokeDash || "solid");
    }

    picker.innerHTML = html;
    document.body.appendChild(picker);

    const anchor = anchorEl
      || document.querySelector('.layer-multi-select-info')
      || (targetIds[0] && this.container.querySelector("[data-layer-id=\"" + targetIds[0] + "\"]"));
    this.placePicker(picker, anchor);

    const applyAll = function(key, value) {
      applyStyleToAll(targetIds, key, value, layerManager);
      targetIds.forEach(function(id) { self.refreshSwatch(id); });
    };

    picker.addEventListener("click", function(e) {
      const fillItem = e.target.closest(".color-item[data-fill-color]");
      if (fillItem) {
        picker.querySelectorAll(".color-item[data-fill-color]").forEach(function(i) { i.classList.remove("active"); });
        fillItem.classList.add("active");
        const input = picker.querySelector(".fill-color-input");
        if (input) input.value = fillItem.dataset.fillColor;
        applyAll('fillColor', fillItem.dataset.fillColor);
      }
      const strokeItem = e.target.closest(".color-item[data-stroke-color]");
      if (strokeItem) {
        picker.querySelectorAll(".color-item[data-stroke-color]").forEach(function(i) { i.classList.remove("active"); });
        strokeItem.classList.add("active");
        const input = picker.querySelector(".stroke-color-input");
        if (input) input.value = strokeItem.dataset.strokeColor;
        applyAll('strokeColor', strokeItem.dataset.strokeColor);
      }
      const dashBtn = e.target.closest(".stroke-btn");
      if (dashBtn) {
        picker.querySelectorAll(".stroke-btn").forEach(function(b) { b.classList.remove("active"); });
        dashBtn.classList.add("active");
        applyAll('strokeDash', dashBtn.dataset.stroke);
      }
    });

    const fillInput = picker.querySelector(".fill-color-input");
    if (fillInput) {
      fillInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-fill-color]").forEach(function(i) { i.classList.remove("active"); });
        applyAll('fillColor', e.target.value);
      });
    }
    const strokeInput = picker.querySelector(".stroke-color-input");
    if (strokeInput) {
      strokeInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-stroke-color]").forEach(function(i) { i.classList.remove("active"); });
        applyAll('strokeColor', e.target.value);
      });
    }
    bindSliderRow(picker, "fill-opacity", function(pct) { applyAll('fillOpacity', pct / 100); });
    bindSliderRow(picker, "stroke-opacity", function(pct) { applyAll('strokeOpacity', pct / 100); });
    bindSliderRow(picker, "stroke-width", function(w) { applyAll('strokeWidth', w); });

    closeOnOutsideClick(picker);
  }

  showSingleColorPicker(layerId) {
    // 아래 팝업 핸들러들은 function(e) 형태라 this가 패널이 아니다
    const self = this;
    const layer = layerManager.getLayer(layerId);
    if (!layer) return;

    // 흐름 레이어는 색상 팝업이 아니라 흐름도 패널에서 스타일을 고친다
    if (layer.type === 'flow') {
      flowPanel.showForLayer(layerId);
      return;
    }

    const swatchItems = (dataAttr, current) => this.swatchItems(dataAttr, current);
    const picker = this.createPickerShell();

    const isRaster = layer.type === "raster";
    const isPoint = layer.geometryType === "Point" || layer.geometryType === "MultiPoint";
    const isLine = layer.geometryType === "LineString" || layer.geometryType === "MultiLineString";
    const isPolygon = layer.geometryType === "Polygon" || layer.geometryType === "MultiPolygon";

    const currentStrokeDash = layer.strokeDash || "solid";
    const currentFillOpacity = layer.fillOpacity !== undefined ? layer.fillOpacity : 0.3;
    const currentStrokeOpacity = layer.strokeOpacity !== undefined ? layer.strokeOpacity : 1.0;
    const currentStrokeColor = layer.strokeColor || layer.color;
    const currentFillColor = layer.fillColor || layer.color;
    const currentStrokeWidth = layer.strokeWidth !== undefined ? layer.strokeWidth : 2;

    let html = "<div class=\"color-picker-header\">스타일 편집</div>";

    if (isRaster) {
      // 래스터: 캔버스 렌더링이라 벡터 색상 스타일이 적용되지 않음.
      // 불투명도는 공통 제공, 단색(필터) 결과만 표시 색상 변경 허용.
      const olOpacity = (layer.olLayer && typeof layer.olLayer.getOpacity === "function")
        ? layer.olLayer.getOpacity()
        : (layer.opacity !== undefined ? layer.opacity : 1);
      const opacityPct = Math.round(olOpacity * 100);
      const isFilter = layer.analysisData && layer.analysisData.colorScheme === "filter";

      if (isFilter) {
        const fc = layer.analysisData.color || "#e3170a";
        html += "<div class=\"style-section\"><label>표시 색상:</label>";
        html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + fc + "\" class=\"raster-filter-color-input\"></div></div>";
      }

      html += sliderRow("불투명도", "raster-opacity", opacityPct, "%", 0, 100, 1);

      if (!isFilter) {
        html += "<div class=\"style-section\" style=\"font-size:12px;color:var(--text-secondary,#888)\">색상은 분석 종류(고도/경사/향)에 따라 자동 지정됩니다.</div>";
      }
    }
    else if (isPolygon) {
      // 면 색상 — 분류 레이어(단계구분도·카토그램)는 분류 설정이 색을 소유하므로 감춘다.
      // 단계구분도에서는 원래 눌러도 아무 일이 없었고, 카토그램에서는 분류를 파괴했다.
      const isClassified = layerManager.isClassified(layer);
      if (isClassified) {
        html += "<div class=\"style-section\" style=\"font-size:12px;color:var(--text-secondary,#888)\">면 색상은 분류 설정이 결정합니다.</div>";
      } else {
        const fillColorItems = swatchItems("data-fill-color", currentFillColor);

        html += "<div class=\"style-section\"><label>면 색상:</label><div class=\"color-picker-grid\">" + fillColorItems + "</div>";
        html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentFillColor + "\" class=\"fill-color-input\"></div></div>";
      }

      html += sliderRow("면 불투명도", "fill-opacity", Math.round(currentFillOpacity * 100), "%", 0, 100, 1);

      // 테두리 동기화 — 분류 레이어에만 의미가 있다
      const syncOn = layer.strokeSyncToFill !== false;
      if (isClassified) {
        html += "<div class=\"style-section\"><label class=\"stroke-sync-label\">";
        html += "<input type=\"checkbox\" class=\"stroke-sync-checkbox\"" + (syncOn ? " checked" : "") + "> 테두리를 분류색에 동기화";
        html += "</label></div>";
      }

      // 선 색상 — 분류 레이어에서 동기화가 켜져 있으면 분류색을 따르므로 비활성
      const strokeDisabled = isClassified && syncOn;
      const strokeColorItems = swatchItems("data-stroke-color", currentStrokeColor);

      html += "<div class=\"style-section stroke-color-section\"" + (strokeDisabled ? " style=\"opacity:0.4;pointer-events:none\"" : "") + ">";
      html += "<label>선 색상:</label><div class=\"color-picker-grid\">" + strokeColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentStrokeColor + "\" class=\"stroke-color-input\"></div></div>";

      html += sliderRow("선 두께", "stroke-width", currentStrokeWidth, "px", 0, 10, 0.5);

      // 선 스타일
      html += strokeDashHTML(currentStrokeDash);
    }
 else if (isLine) {
      const colorItems = swatchItems("data-color", layer.color);

      html += "<div class=\"style-section\"><label>선 색상:</label><div class=\"color-picker-grid\">" + colorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + layer.color + "\" class=\"color-input\"></div></div>";

      html += sliderRow("선 투명도", "stroke-opacity", Math.round(currentStrokeOpacity * 100), "%", 0, 100, 1);
      html += sliderRow("선 두께", "stroke-width", currentStrokeWidth, "px", 0, 10, 0.5);

      // 선 스타일
      html += strokeDashHTML(currentStrokeDash);
    } else {
      // 포인트: 면 색상 / 테두리 색상 따로 설정
      const fillColorItems = swatchItems("data-fill-color", currentFillColor);

      html += "<div class=\"style-section\"><label>면 색상:</label><div class=\"color-picker-grid\">" + fillColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentFillColor + "\" class=\"fill-color-input\"></div></div>";

      html += sliderRow("면 불투명도", "fill-opacity", Math.round(currentFillOpacity * 100), "%", 0, 100, 1);

      // 테두리 색상
      const strokeColorItems = swatchItems("data-stroke-color", currentStrokeColor);

      html += "<div class=\"style-section\"><label>테두리 색상:</label><div class=\"color-picker-grid\">" + strokeColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentStrokeColor + "\" class=\"stroke-color-input\"></div></div>";

      html += sliderRow("테두리 두께", "stroke-width", currentStrokeWidth, "px", 0, 10, 0.5);
    }


    picker.innerHTML = html;

    document.body.appendChild(picker);

    // 팝업 위치 조정 (화면 밖으로 나가지 않도록)
    this.placePicker(picker, this.container.querySelector("[data-layer-id=\"" + layerId + "\"]"));

    // 이벤트 핸들러
    picker.addEventListener("click", function(e) {
      var colorItem = e.target.closest(".color-item[data-color]");
      if (colorItem) {
        picker.querySelectorAll(".color-item[data-color]").forEach(function(i) { i.classList.remove("active"); });
        colorItem.classList.add("active");
        layerManager.setLayerColor(layerId, colorItem.dataset.color);
        var colorInput = picker.querySelector(".color-input");
        if (colorInput) colorInput.value = colorItem.dataset.color;
        self.refreshSwatch(layerId);
      }

      var fillColorItem = e.target.closest(".color-item[data-fill-color]");
      if (fillColorItem) {
        picker.querySelectorAll(".color-item[data-fill-color]").forEach(function(i) { i.classList.remove("active"); });
        fillColorItem.classList.add("active");
        layerManager.setLayerFillColor(layerId, fillColorItem.dataset.fillColor);
        var fillInput = picker.querySelector(".fill-color-input");
        if (fillInput) fillInput.value = fillColorItem.dataset.fillColor;
        self.refreshSwatch(layerId);
      }

      var strokeColorItem = e.target.closest(".color-item[data-stroke-color]");
      if (strokeColorItem) {
        picker.querySelectorAll(".color-item[data-stroke-color]").forEach(function(i) { i.classList.remove("active"); });
        strokeColorItem.classList.add("active");
        layerManager.setLayerStrokeColor(layerId, strokeColorItem.dataset.strokeColor);
        var strokeInput = picker.querySelector(".stroke-color-input");
        if (strokeInput) strokeInput.value = strokeColorItem.dataset.strokeColor;
        self.refreshSwatch(layerId);
      }

      var strokeBtn = e.target.closest(".stroke-btn");
      if (strokeBtn) {
        picker.querySelectorAll(".stroke-btn").forEach(function(b) { b.classList.remove("active"); });
        strokeBtn.classList.add("active");
        layerManager.setLayerStrokeDash(layerId, strokeBtn.dataset.stroke);
      }
    });

    var colorInput = picker.querySelector(".color-input");
    if (colorInput) {
      colorInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-color]").forEach(function(i) { i.classList.remove("active"); });
        layerManager.setLayerColor(layerId, e.target.value);
        self.refreshSwatch(layerId);
      });
    }

    var fillColorInput = picker.querySelector(".fill-color-input");
    if (fillColorInput) {
      fillColorInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-fill-color]").forEach(function(i) { i.classList.remove("active"); });
        layerManager.setLayerFillColor(layerId, e.target.value);
        self.refreshSwatch(layerId);
      });
    }

    var syncCheckbox = picker.querySelector(".stroke-sync-checkbox");
    if (syncCheckbox) {
      syncCheckbox.addEventListener("change", function(e) {
        var info = layerManager.getLayer(layerId);
        if (!info) return;
        info.strokeSyncToFill = e.target.checked;
        layerManager.updateLayerStyle(layerId);
        // 선 색상 섹션 활성/비활성 갱신
        var section = picker.querySelector(".stroke-color-section");
        if (section) {
          section.style.opacity = e.target.checked ? "0.4" : "";
          section.style.pointerEvents = e.target.checked ? "none" : "";
        }
      });
    }

    var strokeColorInput = picker.querySelector(".stroke-color-input");
    if (strokeColorInput) {
      strokeColorInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-stroke-color]").forEach(function(i) { i.classList.remove("active"); });
        layerManager.setLayerStrokeColor(layerId, e.target.value);
        self.refreshSwatch(layerId);
      });
    }

    bindSliderRow(picker, "fill-opacity", function(pct) {
      layerManager.setLayerFillOpacity(layerId, pct / 100);
    });

    bindSliderRow(picker, "stroke-opacity", function(pct) {
      layerManager.setLayerStrokeOpacity(layerId, pct / 100);
    });

    bindSliderRow(picker, "stroke-width", function(width) {
      layerManager.setLayerStrokeWidth(layerId, width);
    });

    bindSliderRow(picker, "raster-opacity", function(pct) {
      layerManager.setRasterOpacity(layerId, pct / 100);
    });

    var rasterFilterColorInput = picker.querySelector(".raster-filter-color-input");
    if (rasterFilterColorInput) {
      rasterFilterColorInput.addEventListener("input", function(e) {
        rasterAnalysisTool.recolorFilter(layerId, e.target.value);
        self.refreshSwatch(layerId);
      });
    }

    closeOnOutsideClick(picker);
  }

  /**
   * 드래그 시작
   */
  handleDragStart(e) {
    const item = e.target.closest('.layer-item');
    if (!item) return;

    this.draggedItem = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.layerId);
  }

  /**
   * 드래그 오버
   */
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const item = e.target.closest('.layer-item');
    if (!item || item === this.draggedItem) return;

    const rect = item.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    // 드롭 위치 표시
    this.container.querySelectorAll('.layer-item').forEach(li => {
      li.classList.remove('drop-above', 'drop-below');
    });

    if (e.clientY < midY) {
      item.classList.add('drop-above');
    } else {
      item.classList.add('drop-below');
    }
  }

  /**
   * 드롭
   */
  handleDrop(e) {
    e.preventDefault();

    const dropTarget = e.target.closest('.layer-item');
    if (!dropTarget || !this.draggedItem) return;

    const draggedId = this.draggedItem.dataset.layerId;
    const targetId = dropTarget.dataset.layerId;

    if (draggedId === targetId) return;

    // 화면에 표시된 순서로 작업 (높은 zIndex가 위)
    const displayOrder = layerManager.getAllLayers().map(l => l.id).reverse();

    // 드래그한 항목 제거
    const newDisplayOrder = displayOrder.filter(id => id !== draggedId);

    // 타겟 위치 찾기
    const targetIndex = newDisplayOrder.indexOf(targetId);

    // 드롭 위치에 따라 삽입
    const rect = dropTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
      // 타겟 위에 삽입
      newDisplayOrder.splice(targetIndex, 0, draggedId);
    } else {
      // 타겟 아래에 삽입
      newDisplayOrder.splice(targetIndex + 1, 0, draggedId);
    }

    // 실제 순서로 변환하여 적용
    layerManager.reorderLayers(newDisplayOrder.slice().reverse());
  }

  /**
   * 드래그 종료
   */
  handleDragEnd(e) {
    if (this.draggedItem) {
      this.draggedItem.classList.remove('dragging');
      this.draggedItem = null;
    }

    this.container.querySelectorAll('.layer-item').forEach(li => {
      li.classList.remove('drop-above', 'drop-below');
    });
  }
}
