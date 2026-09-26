// © 2026 김용현
/**
 * SwipePanel — 스와이프 비교(실험실 `swipe`)의 UI.
 *
 * 툴바 #swipe-toggle 은 labs.isOn('swipe') 일 때만 보인다(승격 = syncToolbarButton 의 가드 삭제).
 * 열면 컨트롤 박스(#swipe-controls)와 막대(#swipe-divider)를 보이고 첫 대상을 SwipeTool 에 붙인다.
 * 대상이 배경지도면 카탈로그 소스로 TileLayer 를 만들어 baseLayer 바로 위(index 1)에 끼운다.
 * 세션 도구라 아무것도 저장하지 않는다.
 *
 * 3D 보기와는 배타다. 3D 가 켜져 있으면 열지 않고 안내만 한다. 반대 방향(3D 를 켤 때 스와이프 닫기)은
 * main.js 의 `case 'view3d'` 가 close() 를 불러 맞춘다.
 * 글래스 데스크톱에서는 지도가 창 전체라, 막대 비율을 보이는 지도 칸(--glass-*-offset 안쪽)으로 제한한다.
 * 설계: docs/superpowers/specs/2026-09-25-labs-design.md 「3단계」
 */
import TileLayer from 'ol/layer/Tile';
import { SwipeTool } from '../../tools/SwipeTool.js';
import { ratioFromPointer, dividerStyle, swipeTargetOptions, parseTargetValue } from '../../tools/swipeMath.js';
import { findBasemap } from '../../core/basemaps.js';
import { eventBus, Events } from '../../utils/EventBus.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { GLASS_ATTR, GLASS_ID, OFFSET_PROPS } from '../../labs/glass.js';

export const SWIPE_LAB_ID = 'swipe';

/** glass.css 가 지도를 창 전체에 까는 조건 — 이 밖(태블릿·휴대폰)에서는 오프셋이 의미가 없다. */
export const GLASS_DESKTOP_QUERY = '(min-width: 1025px) and (pointer: fine)';

const VIEW3D_MESSAGE = '3D 보기 중에는 스와이프 비교를 쓸 수 없습니다. 2D로 돌아간 뒤 여세요.';

/** 3D 보기가 켜져 있는가 — View3DPanel 이 켤 때 #view3d-toggle 에 .active·aria-pressed="true" 를 둔다. */
function defaultIsView3DActive() {
  if (typeof document === 'undefined') return false;
  const btn = document.getElementById('view3d-toggle');
  return !!(btn && (btn.classList.contains('active') || btn.getAttribute('aria-pressed') === 'true'));
}

/**
 * 글래스 데스크톱이면 #map-container 의 세 오프셋(px), 아니면 null.
 * @returns {{panel: number, top: number, bottom: number}|null}
 */
function defaultGlassInsets() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (document.documentElement.getAttribute(GLASS_ATTR) !== GLASS_ID) return null;
  if (typeof window.matchMedia === 'function' && !window.matchMedia(GLASS_DESKTOP_QUERY).matches) return null;
  const container = document.getElementById('map-container');
  if (!container || typeof window.getComputedStyle !== 'function') return null;
  const style = window.getComputedStyle(container);
  const px = (prop) => parseFloat(style.getPropertyValue(prop)) || 0;
  return { panel: px(OFFSET_PROPS.panel), top: px(OFFSET_PROPS.top), bottom: px(OFFSET_PROPS.bottom) };
}

/**
 * 순수: 막대 비율이 머물 범위. 세로 막대는 왼쪽 패널 끝부터 오른쪽 끝까지,
 * 가로 막대는 위(메뉴·툴바) 아래부터 아래(상태줄) 위까지. 크기·오프셋을 모르면 [0, 1].
 * @param {'vertical'|'horizontal'} orientation
 * @param {{width: number, height: number}} size 지도 요소 크기(px)
 * @param {{panel: number, top: number, bottom: number}|null} insets
 * @returns {{min: number, max: number}}
 */
export function glassRatioBounds(orientation, size, insets) {
  const full = { min: 0, max: 1 };
  if (!insets || !size) return full;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  let min;
  let max;
  if (orientation === 'horizontal') {
    if (!(size.height > 0)) return full;
    min = clamp01((insets.top || 0) / size.height);
    max = clamp01(1 - (insets.bottom || 0) / size.height);
  } else {
    if (!(size.width > 0)) return full;
    min = clamp01((insets.panel || 0) / size.width);
    max = 1;
  }
  if (min > max) {
    const mid = (min + max) / 2;
    min = mid;
    max = mid;
  }
  return { min, max };
}

