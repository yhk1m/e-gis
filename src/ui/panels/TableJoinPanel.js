/**
 * TableJoinPanel - 테이블 결합 설정 패널
 */

import { tableJoinTool } from "../../tools/TableJoinTool.js";
import { layerManager } from "../../core/LayerManager.js";
import { buildLayerOptions, resolveInitialLayerId } from "../../utils/layerSelect.js";

class TableJoinPanel {
  constructor() {
    this.modal = null;
    this.currentLayerId = null;
    this.csvData = null;
    this.csvHeaders = null;
  }

  show(layerId = null) {
    const layers = tableJoinTool.getCompatibleLayers();
    if (layers.length === 0) {
      alert("테이블을 결합할 수 있는 레이어가 없습니다.\n(속성 필드가 있는 벡터 레이어가 필요합니다)");
      return;
    }

    // 선택 중인 레이어가 테이블 결합을 지원하면 미리 골라 준다.
    this.currentLayerId = resolveInitialLayerId(layers, layerId || layerManager.getSelectedLayerId()) || null;
    this.csvData = null;
    this.csvHeaders = null;
    this.render(layers);
  }

  render(layers) {
    this.close();

    this.modal = document.createElement("div");
    this.modal.className = "choropleth-modal"; // 동일한 모달 스타일 사용
    this.modal.innerHTML = this.getModalHTML(layers);
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.updateLayerKeyFields();
  }

  getModalHTML(layers) {
    const layerOptions = buildLayerOptions(layers, { selectedId: this.currentLayerId });

    return '<div class="choropleth-content" style="width: 420px;">' +
      '<div class="choropleth-header">' +
        '<h3>테이블 결합</h3>' +
        '<button class="choropleth-close" id="join-close">&times;</button>' +
      '</div>' +
      '<div class="choropleth-body">' +
        '<div class="choropleth-form-group">' +
          '<label for="join-layer">대상 레이어</label>' +
          '<select id="join-layer">' + layerOptions + '</select>' +
        '</div>' +

        '<div class="choropleth-form-group">' +
          '<label>데이터 파일 업로드</label>' +
          '<div class="file-upload-area" id="csv-upload-area">' +
            '<input type="file" id="csv-file-input" accept=".csv,.txt,.xlsx,.xls" style="display:none">' +
            '<div class="upload-placeholder" id="upload-placeholder">' +
              '<span class="upload-icon">📄</span>' +
              '<span>CSV 또는 Excel 파일을 드래그하거나 클릭하세요</span>' +
            '</div>' +
            '<div class="upload-success" id="upload-success" style="display:none">' +
              '<span class="success-icon">✓</span>' +
              '<span id="csv-filename"></span>' +
              '<span id="csv-row-count"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="choropleth-form-group">' +
          '<label for="layer-key-field">레이어 키 필드</label>' +
          '<select id="layer-key-field"></select>' +
        '</div>' +

        '<div class="choropleth-form-group">' +
          '<label for="csv-key-field">테이블 키 필드</label>' +
          '<select id="csv-key-field" disabled>' +
            '<option value="">파일을 먼저 업로드하세요</option>' +
          '</select>' +
        '</div>' +

        '<div class="choropleth-form-group">' +
          '<label>조인할 필드 선택</label>' +
          '<div id="join-fields-list" class="join-fields-list">' +
            '<div class="placeholder-text">파일을 업로드하면 필드가 표시됩니다.</div>' +
          '</div>' +
        '</div>' +

        '<div id="join-preview" class="join-preview" style="display:none">' +
          '<div class="preview-title">조인 미리보기</div>' +
          '<div class="preview-stats">' +
            '<div class="stat-item"><span class="stat-label">매칭:</span> <span id="match-count">0</span></div>' +
            '<div class="stat-item"><span class="stat-label">미매칭:</span> <span id="unmatch-count">0</span></div>' +
            '<div class="stat-item"><span class="stat-label">매칭률:</span> <span id="match-rate">0%</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="choropleth-footer">' +
        '<button class="btn btn-secondary" id="join-cancel">취소</button>' +
        '<button class="btn btn-primary" id="join-apply" disabled>조인 실행</button>' +
      '</div>' +
    '</div>';
  }

