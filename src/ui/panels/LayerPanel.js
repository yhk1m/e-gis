/**
 * LayerPanel - 레이어 패널 UI 컴포넌트
 */

import { eventBus, Events } from '../../utils/EventBus.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';

export class LayerPanel {
  constructor(containerId = 'layer-list') {
    this.container = document.getElementById(containerId);
    this.draggedItem = null;
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
    eventBus.on(Events.LAYER_VISIBILITY_CHANGED, () => this.render());
    eventBus.on(Events.LAYER_SELECTED, () => this.render());
    eventBus.on(Events.LAYER_ORDER_CHANGED, () => this.render());
    eventBus.on(Events.LAYER_STYLE_CHANGED, () => this.render());

    // 컨테이너 클릭 이벤트 위임
    this.container.addEventListener('click', (e) => this.handleClick(e));
    this.container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

    // 드래그 앤 드롭
    this.container.addEventListener('dragstart', (e) => this.handleDragStart(e));
    this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.container.addEventListener('drop', (e) => this.handleDrop(e));
    this.container.addEventListener('dragend', (e) => this.handleDragEnd(e));
  }

  /**
   * 레이어 목록 렌더링
   */
  render() {
    const layers = layerManager.getAllLayers();
    const selectedIds = layerManager.getSelectedLayerIds();
    const primarySelectedId = layerManager.getSelectedLayerId();

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

      return `
        <li class="${className}"
            data-layer-id="${layer.id}"
            draggable="true">
          <input type="checkbox"
                 class="layer-visibility"
                 ${layer.visible ? 'checked' : ''}
                 title="표시/숨김">
          <span class="layer-color" style="background-color: ${layer.color}"></span>
          <span class="layer-name" title="${layer.name}">${layer.name}</span>
          <span class="layer-count">(${layer.featureCount})</span>
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
   * 다중 선택 정보 표시
   */
  showMultiSelectInfo(count) {
    let infoEl = document.querySelector('.layer-multi-select-info');
    if (!infoEl) {
      infoEl = document.createElement('div');
      infoEl.className = 'layer-multi-select-info';
      this.container.parentElement.insertBefore(infoEl, this.container);
    }
    infoEl.innerHTML = `<span>${count}개 레이어 선택됨</span><button class="clear-selection-btn" title="선택 해제">✕</button>`;

    const clearBtn = infoEl.querySelector('.clear-selection-btn');
    clearBtn.onclick = () => layerManager.clearSelection();
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
    if (e.target.classList.contains("layer-color")) {
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

    // 레이어 선택 (Ctrl/Shift 키 지원)
    layerManager.selectLayerWithModifier(layerId, e.ctrlKey || e.metaKey, e.shiftKey);
  }

  /**
   * 더블클릭 이벤트 (레이어로 줌)
   */
  handleDoubleClick(e) {
    const item = e.target.closest('.layer-item');
    if (!item) return;

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
        <div class="context-menu-item" data-action="zoom-all">선택 레이어로 이동</div>
        <div class="context-menu-item" data-action="show-all">모두 표시</div>
        <div class="context-menu-item" data-action="hide-all">모두 숨기기</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="remove-all">선택 레이어 삭제</div>
      `;
    } else {
      // 단일 선택 메뉴
      menu.innerHTML = `
        <div class="context-menu-item" data-action="zoom">레이어로 이동</div>
        <div class="context-menu-item" data-action="rename">이름 변경</div>
        <div class="context-menu-item" data-action="table">속성 테이블</div>
        <div class="context-menu-item" data-action="color">색상 변경</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="remove">삭제</div>
      `;
    }

    // 위치 설정
    const rect = e.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = rect.right + 'px';
    menu.style.top = rect.top + 'px';

