/**
 * ToolManager - 도구 관리자
 */

import { drawTool } from "./DrawTool.js";
import { selectTool } from "./SelectTool.js";
import { measureTool } from "./MeasureTool.js";
import { eventBus, Events } from "../utils/EventBus.js";

class ToolManager {
  constructor() {
    this.currentTool = null;
    this.tools = {
      select: selectTool,
      "draw-point": drawTool,
      "draw-line": drawTool,
      "draw-polygon": drawTool,
      "draw-multipoint": drawTool,
      "draw-multiline": drawTool,
      "draw-multipolygon": drawTool,
      "measure-distance": measureTool,
      "measure-area": measureTool
    };
  }

  activateTool(toolName) {
    this.deactivateCurrentTool();

    switch (toolName) {
      case "select":
        selectTool.activate();
        break;
      case "draw-point":
        drawTool.activate("Point");
        break;
      case "draw-line":
        drawTool.activate("LineString");
        break;
      case "draw-polygon":
        drawTool.activate("Polygon");
        break;
      case "draw-multipoint":
        drawTool.activate("MultiPoint");
        break;
      case "draw-multiline":
        drawTool.activate("MultiLineString");
        break;
      case "draw-multipolygon":
        drawTool.activate("MultiPolygon");
        break;
      case "measure-distance":
        measureTool.activate("distance");
        break;
      case "measure-area":
        measureTool.activate("area");
        break;
      case "pan":
        break;
      default:
        console.warn("Unknown tool:", toolName);
        return;
    }

    this.currentTool = toolName;
    this.updateToolbarUI(toolName);
    eventBus.emit(Events.TOOL_CHANGED, { tool: toolName });
  }

  deactivateCurrentTool() {
    if (drawTool.getIsActive()) {
      drawTool.deactivate();
    }
    if (selectTool.getIsActive()) {
      selectTool.deactivate();
    }
    if (measureTool.getIsActive()) {
      measureTool.deactivate();
    }
    this.currentTool = null;
  }

  updateToolbarUI(activeTool) {
    document.querySelectorAll("#toolbar .btn-icon").forEach(function(btn) {
      btn.classList.remove("active");
    });

    var activeBtn = document.querySelector("#toolbar [data-tool=\"" + activeTool + "\"]");
    if (activeBtn) {
      activeBtn.classList.add("active");
    }
  }

  getCurrentTool() {
    return this.currentTool;
  }

  toggleTool(toolName) {
    if (this.currentTool === toolName) {
      // 멀티 도형 그리기 중이면 저장
      if (drawTool.getIsMultiMode() && drawTool.getMultiFeatureCount() > 0) {
        drawTool.saveMultiFeature();
      }
      this.deactivateCurrentTool();
      this.updateToolbarUI(null);
    } else {
      this.activateTool(toolName);
    }
  }

  deleteSelectedFeatures() {
    if (selectTool && selectTool.getSelectedFeatures && selectTool.getSelectedFeatures().length === 0) {
      return false;
    }
    if (selectTool && selectTool.deleteSelected) {
      selectTool.deleteSelected();
      return true;
    }
  }

  selectAllFeatures() {
    if (selectTool && selectTool.selectAll) {
      selectTool.selectAll();
    }
  }

  clearSelection() {
    if (selectTool && selectTool.clearSelection) {
      selectTool.clearSelection();
    }
  }

  clearMeasurements() {
    if (measureTool) {
      measureTool.clearMeasurements();
    }
  }
}

export var toolManager = new ToolManager();
