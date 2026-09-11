// © 2026 김용현
/**
 * FlowTool — 흐름 레이어의 수명 주기.
 *  - createFlowLayer / restoreFlow: FlowRenderer 를 LayerManager 에 type:'flow' 로 등록, 설정은 _flowConfig
 *  - 지도 리스너(FlowInteraction)는 흐름 레이어가 하나라도 있을 때만 붙인다
 *  - freezeAnimations / thawAnimations: 내보내기 캡처 동안 실선으로
 */
import { FlowRenderer, DEFAULT_FLOW_STYLE } from '../flow/FlowRenderer.js';
import { FlowInteraction } from '../flow/FlowInteraction.js';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';
import { toolManager } from './ToolManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

export const FLOW_ANIMATE_LIMIT = 5000; // 이보다 흐름이 많으면 애니메이션을 끈 채 시작

class FlowTool {
  constructor() {
    this.renderers = new Map(); // layerId → FlowRenderer
    this.interaction = null;
    this._freezeDepth = 0; // freeze/thaw 짝이 겹쳐도 마지막 thaw 에서만 되살린다
    eventBus.on(Events.LAYER_REMOVED, ({ layerId, layer }) => {
      const id = layerId || (layer && layer.id);
      if (id) this._forget(id);
    });
  }

  /**
   * @param {Object} o
   * @param {string} o.name
   * @param {Object} o.dataset   FlowDataset
   * @param {Object} [o.style]   DEFAULT_FLOW_STYLE 위에 덮을 값
   * @param {string} [o.id]      복원 시 보존할 레이어 id
   * @param {string[]} [o.selectedIds]
   * @param {boolean} [o.visible]
   * @returns {string} layerId
   */
  createFlowLayer({ name, dataset, style = {}, id, selectedIds = [], visible = true }) {
    // 같은 id 로 다시 만드는 경우(복원 재시도 등) 이전 렌더러가 새지 않도록 먼저 정리한다
    if (id && this.renderers.has(id)) layerManager.removeLayer(id);

    // zIndex 는 지정하지 않는다 — addLayer 가 레이어 목록 순서로 쌓기 순서를 정하므로 여기서 줘도 덮인다
    const renderer = new FlowRenderer();
    const fullStyle = {
      ...DEFAULT_FLOW_STYLE,
      ...style,
      // 명시적으로 animate:false 를 준 경우는 그대로 두고, 아니면 흐름 수가 상한을 넘을 때만 끈다
      animate: (style.animate ?? true) && dataset.flows.length <= FLOW_ANIMATE_LIMIT
    };
    renderer.setStyle(fullStyle);
    renderer.setData(dataset);
    // addLayer 의 기존-olLayer 분기는 visible 을 올려주지 않으므로 직접 반영해 둔다
    renderer.setVisible(visible);

    const layerId = layerManager.addLayer({
      id, name, type: 'flow', olLayer: renderer, geometryType: 'Flow', visible
    });
    const info = layerManager.getLayer(layerId);
    info._flowConfig = { dataset, style: fullStyle, selectedIds: [...selectedIds] };
    this.renderers.set(layerId, renderer);
    // addLayer 가 LAYER_ADDED 를 이미 쏜 뒤라 그때 그려진 레이어 목록에는 _flowConfig 가 없었다
    // (스와치 램프 색 등) — 설정을 심고 나서 한 번 더 알린다. 자동 저장은 디바운스라 겹치지 않는다
    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });

    this._ensureInteraction();
    if (selectedIds.length) {
      if (this.interaction) this.interaction.setSelection(renderer, selectedIds);
      else renderer.setHighlight(selectedIds);
    }
    return layerId;
  }

  /** ProjectManager.deserialize 가 부른다 */
  restoreFlow(layerData) {
    const cfg = layerData.flowConfig;
    return this.createFlowLayer({
      id: layerData.id,
      name: layerData.name,
      dataset: cfg.dataset,
      style: cfg.style || {},
      selectedIds: cfg.selectedIds || [],
      visible: layerData.visible !== false
    });
  }

  updateStyle(layerId, patch) {
    const renderer = this.renderers.get(layerId);
    const info = layerManager.getLayer(layerId);
    if (!renderer || !info) return;
    renderer.setStyle(patch);
    info._flowConfig.style = { ...info._flowConfig.style, ...patch };
    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
  }

  /** 데이터·이름을 바꿔 다시 만들 때 (패널의 "적용") */
  replaceData(layerId, dataset) {
    const renderer = this.renderers.get(layerId);
    const info = layerManager.getLayer(layerId);
    if (!renderer || !info) return;
    renderer.setData(dataset);
    info._flowConfig.dataset = dataset;
    info._flowConfig.selectedIds = [];
    if (this.interaction) this.interaction.setSelection(renderer, []);
    else renderer.setHighlight([]);
  }

  getRenderer(layerId) { return this.renderers.get(layerId) || null; }

  getFlowLayers() {
    return layerManager.getAllLayers().filter((l) => l.type === 'flow');
  }

  /** 내보내기 캡처 동안 점선을 실선으로 멈춘다. 중첩 호출은 깊이로 세어 안쪽 thaw 가 먼저 풀지 않게 한다 */
  freezeAnimations() {
    this._freezeDepth++;
    for (const r of this.renderers.values()) r.freeze(true);
    if (this.interaction) this.interaction.clearHover();
  }
  thawAnimations() {
    this._freezeDepth = Math.max(0, this._freezeDepth - 1);
    if (this._freezeDepth > 0) return;
    for (const r of this.renderers.values()) r.freeze(false);
  }

  // ---- 내부 -----------------------------------------------------------------

  _ensureInteraction() {
    if (this.interaction) return;
    const map = mapManager.getMap();
    if (!map) return;
    this.interaction = new FlowInteraction({
      map,
      getRenderers: () => layerManager.getAllLayers()
        .filter((l) => l.type === 'flow' && l.visible && this.renderers.has(l.id))
        .map((l) => this.renderers.get(l.id)),
      onSelectionChange: (renderer, ids) => {
        for (const [layerId, r] of this.renderers) {
          if (r === renderer) {
            const info = layerManager.getLayer(layerId);
            if (info && info._flowConfig) info._flowConfig.selectedIds = ids;
            eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId }); // 선택도 자동 저장에 담기도록
          }
        }
      },
      isBlocked: () => !!toolManager.getCurrentTool()
    });
    this.interaction.attach();
  }

  _forget(layerId) {
    const renderer = this.renderers.get(layerId);
    if (!renderer) return;
    if (this.interaction) this.interaction.forget(renderer);
    renderer.dispose();
    this.renderers.delete(layerId);
    if (this.renderers.size === 0 && this.interaction) {
      this.interaction.detach();
      this.interaction = null;
    }
  }
}

export const flowTool = new FlowTool();