    document.body.appendChild(menu);

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
  handleMenuAction(action, layerId, selectedIds = null) {
    switch (action) {
      case 'zoom':
        layerManager.zoomToLayer(layerId);
        break;
      case 'rename':
        this.promptRename(layerId);
        break;
      case 'table':
        eventBus.emit('layer:openTable', { layerId });
        break;
      case 'color':
        this.showColorPicker(layerId);
        break;
      case 'remove':
        if (confirm('이 레이어를 삭제하시겠습니까?')) {
          layerManager.removeLayer(layerId);
        }
        break;
      // 다중 선택 액션
      case 'zoom-all':
        if (selectedIds) {
          this.zoomToSelectedLayers(selectedIds);
        }
        break;
      case 'show-all':
        if (selectedIds) {
          selectedIds.forEach(id => {
            const layer = layerManager.getLayer(id);
            if (layer && !layer.visible) {
              layerManager.toggleVisibility(id);
            }
          });
        }
        break;
      case 'hide-all':
        if (selectedIds) {
          selectedIds.forEach(id => {
            const layer = layerManager.getLayer(id);
            if (layer && layer.visible) {
              layerManager.toggleVisibility(id);
            }
          });
        }
        break;
      case 'remove-all':
        if (selectedIds && confirm(`${selectedIds.length}개의 레이어를 삭제하시겠습니까?`)) {
          selectedIds.forEach(id => layerManager.removeLayer(id));
          layerManager.clearSelection();
        }
        break;
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

    const newName = prompt('새 레이어 이름:', layer.name);
    if (newName && newName.trim()) {
      layerManager.renameLayer(layerId, newName.trim());
    }
  }


  /**
   * 스타일 편집 팝업 표시
   */
  showColorPicker(layerId) {
    const layer = layerManager.getLayer(layerId);
    if (!layer) return;

    const existingPicker = document.querySelector(".color-picker-popup");
    if (existingPicker) existingPicker.remove();

    const colors = layerManager.getColorPalette();
    const picker = document.createElement("div");
    picker.className = "color-picker-popup";

    // 강제 인라인 스타일 적용 (기본 위치 포함)
    picker.style.cssText = "position: fixed; left: 300px; top: 100px; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; min-width: 200px; z-index: 99999; box-shadow: 0 4px 20px rgba(0,0,0,0.3);";

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

    if (isPolygon) {
      // 면 색상
      const fillColorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === currentFillColor ? " active" : "") + "\" data-fill-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section\"><label>면 색상:</label><div class=\"color-picker-grid\">" + fillColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentFillColor + "\" class=\"fill-color-input\"></div></div>";

      // 면 투명도
      html += "<div class=\"style-section\"><label>면 투명도: <span class=\"fill-opacity-value\">" + Math.round(currentFillOpacity * 100) + "%</span></label>";
      html += "<input type=\"range\" class=\"opacity-slider fill-opacity-slider\" min=\"0\" max=\"100\" value=\"" + Math.round(currentFillOpacity * 100) + "\"></div>";

      // 선 색상
      const strokeColorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === currentStrokeColor ? " active" : "") + "\" data-stroke-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section\"><label>선 색상:</label><div class=\"color-picker-grid\">" + strokeColorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + currentStrokeColor + "\" class=\"stroke-color-input\"></div></div>";

      // 선 두께
      html += "<div class=\"style-section\"><label>선 두께: <span class=\"stroke-width-value\">" + currentStrokeWidth + "px</span></label>";
      html += "<input type=\"range\" class=\"stroke-width-slider\" min=\"1\" max=\"10\" value=\"" + currentStrokeWidth + "\"></div>";

      // 선 스타일
      html += "<div class=\"style-section\"><label>선 스타일:</label><div class=\"stroke-style-options\">";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "solid" ? " active" : "") + "\" data-stroke=\"solid\" title=\"실선\">━━━</button>";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "dashed" ? " active" : "") + "\" data-stroke=\"dashed\" title=\"파선\">┅┅┅</button>";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "dotted" ? " active" : "") + "\" data-stroke=\"dotted\" title=\"점선\">┈┈┈</button>";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "dash-dot" ? " active" : "") + "\" data-stroke=\"dash-dot\" title=\"일점쇄선\">━┅━</button>";
      html += "</div></div>";
    }
 else if (isLine) {
      const colorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === layer.color ? " active" : "") + "\" data-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section\"><label>선 색상:</label><div class=\"color-picker-grid\">" + colorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + layer.color + "\" class=\"color-input\"></div></div>";

      // 선 투명도
      html += "<div class=\"style-section\"><label>선 투명도: <span class=\"stroke-opacity-value\">" + Math.round(currentStrokeOpacity * 100) + "%</span></label>";
      html += "<input type=\"range\" class=\"opacity-slider stroke-opacity-slider\" min=\"0\" max=\"100\" value=\"" + Math.round(currentStrokeOpacity * 100) + "\"></div>";

      // 선 두께
      html += "<div class=\"style-section\"><label>선 두께: <span class=\"stroke-width-value\">" + currentStrokeWidth + "px</span></label>";
      html += "<input type=\"range\" class=\"stroke-width-slider\" min=\"1\" max=\"10\" value=\"" + currentStrokeWidth + "\"></div>";

      // 선 스타일
      html += "<div class=\"style-section\"><label>선 스타일:</label><div class=\"stroke-style-options\">";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "solid" ? " active" : "") + "\" data-stroke=\"solid\" title=\"실선\">━━━</button>";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "dashed" ? " active" : "") + "\" data-stroke=\"dashed\" title=\"파선\">┅┅┅</button>";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "dotted" ? " active" : "") + "\" data-stroke=\"dotted\" title=\"점선\">┈┈┈</button>";
      html += "<button class=\"stroke-btn" + (currentStrokeDash === "dash-dot" ? " active" : "") + "\" data-stroke=\"dash-dot\" title=\"일점쇄선\">━┅━</button>";
      html += "</div></div>";
    } else {
      const colorItems = colors.map(function(color) {
        return "<div class=\"color-item" + (color === layer.color ? " active" : "") + "\" data-color=\"" + color + "\" style=\"background-color: " + color + "\"></div>";
      }).join("");

      html += "<div class=\"style-section\"><label>색상:</label><div class=\"color-picker-grid\">" + colorItems + "</div>";
      html += "<div class=\"color-picker-custom\"><input type=\"color\" value=\"" + layer.color + "\" class=\"color-input\"></div></div>";

      // 포인트 투명도
      html += "<div class=\"style-section\"><label>투명도: <span class=\"fill-opacity-value\">" + Math.round(currentFillOpacity * 100) + "%</span></label>";
      html += "<input type=\"range\" class=\"opacity-slider fill-opacity-slider\" min=\"0\" max=\"100\" value=\"" + Math.round(currentFillOpacity * 100) + "\"></div>";
    }


    picker.innerHTML = html;

    document.body.appendChild(picker);

    // 팝업 위치 조정 (화면 밖으로 나가지 않도록)
    const layerItem = this.container.querySelector("[data-layer-id=\"" + layerId + "\"]");
    if (layerItem) {
      const rect = layerItem.getBoundingClientRect();
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

    // 이벤트 핸들러
    picker.addEventListener("click", function(e) {
      var colorItem = e.target.closest(".color-item[data-color]");
      if (colorItem) {
        picker.querySelectorAll(".color-item[data-color]").forEach(function(i) { i.classList.remove("active"); });
        colorItem.classList.add("active");
        layerManager.setLayerColor(layerId, colorItem.dataset.color);
        var colorInput = picker.querySelector(".color-input");
        if (colorInput) colorInput.value = colorItem.dataset.color;
      }

      var fillColorItem = e.target.closest(".color-item[data-fill-color]");
      if (fillColorItem) {
        picker.querySelectorAll(".color-item[data-fill-color]").forEach(function(i) { i.classList.remove("active"); });
        fillColorItem.classList.add("active");
        layerManager.setLayerFillColor(layerId, fillColorItem.dataset.fillColor);
        var fillInput = picker.querySelector(".fill-color-input");
        if (fillInput) fillInput.value = fillColorItem.dataset.fillColor;
      }

      var strokeColorItem = e.target.closest(".color-item[data-stroke-color]");
      if (strokeColorItem) {
        picker.querySelectorAll(".color-item[data-stroke-color]").forEach(function(i) { i.classList.remove("active"); });
        strokeColorItem.classList.add("active");
        layerManager.setLayerStrokeColor(layerId, strokeColorItem.dataset.strokeColor);
        var strokeInput = picker.querySelector(".stroke-color-input");
        if (strokeInput) strokeInput.value = strokeColorItem.dataset.strokeColor;
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
      });
    }

    var fillColorInput = picker.querySelector(".fill-color-input");
    if (fillColorInput) {
      fillColorInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-fill-color]").forEach(function(i) { i.classList.remove("active"); });
        layerManager.setLayerFillColor(layerId, e.target.value);
      });
    }

    var strokeColorInput = picker.querySelector(".stroke-color-input");
    if (strokeColorInput) {
      strokeColorInput.addEventListener("input", function(e) {
        picker.querySelectorAll(".color-item[data-stroke-color]").forEach(function(i) { i.classList.remove("active"); });
        layerManager.setLayerStrokeColor(layerId, e.target.value);
      });
    }

    var fillOpacitySlider = picker.querySelector(".fill-opacity-slider");
    if (fillOpacitySlider) {
      fillOpacitySlider.addEventListener("input", function(e) {
        var opacity = parseInt(e.target.value) / 100;
        var label = picker.querySelector(".fill-opacity-value");
        if (label) label.textContent = e.target.value + "%";
        layerManager.setLayerFillOpacity(layerId, opacity);
      });
    }

    var strokeOpacitySlider = picker.querySelector(".stroke-opacity-slider");
    if (strokeOpacitySlider) {
      strokeOpacitySlider.addEventListener("input", function(e) {
        var opacity = parseInt(e.target.value) / 100;
        var label = picker.querySelector(".stroke-opacity-value");
        if (label) label.textContent = e.target.value + "%";
        layerManager.setLayerStrokeOpacity(layerId, opacity);
      });
    }

    var strokeWidthSlider = picker.querySelector(".stroke-width-slider");
    if (strokeWidthSlider) {
      strokeWidthSlider.addEventListener("input", function(e) {
        var width = parseInt(e.target.value);
        var label = picker.querySelector(".stroke-width-value");
        if (label) label.textContent = width + "px";
        layerManager.setLayerStrokeWidth(layerId, width);
      });
    }

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