export class SwipePanel {
  /**
   * @param {{
   *   mapManager: object, layerManager: object, labs: object,
   *   onMessage?: (msg: string) => void,
   *   isView3DActive?: () => boolean,
   *   glassInsets?: () => ({panel: number, top: number, bottom: number}|null)
   * }} options
   */
  constructor({ mapManager, layerManager, labs, onMessage, isView3DActive, glassInsets }) {
    this.mapManager = mapManager;
    this.layerManager = layerManager;
    this.labs = labs;
    this.onMessage = onMessage || (() => {});
    this.isView3DActive = isView3DActive || defaultIsView3DActive;
    this.glassInsets = glassInsets || defaultGlassInsets;
    this.tool = null;
    this.tempLayer = null;      // 배경지도 비교용 임시 TileLayer
    this.currentValue = null;   // 'layer:<id>' | 'basemap:<key>'
    this.dragging = false;
  }

  init() {
    this.toggleButton = document.getElementById('swipe-toggle');
    this.controls = document.getElementById('swipe-controls');
    this.targetSelect = document.getElementById('swipe-target');
    this.orientationSelect = document.getElementById('swipe-orientation');
    this.closeButton = document.getElementById('swipe-close');
    this.divider = document.getElementById('swipe-divider');
    this.mapElement = document.getElementById('map');
    if (!this.toggleButton || !this.controls || !this.divider) return;

    this.tool = new SwipeTool({ map: this.mapManager.getMap() });

    // 토글 클릭은 main.js 의 툴바 [data-tool] 스위치가 부른다 — 여기서 또 듣지 않는다
    this.targetSelect.addEventListener('change', () => this.applyTarget(this.targetSelect.value));
    this.orientationSelect.addEventListener('change', () => this.applyOrientation(this.orientationSelect.value));
    this.closeButton.addEventListener('click', () => this.close());

    this.divider.addEventListener('pointerdown', (e) => this.dragStart(e));
    this.divider.addEventListener('pointermove', (e) => this.dragMove(e));
    this.divider.addEventListener('pointerup', (e) => this.dragEnd(e));
    this.divider.addEventListener('pointercancel', (e) => this.dragEnd(e));

    eventBus.on(Events.LAYER_REMOVED, ({ layerId }) => this.onLayerRemoved(layerId));
    eventBus.on(Events.LAYER_ADDED, () => this.refreshOptions());
    eventBus.on(Events.LAYER_RENAMED, () => this.refreshOptions());

    this.syncToolbarButton();
    this.labs.onChange((id, on) => {
      if (id !== SWIPE_LAB_ID) return;
      this.syncToolbarButton();
      if (!on) this.close();
    });
  }

  /** 실험이 켜졌을 때만 툴바 버튼이 보인다. 승격하면 이 가드를 지운다. */
  syncToolbarButton() {
    this.toggleButton.hidden = !this.labs.isOn(SWIPE_LAB_ID);
  }

  isActive() {
    return !!(this.tool && this.tool.isActive());
  }

  toggle() {
    if (this.isActive()) this.close();
    else this.open();
  }

  open() {
    if (!this.tool) return;
    if (this.isView3DActive()) {
      this.close();
      this.onMessage(VIEW3D_MESSAGE);
      return;
    }
    const options = this.buildOptions();
    if (!options.length) {
      this.onMessage('비교할 레이어나 배경지도가 없습니다.');
      return;
    }
    this.fillSelect(options);
    this.controls.hidden = false;
    this.divider.hidden = false;
    this.applyOrientation(this.orientationSelect.value);
    this.applyTarget(options[0].value);
    if (!this.isActive()) return;   // 대상을 못 찾아 applyTarget 이 이미 닫았다
    this.toggleButton.classList.add('active');
    this.toggleButton.setAttribute('aria-pressed', 'true');
  }

  /** 닫는다. 열려 있지 않아도 안전하다(main.js 가 3D 를 켜기 전에 부른다). */
  close() {
    if (this.tool) this.tool.detach();
    this.removeTempLayer();
    this.currentValue = null;
    this.dragging = false;
    if (this.controls) this.controls.hidden = true;
    if (this.divider) this.divider.hidden = true;
    if (this.toggleButton) {
      this.toggleButton.classList.remove('active');
      this.toggleButton.setAttribute('aria-pressed', 'false');
    }
  }

  buildOptions() {
    return swipeTargetOptions(
      this.layerManager.getAllLayers(),
      this.mapManager.getAvailableBasemaps(),
      this.mapManager.getBasemap()
    );
  }

