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
    const renderer = new FlowRenderer({ zIndex: 600 });
    const fullStyle = {
      ...DEFAULT_FLOW_STYLE,
      animate: dataset.flows.length <= FLOW_ANIMATE_LIMIT,
      ...style
    };
    renderer.setStyle(fullStyle);
    renderer.setData(dataset);

    const layerId = layerManager.addLayer({
      id, name, type: 'flow', olLayer: renderer, geometryType: 'Flow', visible
    });
    const info = layerManager.getLayer(layerId);
    info._flowConfig = { dataset, style: fullStyle, selectedIds: [...selectedIds] };
    this.renderers.set(layerId, renderer);

    this._ensureInteraction();
    if (selectedIds.length) this.interaction.setSelection(renderer, selectedIds);
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
    this.interaction.setSelection(renderer, []);
  }

  getRenderer(layerId) { return this.renderers.get(layerId) || null; }

  getFlowLayers() {
    return layerManager.getAllLayers().filter((l) => l.type === 'flow');
  }

  freezeAnimations() { for (const r of this.renderers.values()) r.freeze(true); if (this.interaction) this.interaction.hideTooltip(); }
  thawAnimations() { for (const r of this.renderers.values()) r.freeze(false); }

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
