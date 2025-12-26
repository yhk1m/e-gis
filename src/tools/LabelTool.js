/**
 * LabelTool - 레이어 라벨링 도구
 * 피처의 속성값을 지도 위에 텍스트로 표시
 */

import { Style, Text, Fill, Stroke } from 'ol/style';
import { layerManager } from '../core/LayerManager.js';
import { eventBus, Events } from '../utils/EventBus.js';

class LabelTool {
  constructor() {
    // 레이어별 라벨 설정 저장
    this.labelConfigs = new Map();

    // 스타일 변경 시 라벨 재적용 이벤트 리스너
    eventBus.on('label:refresh', (data) => {
      if (this.labelConfigs.has(data.layerId)) {
        this.applyLabel(data.layerId);
      }
    });
  }

  /**
   * 레이어에 라벨 설정
   * @param {string} layerId - 레이어 ID
   * @param {Object} config - 라벨 설정
   */
  setLabel(layerId, config) {
    const { field, fontSize = 12, fontColor = '#333333', haloColor = '#ffffff', haloWidth = 2 } = config;

    if (!field) {
      this.removeLabel(layerId);
      return;
    }

    this.labelConfigs.set(layerId, config);
    this.applyLabel(layerId);
  }

  /**
   * 라벨 스타일 적용
   */
  applyLabel(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    const layer = layerInfo.olLayer;

    const config = this.labelConfigs.get(layerId);
    if (!config) return;

    const { field, fontSize = 12, fontColor = '#333333', haloColor = '#ffffff', haloWidth = 2 } = config;

    // 원본 스타일 가져오기 (이미 저장되어 있으면 그것을 사용)
    const originalStyle = layer._originalStyle || layer.getStyle();

    // 원본 스타일 저장 (아직 저장되지 않은 경우에만)
    if (!layer._originalStyle) {
      layer._originalStyle = originalStyle;
    }

    // 새 스타일 함수 생성
    const labelStyle = (feature, resolution) => {
      // 기존 스타일 적용
      let baseStyles = [];
      if (typeof originalStyle === 'function') {
        const result = originalStyle(feature, resolution);
        baseStyles = Array.isArray(result) ? result : [result];
      } else if (originalStyle) {
        baseStyles = Array.isArray(originalStyle) ? originalStyle : [originalStyle];
      }

      // 라벨 텍스트 가져오기
      const value = feature.get(field);
      if (value === undefined || value === null) {
        return baseStyles;
      }

      // 텍스트 스타일 생성
      const textStyle = new Style({
        text: new Text({
          text: String(value),
          font: `${fontSize}px sans-serif`,
          fill: new Fill({ color: fontColor }),
          stroke: new Stroke({ color: haloColor, width: haloWidth }),
          overflow: true,
          offsetY: 0
        })
      });

      return [...baseStyles, textStyle];
    };

    layer.setStyle(labelStyle);
    layer._hasLabel = true;

    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
  }

  /**
   * 라벨 제거
   */
  removeLabel(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    const layer = layerInfo.olLayer;

    this.labelConfigs.delete(layerId);

    // 원본 스타일 복원
    if (layer._originalStyle) {
      layer.setStyle(layer._originalStyle);
      delete layer._originalStyle;
    }
    delete layer._hasLabel;

    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
  }

  /**
   * 레이어의 라벨 설정 가져오기
   */
  getLabelConfig(layerId) {
    return this.labelConfigs.get(layerId) || null;
  }

  /**
   * 레이어에 라벨이 있는지 확인
   */
  hasLabel(layerId) {
    return this.labelConfigs.has(layerId);
  }

  /**
   * 레이어의 필드 목록 가져오기
   */
  getLayerFields(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    const source = layerInfo.olLayer.getSource();
    const features = source.getFeatures();
    if (features.length === 0) return [];

    // 첫 번째 피처에서 필드 목록 추출
    const props = features[0].getProperties();
    return Object.keys(props).filter(key => key !== 'geometry');
  }
}

export const labelTool = new LabelTool();