  fillSelect(options) {
    const layerGroup = options.filter((o) => o.group === 'layer');
    const basemapGroup = options.filter((o) => o.group === 'basemap');
    // 레이어 이름은 업로드 파일에서 온다 — 값·라벨 모두 이스케이프
    const optionHtml = (o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`;
    let html = '';
    if (layerGroup.length) html += `<optgroup label="레이어">${layerGroup.map(optionHtml).join('')}</optgroup>`;
    if (basemapGroup.length) html += `<optgroup label="배경지도">${basemapGroup.map(optionHtml).join('')}</optgroup>`;
    this.targetSelect.innerHTML = html;
  }

  /** 레이어가 늘거나 이름이 바뀌면 목록만 다시 채운다(진행 중인 대상은 유지). */
  refreshOptions() {
    if (!this.isActive()) return;
    const options = this.buildOptions();
    this.fillSelect(options);
    if (options.some((o) => o.value === this.currentValue)) {
      this.targetSelect.value = this.currentValue;
    }
  }

  onLayerRemoved(layerId) {
    if (!this.isActive()) return;
    if (this.currentValue === `layer:${layerId}`) {
      this.close();   // 대상이 사라졌다 — 조용히 끝낸다
      return;
    }
    this.refreshOptions();
  }

  /** @param {string} value 'layer:<id>' | 'basemap:<key>' */
  applyTarget(value) {
    const parsed = parseTargetValue(value);
    if (!parsed) return;
    this.tool.detach();
    this.removeTempLayer();

    let olLayer = null;
    if (parsed.kind === 'layer') {
      const info = this.layerManager.getLayer(parsed.id);
      olLayer = info ? info.olLayer : null;
    } else {
      const item = findBasemap(parsed.id);
      if (item) {
        this.tempLayer = new TileLayer({
          source: item.source(),
          properties: { name: 'swipe-basemap', type: 'base' }
        });
        this.mapManager.getMap().getLayers().insertAt(1, this.tempLayer);
        olLayer = this.tempLayer;
      }
    }
    if (!olLayer) {
      this.onMessage('비교 대상을 찾을 수 없습니다.');
      this.close();
      return;
    }
    this.currentValue = value;
    this.targetSelect.value = value;
    this.tool.attach(olLayer, { orientation: this.orientationSelect.value, ratio: this.tool.ratio });
  }

  applyOrientation(orientation) {
    this.tool.setOrientation(orientation);
    // 방향이 바뀌면 보이는 칸도 바뀐다(글래스) — 지금 비율을 그 안으로 끌어온다
    const clamped = this.clampToVisible(this.tool.ratio);
    if (clamped !== this.tool.ratio) this.tool.setRatio(clamped);
    this.divider.classList.toggle('horizontal', this.tool.orientation === 'horizontal');
    this.divider.setAttribute('aria-orientation', this.tool.orientation);
    this.positionDivider();
  }

  positionDivider() {
    const style = dividerStyle(this.tool.ratio, this.tool.orientation);
    this.divider.style.left = style.left;
    this.divider.style.top = style.top;
  }

  /** 글래스 데스크톱이면 막대가 보이는 지도 칸을 벗어나지 않게 비율을 자른다. 아니면 그대로. */
  clampToVisible(ratio) {
    const insets = this.glassInsets();
    if (!insets || !this.mapElement) return ratio;
    const rect = this.mapElement.getBoundingClientRect();
    const { min, max } = glassRatioBounds(this.tool.orientation, rect, insets);
    return Math.min(max, Math.max(min, ratio));
  }

  removeTempLayer() {
    if (!this.tempLayer) return;
    this.mapManager.getMap().getLayers().remove(this.tempLayer);
    this.tempLayer = null;
  }

  dragStart(e) {
    this.dragging = true;
    if (e.pointerId !== undefined && this.divider.setPointerCapture) this.divider.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  dragMove(e) {
    if (!this.dragging) return;
    const rect = this.mapElement.getBoundingClientRect();
    const ratio = ratioFromPointer(e, rect, this.tool.orientation);
    this.tool.setRatio(this.clampToVisible(ratio));
    this.positionDivider();
  }

  dragEnd(e) {
    if (!this.dragging) return;
    this.dragging = false;
    if (e.pointerId !== undefined && this.divider.releasePointerCapture) {
      try { this.divider.releasePointerCapture(e.pointerId); } catch { /* 이미 풀림 */ }
    }
  }
}
