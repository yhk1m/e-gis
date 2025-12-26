/**
 * MeasureTool - 거리/면적 측정 도구
 */

import Draw from "ol/interaction/Draw";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Overlay from "ol/Overlay";
import { getLength, getArea } from "ol/sphere";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { unByKey } from "ol/Observable";
import { mapManager } from "../core/MapManager.js";
import { eventBus, Events } from "../utils/EventBus.js";

const MEASURE_STYLE = new Style({
  fill: new Fill({
    color: "rgba(255, 193, 7, 0.2)"
  }),
  stroke: new Stroke({
    color: "#ffc107",
    width: 2,
    lineDash: [10, 10]
  }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#ffc107" }),
    stroke: new Stroke({ color: "#fff", width: 2 })
  })
});

const MEASURE_STYLE_FINAL = new Style({
  fill: new Fill({
    color: "rgba(255, 152, 0, 0.3)"
  }),
  stroke: new Stroke({
    color: "#ff9800",
    width: 3
  }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "#ff9800" }),
    stroke: new Stroke({ color: "#fff", width: 2 })
  })
});

class MeasureTool {
  constructor() {
    this.map = null;
    this.draw = null;
    this.measureType = null;
    this.source = null;
    this.layer = null;
    this.tooltips = [];
    this.currentTooltip = null;
    this.sketch = null;
    this.listener = null;
    this.isActive = false;
  }

  init() {
    this.map = mapManager.getMap();
    
    this.source = new VectorSource();
    this.layer = new VectorLayer({
      source: this.source,
      style: MEASURE_STYLE_FINAL,
      zIndex: 999
    });
    
    this.map.addLayer(this.layer);

    eventBus.on(Events.MEASUREMENT_CLEAR, () => {
      this.clearMeasurements();
    });
  }

  activate(type) {
    if (!this.map) this.init();
    
    this.deactivate();
    this.measureType = type;

    const drawType = type === "distance" ? "LineString" : "Polygon";

    this.draw = new Draw({
      source: this.source,
      type: drawType,
      style: MEASURE_STYLE
    });

    this.map.addInteraction(this.draw);

    this.createTooltip();

    this.draw.on("drawstart", (evt) => {
      this.sketch = evt.feature;
      
      this.listener = this.sketch.getGeometry().on("change", (e) => {
        const geom = e.target;
        let output;
        
        if (type === "distance") {
          output = this.formatLength(geom);
        } else {
          output = this.formatArea(geom);
        }
        
        this.updateTooltip(output, geom);
      });
    });

    this.draw.on("drawend", (evt) => {
      const geom = evt.feature.getGeometry();
      let output;
      
      if (type === "distance") {
        output = this.formatLength(geom);
      } else {
        output = this.formatArea(geom);
      }
      
      this.finalizeTooltip(output, geom);
      
      unByKey(this.listener);
      this.sketch = null;
      
      this.createTooltip();
    });

    this.isActive = true;
    this.updateStatusMessage(type);
  }

  deactivate() {
    if (this.draw) {
      this.map.removeInteraction(this.draw);
      this.draw = null;
    }
    
    if (this.currentTooltip) {
      this.map.removeOverlay(this.currentTooltip);
      this.currentTooltip = null;
    }
    
    if (this.listener) {
      unByKey(this.listener);
      this.listener = null;
    }
    
    this.sketch = null;
    this.isActive = false;
    this.measureType = null;

    var statusEl = document.getElementById("status-message");
    if (statusEl) {
      statusEl.textContent = "준비";
    }
  }

  createTooltip() {
    var tooltipEl = document.createElement("div");
    tooltipEl.className = "measure-tooltip";
    
    this.currentTooltip = new Overlay({
      element: tooltipEl,
      offset: [0, -15],
      positioning: "bottom-center",
      stopEvent: false
    });
    
    this.map.addOverlay(this.currentTooltip);
  }

  updateTooltip(text, geom) {
    var tooltipEl = this.currentTooltip.getElement();
    tooltipEl.innerHTML = text;
    tooltipEl.className = "measure-tooltip measuring";
    
    var coords;
    if (this.measureType === "distance") {
      coords = geom.getLastCoordinate();
    } else {
      coords = geom.getInteriorPoint().getCoordinates();
    }
    
    this.currentTooltip.setPosition(coords);
  }

  finalizeTooltip(text, geom) {
    var tooltipEl = this.currentTooltip.getElement();
    tooltipEl.innerHTML = text;
    tooltipEl.className = "measure-tooltip final";
    
    var coords;
    if (this.measureType === "distance") {
      coords = geom.getLastCoordinate();
    } else {
      coords = geom.getInteriorPoint().getCoordinates();
    }
    
    this.currentTooltip.setPosition(coords);
    this.tooltips.push(this.currentTooltip);
    this.currentTooltip = null;
  }

  formatLength(line) {
    var length = getLength(line, { projection: "EPSG:3857" });
    var output;
    
    if (length > 1000) {
      output = (length / 1000).toFixed(2) + " km";
    } else {
      output = length.toFixed(1) + " m";
    }
    
    return output;
  }

  formatArea(polygon) {
    var area = getArea(polygon, { projection: "EPSG:3857" });
    var output;
    
    if (area > 1000000) {
      output = (area / 1000000).toFixed(2) + " km²";
    } else if (area > 10000) {
      output = (area / 10000).toFixed(2) + " ha";
    } else {
      output = area.toFixed(1) + " m²";
    }
    
    return output;
  }

  clearMeasurements() {
    this.source.clear();
    
    for (var i = 0; i < this.tooltips.length; i++) {
      this.map.removeOverlay(this.tooltips[i]);
    }
    this.tooltips = [];
    
    if (this.currentTooltip) {
      this.map.removeOverlay(this.currentTooltip);
      this.currentTooltip = null;
    }
  }

  updateStatusMessage(type) {
    var statusEl = document.getElementById("status-message");
    if (!statusEl) return;

    if (type === "distance") {
      statusEl.textContent = "거리 측정: 클릭하여 경로를 그리세요. 더블클릭으로 완료.";
    } else {
      statusEl.textContent = "면적 측정: 클릭하여 영역을 그리세요. 더블클릭으로 완료.";
    }
  }

  getIsActive() {
    return this.isActive;
  }
}

export var measureTool = new MeasureTool();