  bindEvents() {
    const layerSelect = document.getElementById("join-layer");
    const closeBtn = document.getElementById("join-close");
    const cancelBtn = document.getElementById("join-cancel");
    const applyBtn = document.getElementById("join-apply");
    const fileInput = document.getElementById("csv-file-input");
    const uploadArea = document.getElementById("csv-upload-area");
    const layerKeyField = document.getElementById("layer-key-field");
    const csvKeyField = document.getElementById("csv-key-field");

    closeBtn.addEventListener("click", () => this.close());
    cancelBtn.addEventListener("click", () => this.close());

    layerSelect.addEventListener("change", () => {
      this.currentLayerId = layerSelect.value || null;
      this.updateLayerKeyFields();
      // 업로드한 표는 그대로 두고 매칭 결과만 새 레이어 기준으로 다시 계산한다.
      if (this.csvData) this.updatePreview();
    });

    applyBtn.addEventListener("click", () => this.executeJoin());

    // 파일 업로드 영역 클릭
    uploadArea.addEventListener("click", () => {
      fileInput.click();
    });

    // 드래그 앤 드롭
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    });

    // 파일 선택
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
    });

    // 키 필드 변경 시 미리보기 업데이트
    layerKeyField.addEventListener("change", () => this.updatePreview());
    csvKeyField.addEventListener("change", () => this.updatePreview());
  }

  /**
   * 선택된 레이어의 속성 필드로 키 필드 목록을 채운다.
   * 레이어가 안 골라졌으면 안내 문구만 두고 비활성화한다.
   */
  updateLayerKeyFields() {
    const layerKeyField = document.getElementById("layer-key-field");
    if (!layerKeyField) return;

    if (!this.currentLayerId) {
      layerKeyField.innerHTML = '<option value="">-- 먼저 레이어를 선택하세요 --</option>';
      layerKeyField.disabled = true;
      return;
    }

    const fields = tableJoinTool.getLayerFields(this.currentLayerId);
    layerKeyField.disabled = false;
    layerKeyField.innerHTML = fields.map(f => '<option value="' + f + '">' + f + '</option>').join("");
  }

  handleFile(file) {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv") || fileName.endsWith(".txt");

    if (!isExcel && !isCSV) {
      alert("CSV, TXT, XLSX, XLS 파일만 지원됩니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let result;
        if (isExcel) {
          result = tableJoinTool.parseXLSX(e.target.result);
        } else {
          result = tableJoinTool.parseCSV(e.target.result);
        }
        this.csvData = result.data;
        this.csvHeaders = result.headers;
        this.onCSVLoaded(file.name);
      } catch (error) {
        alert("파일 파싱 오류: " + error.message);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
  }

  onCSVLoaded(filename) {
    // UI 업데이트
    document.getElementById("upload-placeholder").style.display = "none";
    const successEl = document.getElementById("upload-success");
    successEl.style.display = "flex";
    document.getElementById("csv-filename").textContent = filename;
    document.getElementById("csv-row-count").textContent = "(" + this.csvData.length + "행)";

    // CSV 키 필드 셀렉트 업데이트
    const csvKeyField = document.getElementById("csv-key-field");
    csvKeyField.disabled = false;
    csvKeyField.innerHTML = this.csvHeaders.map(h =>
      '<option value="' + h + '">' + h + '</option>'
    ).join("");

    // 조인할 필드 목록 업데이트
    this.updateJoinFieldsList();

    // 미리보기 업데이트
    this.updatePreview();
  }

  updateJoinFieldsList() {
    const container = document.getElementById("join-fields-list");
    const csvKeyField = document.getElementById("csv-key-field").value;

    // 키 필드를 제외한 필드들
    const joinableFields = this.csvHeaders.filter(h => h !== csvKeyField);

    if (joinableFields.length === 0) {
      container.innerHTML = '<div class="placeholder-text">조인할 필드가 없습니다.</div>';
      return;
    }

    container.innerHTML = joinableFields.map(field =>
      '<label class="field-checkbox">' +
        '<input type="checkbox" value="' + field + '" checked>' +
        '<span>' + field + '</span>' +
      '</label>'
    ).join("");

    // 체크박스 변경 이벤트
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => this.updatePreview());
    });
  }

  updatePreview() {
    if (!this.csvData) return;

    if (!this.currentLayerId) {
      document.getElementById("join-preview").style.display = "none";
      document.getElementById("join-apply").disabled = true;
      return;
    }

    const layerKeyField = document.getElementById("layer-key-field").value;
    const csvKeyField = document.getElementById("csv-key-field").value;

    const preview = tableJoinTool.previewJoin(
      this.currentLayerId,
      layerKeyField,
      this.csvData,
      csvKeyField
    );

    // 미리보기 UI 업데이트
    const previewEl = document.getElementById("join-preview");
    previewEl.style.display = "block";

    document.getElementById("match-count").textContent = preview.matched;
    document.getElementById("unmatch-count").textContent = preview.unmatched;
    document.getElementById("match-rate").textContent = preview.matchRate + "%";

    // 조인 버튼 활성화
    const applyBtn = document.getElementById("join-apply");
    applyBtn.disabled = preview.matched === 0;

    // 조인할 필드 목록 업데이트
    this.updateJoinFieldsList();
  }

  getSelectedFields() {
    const checkboxes = document.querySelectorAll("#join-fields-list input[type='checkbox']:checked");
    return Array.from(checkboxes).map(cb => cb.value);
  }

  executeJoin() {
    if (!this.currentLayerId) {
      alert("먼저 대상 레이어를 선택해주세요.");
      return;
    }

    const layerKeyField = document.getElementById("layer-key-field").value;
    const csvKeyField = document.getElementById("csv-key-field").value;
    const selectedFields = this.getSelectedFields();

    if (selectedFields.length === 0) {
      alert("조인할 필드를 선택해주세요.");
      return;
    }

    try {
      const result = tableJoinTool.join(
        this.currentLayerId,
        layerKeyField,
        this.csvData,
        csvKeyField,
        selectedFields
      );

      alert(
        "테이블 결합 완료!\n" +
        "- 조인된 피처: " + result.joinedCount + "/" + result.totalFeatures + "\n" +
        "- 추가된 필드: " + result.fieldsAdded.join(", ")
      );

      this.close();
    } catch (error) {
      alert("조인 실패: " + error.message);
    }
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.csvData = null;
    this.csvHeaders = null;
  }
}

export const tableJoinPanel = new TableJoinPanel();
