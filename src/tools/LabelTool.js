/**
 * LabelTool - 레이어 라벨링 도구
 * 피처의 속성값을 지도 위에 텍스트로 표시
 */

import { Style, Text, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { Point } from 'ol/geom';
import { layerManager } from '../core/LayerManager.js';
import { mapManager } from '../core/MapManager.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { Translate } from 'ol/interaction';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import Feature from 'ol/Feature';

class LabelTool {
  constructor() {
    this.labelConfigs = new Map();
    this.labelOffsets = new Map();
    this.editMode = false;
    this.editLayer = null;
    this.translateInteraction = null;
    this.currentEditLayerId = null;

    eventBus.on('label:refresh', (data) => {
      if (this.labelConfigs.has(data.layerId)) {
        this.applyLabel(data.layerId);
      }
    });
  }

  setLabel(layerId, config) {
    var field = config.field;
    if (!field) {
      this.removeLabel(layerId);
      return;
    }
    this.labelConfigs.set(layerId, config);
    this.applyLabel(layerId);
  }

  getFeatureCenter(feature, applyOffset = true) {
    var geom = feature.getGeometry();
    if (!geom) return null;

    try {
      var type = geom.getType();
      
      var center = null;

      if (type === 'Polygon') {
        // 무게중심점(centroid) 사용
        try {
          var interior = geom.getInteriorPoint();
          if (interior) {
            var coords = interior.getCoordinates();
            if (coords && coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              center = [coords[0], coords[1]];
            }
          }
        } catch (e) {}
        if (!center) {
          var extent = geom.getExtent();
          center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        }
      }
      
      else if (type === 'MultiPolygon') {
        // 무게중심점(centroid) 사용
        try {
          var interior = geom.getInteriorPoint();
          if (interior) {
            var coords = interior.getCoordinates();
            if (coords && coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              center = [coords[0], coords[1]];
            }
          }
        } catch (e) {}
        if (!center) {
          var polygons = geom.getPolygons();
          if (polygons && polygons.length > 0) {
            var extent = polygons[0].getExtent();
            center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
          }
        }
      }
      
      else if (type === 'LineString') {
        var coords = geom.getCoordinates();
        if (coords && coords.length > 0) {
          var midIndex = Math.floor(coords.length / 2);
          center = coords[midIndex];
        }
      }
      
      else if (type === 'MultiLineString') {
        var lines = geom.getLineStrings();
        if (lines && lines.length > 0) {
          var coords2 = lines[0].getCoordinates();
          if (coords2 && coords2.length > 0) {
            var midIndex2 = Math.floor(coords2.length / 2);
            center = coords2[midIndex2];
          }
        }
      }
      
      else if (type === 'Point') {
        center = geom.getCoordinates();
      }
      
      else if (type === 'MultiPoint') {
        var points = geom.getPoints();
        if (points && points.length > 0) {
          center = points[0].getCoordinates();
        }
      }
      
      // fallback: extent 중심
      if (!center) {
        var extent = geom.getExtent();
        if (extent && extent[0] !== Infinity) {
          center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        }
      }

      // 오프셋 적용
      if (center && applyOffset) {
        var featureId = feature.ol_uid || feature.getId();
        var offset = this.labelOffsets.get(featureId);
        if (offset) {
          center = [center[0] + offset[0], center[1] + offset[1]];
        }
      }

      return center;
    } catch (e) {
      console.warn('getFeatureCenter error:', e);
    }

    return null;
  }

  createDefaultStyle(layerInfo) {
    var geoType = layerInfo.geometryType || 'Polygon';
    var color = layerInfo.color || '#3388ff';
    var fillColor = layerInfo.fillColor || color;
    var strokeColor = layerInfo.strokeColor || color;
    var fillOpacity = layerInfo.fillOpacity !== undefined ? layerInfo.fillOpacity : 0.3;
    var strokeWidth = layerInfo.strokeWidth || 2;

    function hexToRgba(hex, alpha) {
      if (!hex) return 'rgba(51,136,255,' + alpha + ')';
      if (hex.indexOf('rgba') === 0 || hex.indexOf('rgb') === 0) return hex;
      var r = parseInt(hex.slice(1, 3), 16) || 0;
      var g = parseInt(hex.slice(3, 5), 16) || 0;
      var b = parseInt(hex.slice(5, 7), 16) || 0;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    var rgbaFill = hexToRgba(fillColor, fillOpacity);

    if (geoType === 'Point' || geoType === 'MultiPoint') {
      return new Style({
        image: new CircleStyle({
          radius: layerInfo.pointRadius || 6,
          fill: new Fill({ color: rgbaFill }),
          stroke: new Stroke({ color: strokeColor, width: 2 })
        })
      });
    } else if (geoType === 'LineString' || geoType === 'MultiLineString') {
      return new Style({
        stroke: new Stroke({ color: strokeColor, width: strokeWidth })
      });
    } else {
      return new Style({
        fill: new Fill({ color: rgbaFill }),
        stroke: new Stroke({ color: strokeColor, width: strokeWidth })
      });
    }
  }

  applyLabel(layerId) {
    var layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    var layer = layerInfo.olLayer;
    if (!layer) return;

    var config = this.labelConfigs.get(layerId);
    if (!config) return;

    var field = config.field;
    var fontSize = config.fontSize || 12;
    var fontColor = config.fontColor || '#333333';
    var haloColor = config.haloColor || '#ffffff';
    var haloWidth = config.haloWidth || 2;

    // 원본 스타일 저장
    if (!layer._originalStyle) {
      var currentStyle = layer.getStyle();
      if (currentStyle) {
        layer._originalStyle = currentStyle;
      } else {
        layer._originalStyle = this.createDefaultStyle(layerInfo);
      }
    }

    var originalStyle = layer._originalStyle;
    var self = this;
    var defaultStyle = this.createDefaultStyle(layerInfo);

    var labelStyleFn = function(feature, resolution) {
      var baseStyles = [];
      
      try {
        if (typeof originalStyle === 'function') {
          var result = originalStyle(feature, resolution);
          if (result) {
            baseStyles = Array.isArray(result) ? result : [result];
          }
        } else if (originalStyle) {
          baseStyles = Array.isArray(originalStyle) ? originalStyle : [originalStyle];
        }
      } catch (e) {
        // 스타일 함수 오류 시 무시
      }

      // 스타일이 없으면 기본 스타일 사용
      if (baseStyles.length === 0) {
        baseStyles = [defaultStyle];
      }

      // 필드 값 가져오기 - 다양한 형태 처리
      var value = feature.get(field);
      
      // 값이 없으면 스타일만 반환 (라벨 없음)
      if (value === undefined || value === null || value === '') {
        return baseStyles;
      }

      // 중심점 계산
      var center = self.getFeatureCenter(feature);
      if (!center || !Array.isArray(center) || center.length < 2) {
        return baseStyles;
      }

      // 좌표가 유효한지 확인
      if (isNaN(center[0]) || isNaN(center[1])) {
        return baseStyles;
      }

      // 텍스트 스타일 생성
      var textStyle = new Style({
        geometry: new Point(center),
        text: new Text({
          text: String(value),
          font: fontSize + 'px sans-serif',
          fill: new Fill({ color: fontColor }),
          stroke: new Stroke({ color: haloColor, width: haloWidth }),
          overflow: true
        })
      });

      return baseStyles.concat([textStyle]);
    };

    layer.setStyle(labelStyleFn);
    layer._hasLabel = true;

    // 레이어 갱신
    if (layer.getSource()) {
      layer.getSource().changed();
    }

    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId: layerId });
  }

  removeLabel(layerId) {
    var layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;
    var layer = layerInfo.olLayer;

    this.labelConfigs.delete(layerId);

    // 편집 모드 종료
    if (this.currentEditLayerId === layerId) {
      this.stopEditMode();
    }

    if (layer._originalStyle) {
      layer.setStyle(layer._originalStyle);
      delete layer._originalStyle;
    }
    delete layer._hasLabel;

    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId: layerId });
  }

  getLabelConfig(layerId) {
    return this.labelConfigs.get(layerId) || null;
  }

  hasLabel(layerId) {
    return this.labelConfigs.has(layerId);
  }

  startEditMode(layerId) {
    var map = mapManager.getMap();
    if (!map) return;

    this.stopEditMode();

    var layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    var layer = layerInfo.olLayer;
    var source = layer.getSource();
    if (!source) return;

    var features = source.getFeatures();
    var config = this.labelConfigs.get(layerId);
    if (!config) return;

    this.currentEditLayerId = layerId;
    this.editMode = true;

    // 원본 레이어의 라벨 스타일 저장 후 라벨 없는 스타일로 변경
    this._editOriginalStyleFn = layer.getStyle();
    var self = this;
    var defaultStyle = this.createDefaultStyle(layerInfo);

    // 라벨 없이 도형만 표시하는 스타일
    layer.setStyle(function(feature, resolution) {
      var baseStyles = [];
      var origStyle = layer._originalStyle;
      try {
        if (typeof origStyle === 'function') {
          var result = origStyle(feature, resolution);
          if (result) {
            baseStyles = Array.isArray(result) ? result : [result];
          }
        } else if (origStyle) {
          baseStyles = Array.isArray(origStyle) ? origStyle : [origStyle];
        }
      } catch (e) {}
      if (baseStyles.length === 0) {
        baseStyles = [defaultStyle];
      }
      return baseStyles; // 라벨 없이 도형만
    });

    var editFeatures = [];

    features.forEach(function(feature) {
      var value = feature.get(config.field);
      if (value === undefined || value === null || value === '') return;

      var center = self.getFeatureCenter(feature, true);
      if (!center) return;

      var editFeature = new Feature({
        geometry: new Point(center),
        originalFeature: feature,
        featureId: feature.ol_uid || feature.getId()
      });

      // 편집 포인트 - 빨간 점과 라벨 표시
      editFeature.setStyle(new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: 'rgba(255, 100, 100, 0.8)' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        }),
        text: new Text({
          text: String(value),
          font: (config.fontSize || 12) + 'px sans-serif',
          fill: new Fill({ color: config.fontColor || '#333333' }),
          stroke: new Stroke({ color: config.haloColor || '#ffffff', width: config.haloWidth || 2 }),
          offsetY: -20,
          overflow: true
        })
      }));

      editFeatures.push(editFeature);
    });

    var editSource = new VectorSource({ features: editFeatures });
    this.editLayer = new VectorLayer({
      source: editSource,
      zIndex: 9999
    });

    map.addLayer(this.editLayer);

    this.translateInteraction = new Translate({
      layers: [this.editLayer]
    });

    this.translateInteraction.on('translateend', function(evt) {
      evt.features.forEach(function(editFeature) {
        var originalFeature = editFeature.get('originalFeature');
        var featureId = editFeature.get('featureId');
        var newCenter = editFeature.getGeometry().getCoordinates();
        var originalCenter = self.getFeatureCenter(originalFeature, false);

        if (originalCenter) {
          var offsetX = newCenter[0] - originalCenter[0];
          var offsetY = newCenter[1] - originalCenter[1];
          self.labelOffsets.set(featureId, [offsetX, offsetY]);
        }
      });
    });

    map.addInteraction(this.translateInteraction);
    eventBus.emit('label:editModeStarted', { layerId: layerId });
  }

  stopEditMode() {
    var map = mapManager.getMap();
    if (!map) return;

    if (this.translateInteraction) {
      map.removeInteraction(this.translateInteraction);
      this.translateInteraction = null;
    }

    if (this.editLayer) {
      map.removeLayer(this.editLayer);
      this.editLayer = null;
    }

    // 원본 레이어에 라벨 스타일 복원 (오프셋 적용된 상태로)
    if (this.currentEditLayerId) {
      this.applyLabel(this.currentEditLayerId);
    }

    this._editOriginalStyleFn = null;
    this.editMode = false;
    this.currentEditLayerId = null;
    eventBus.emit('label:editModeStopped');
  }

  isEditMode() {
    return this.editMode;
  }

  resetLabelOffsets(layerId) {
    var layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return;

    var source = layerInfo.olLayer.getSource();
    if (!source) return;

    var self = this;
    source.getFeatures().forEach(function(feature) {
      var featureId = feature.ol_uid || feature.getId();
      self.labelOffsets.delete(featureId);
    });

    this.applyLabel(layerId);
  }

  getLayerFields(layerId) {
    var layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    var source = layerInfo.olLayer.getSource();
    if (!source) return [];
    
    var features = source.getFeatures();
    if (features.length === 0) return [];

    var props = features[0].getProperties();
    return Object.keys(props).filter(function(key) { return key !== 'geometry'; });
  }
}

export var labelTool = new LabelTool();
