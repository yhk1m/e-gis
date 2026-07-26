// © 2026 김용현
/**
 * LayerCombineTool - 레이어 합치기 / 나누기
 *
 * 합치기: 여러 레이어의 객체를 한 레이어로 모은다 (원본은 그대로 두는 것이 기본)
 * 나누기: 한 레이어의 객체를 속성값이나 객체 단위로 여러 레이어로 흩는다
 *
 * 원본 객체를 복제해서 담으므로, 원본을 지우지 않으면 양쪽이 서로 영향을 주지 않는다.
 */

import { layerManager } from '../core/LayerManager.js';
import { isVectorLayer } from '../utils/layerSelect.js';

/** 합칠 때 각 객체에 남기는 원본 레이어 이름 필드 */
export const SOURCE_FIELD = '원본레이어';

/** 나눌 때 한 번에 만들 수 있는 최대 레이어 수 (실수로 수백 개를 만들지 않도록) */
export const MAX_SPLIT_LAYERS = 100;

class LayerCombineTool {
  /** 합치거나 나눌 수 있는 레이어 (피처를 가진 벡터 레이어) */
  getCompatibleLayers() {
    return layerManager.getAllLayers().filter(
      layer => isVectorLayer(layer) && layer.source.getFeatures().length > 0
    );
  }

  /** 나누는 기준으로 쓸 수 있는 속성 필드 */
  getFields(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.source) return [];
    const features = layerInfo.source.getFeatures();
    if (features.length === 0) return [];

    // 일부 객체에만 있는 필드도 놓치지 않게 앞쪽 객체들을 훑는다
    const fields = new Set();
    features.slice(0, 200).forEach(f => {
      Object.keys(f.getProperties()).forEach(k => {
        if (k !== 'geometry' && !k.startsWith('_')) fields.add(k);
      });
    });
    return Array.from(fields);
  }

  /** 필드로 나눌 때 몇 개의 레이어가 생기는지 미리 센다 */
  countGroups(layerId, field) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !layerInfo.source) return 0;
    const values = new Set();
    layerInfo.source.getFeatures().forEach(f => values.add(this.groupKey(f, field)));
    return values.size;
  }

  groupKey(feature, field) {
    const v = feature.get(field);
    return (v === undefined || v === null || String(v).trim() === '') ? '(빈값)' : String(v);
  }

  /**
   * 여러 레이어를 하나로 합친다
   * @param {string[]} layerIds
   * @param {object} options { name, removeSources, keepSourceName }
   */
  merge(layerIds, options = {}) {
    const layers = layerIds
      .map(id => layerManager.getLayer(id))
      .filter(l => l && isVectorLayer(l));

    if (layers.length < 2) {
      throw new Error('합치려면 레이어를 2개 이상 선택해야 합니다.');
    }

    const keepSourceName = options.keepSourceName !== false;
    const features = [];
    const geometryTypes = new Set();

    layers.forEach(layerInfo => {
      layerInfo.source.getFeatures().forEach(feature => {
        const copy = feature.clone();
        if (keepSourceName) copy.set(SOURCE_FIELD, layerInfo.name);
        const geom = copy.getGeometry();
        if (geom) geometryTypes.add(geom.getType());
        features.push(copy);
      });
    });

    if (features.length === 0) {
      throw new Error('선택한 레이어에 객체가 없습니다.');
    }

    const name = (options.name && options.name.trim())
      || `${layers[0].name} 외 ${layers.length - 1}개 합침`;

    const newLayerId = layerManager.addLayer({
      name: layerManager.uniqueName(name),
      type: 'vector',
      features,
      color: layers[0].color
    });

    if (options.removeSources) {
      layers.forEach(l => layerManager.removeLayer(l.id));
    }

    return {
      layerId: newLayerId,
      featureCount: features.length,
      sourceCount: layers.length,
      // 도형 종류가 섞이면 스타일이 한쪽 기준으로만 잡히므로 호출부가 알려줄 수 있게 넘긴다
      geometryTypes: Array.from(geometryTypes)
    };
  }

  /**
   * 속성값이 같은 객체끼리 묶어 여러 레이어로 나눈다
   * @param {string} layerId
   * @param {string} field
   * @param {object} options { removeSource }
   */
  splitByField(layerId, field, options = {}) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !isVectorLayer(layerInfo)) {
      throw new Error('나눌 수 있는 레이어가 아닙니다.');
    }

    const groups = new Map();
    layerInfo.source.getFeatures().forEach(feature => {
      const key = this.groupKey(feature, field);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(feature.clone());
    });

    if (groups.size === 0) throw new Error('나눌 객체가 없습니다.');
    if (groups.size > MAX_SPLIT_LAYERS) {
      throw new Error(`레이어가 ${groups.size}개 만들어집니다. ${MAX_SPLIT_LAYERS}개까지만 나눌 수 있습니다.\n다른 필드를 고르거나 먼저 걸러내세요.`);
    }

    const created = [];
    const color = layerInfo.color;

    // 값 순서대로 만들어야 레이어 목록이 뒤죽박죽이 되지 않는다
    Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'ko')).forEach(key => {
      const id = layerManager.addLayer({
        // 기준 필드의 값을 그대로 레이어 이름으로 쓴다 (시도로 나누면 '강원', '경기' …)
        name: layerManager.uniqueName(key),
        type: 'vector',
        features: groups.get(key),
        color
      });
      created.push(id);
    });

    if (options.removeSource) layerManager.removeLayer(layerId);

    return { layerIds: created, groupCount: created.length };
  }

  /**
   * 객체 하나당 레이어 하나로 나눈다
   * @param {string} layerId
   * @param {object} options { removeSource, nameField }
   */
  splitByFeature(layerId, options = {}) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo || !isVectorLayer(layerInfo)) {
      throw new Error('나눌 수 있는 레이어가 아닙니다.');
    }

    const features = layerInfo.source.getFeatures();
    if (features.length === 0) throw new Error('나눌 객체가 없습니다.');
    if (features.length > MAX_SPLIT_LAYERS) {
      throw new Error(`레이어가 ${features.length}개 만들어집니다. ${MAX_SPLIT_LAYERS}개까지만 나눌 수 있습니다.\n속성값 기준으로 나누는 편이 낫습니다.`);
    }

    const created = [];
    features.forEach((feature, i) => {
      const label = options.nameField ? this.groupKey(feature, options.nameField) : `${i + 1}`;
      const id = layerManager.addLayer({
        name: layerManager.uniqueName(`${layerInfo.name} - ${label}`),
        type: 'vector',
        features: [feature.clone()],
        color: layerInfo.color
      });
      created.push(id);
    });

    if (options.removeSource) layerManager.removeLayer(layerId);

    return { layerIds: created, groupCount: created.length };
  }
}

export const layerCombineTool = new LayerCombineTool();
