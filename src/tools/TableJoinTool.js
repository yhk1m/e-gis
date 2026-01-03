/**
 * TableJoinTool - 테이블 결합 도구
 * CSV/XLSX 파일의 데이터를 레이어 피처에 결합
 */

import { layerManager } from "../core/LayerManager.js";
import { eventBus, Events } from "../utils/EventBus.js";
import * as XLSX from 'xlsx';

class TableJoinTool {
  constructor() {
    this.joinHistory = new Map(); // layerId -> joined field names
  }

  /**
   * CSV 파일 파싱
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error("CSV 파일에 데이터가 없습니다.");
    }

    // 헤더 파싱 (쉼표 또는 탭 구분)
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = this.parseCSVLine(lines[0], delimiter);

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line, delimiter);
      const row = {};

      headers.forEach((header, idx) => {
        let value = values[idx] || "";
        // 숫자 변환 시도
        const num = parseFloat(value);
        if (!isNaN(num) && value.trim() !== "") {
          row[header] = num;
        } else {
          row[header] = value;
        }
      });

      data.push(row);
    }

    return { headers, data };
  }

  /**
   * CSV 라인 파싱 (따옴표 처리)
   */
  parseCSVLine(line, delimiter) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }

  /**
   * XLSX 파일 파싱
   */
  parseXLSX(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 시트를 JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      throw new Error("XLSX 파일에 데이터가 없습니다.");
    }

    // 첫 번째 행을 헤더로 사용
    const headers = jsonData[0].map(h => String(h || '').trim());

    const data = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = {};
      const values = jsonData[i];

      if (!values || values.length === 0) continue;

      headers.forEach((header, idx) => {
        if (header) {
          let value = values[idx];
          if (value === undefined || value === null) {
            row[header] = "";
          } else if (typeof value === 'number') {
            row[header] = value;
          } else {
            const num = parseFloat(value);
            if (!isNaN(num) && String(value).trim() !== "") {
              row[header] = num;
            } else {
              row[header] = String(value);
            }
          }
        }
      });

      data.push(row);
    }

    return { headers: headers.filter(h => h), data };
  }

  /**
   * 레이어의 속성 필드 목록 가져오기
   */
  getLayerFields(layerId) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    const features = layerInfo.source.getFeatures();
    if (features.length === 0) return [];

    const properties = features[0].getProperties();
    const fields = [];

    for (const key in properties) {
      if (key !== "geometry") {
        fields.push(key);
      }
    }

    return fields;
  }

  /**
   * 레이어 필드의 고유값 가져오기
   */
  getUniqueValues(layerId, fieldName) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return [];

    const features = layerInfo.source.getFeatures();
    const values = new Set();

    features.forEach(feature => {
      const val = feature.get(fieldName);
      if (val !== null && val !== undefined) {
        values.add(String(val));
      }
    });

    return Array.from(values).sort();
  }

  /**
   * 조인 미리보기
   */
  previewJoin(layerId, layerField, csvData, csvField) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return { matched: 0, unmatched: 0, total: 0 };

    const features = layerInfo.source.getFeatures();
    const csvMap = new Map();

    // CSV 데이터를 Map으로 변환
    csvData.forEach(row => {
      const key = String(row[csvField] || "").trim();
      if (key) {
        csvMap.set(key, row);
      }
    });

    let matched = 0;
    let unmatched = 0;

    features.forEach(feature => {
      const layerValue = String(feature.get(layerField) || "").trim();
      if (csvMap.has(layerValue)) {
        matched++;
      } else {
        unmatched++;
      }
    });

    return {
      matched,
      unmatched,
      total: features.length,
      csvRows: csvData.length,
      matchRate: ((matched / features.length) * 100).toFixed(1)
    };
  }

  /**
   * 테이블 결합 실행
   */
  join(layerId, layerField, csvData, csvField, selectedFields) {
    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) {
      throw new Error("레이어를 찾을 수 없습니다.");
    }

    const features = layerInfo.source.getFeatures();
    const csvMap = new Map();

    // CSV 데이터를 Map으로 변환
    csvData.forEach(row => {
      const key = String(row[csvField] || "").trim();
      if (key) {
        csvMap.set(key, row);
      }
    });

    // 조인할 필드 결정 (선택된 필드 또는 전체)
    const fieldsToJoin = selectedFields || Object.keys(csvData[0] || {}).filter(f => f !== csvField);

    let joinedCount = 0;

    features.forEach(feature => {
      const layerValue = String(feature.get(layerField) || "").trim();
      const csvRow = csvMap.get(layerValue);

      if (csvRow) {
        fieldsToJoin.forEach(field => {
          if (csvRow[field] !== undefined) {
            feature.set(field, csvRow[field]);
          }
        });
        joinedCount++;
      }
    });

    // 조인 히스토리 저장
    const existingJoins = this.joinHistory.get(layerId) || [];
    this.joinHistory.set(layerId, [...existingJoins, ...fieldsToJoin]);

    // 피처 수 업데이트
    layerInfo.featureCount = features.length;

    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });
    eventBus.emit(Events.TABLE_JOINED, {
      layerId,
      joinedCount,
      fields: fieldsToJoin
    });

    return {
      success: true,
      joinedCount,
      totalFeatures: features.length,
      fieldsAdded: fieldsToJoin
    };
  }

  /**
   * 조인된 필드 제거
   */
  removeJoinedFields(layerId) {
    const joinedFields = this.joinHistory.get(layerId);
    if (!joinedFields || joinedFields.length === 0) return false;

    const layerInfo = layerManager.getLayer(layerId);
    if (!layerInfo) return false;

    const features = layerInfo.source.getFeatures();

    features.forEach(feature => {
      joinedFields.forEach(field => {
        feature.unset(field);
      });
    });

    this.joinHistory.delete(layerId);
    eventBus.emit(Events.LAYER_STYLE_CHANGED, { layerId });

    return true;
  }

  /**
   * 레이어에 조인된 필드 목록 가져오기
   */
  getJoinedFields(layerId) {
    return this.joinHistory.get(layerId) || [];
  }
}

export const tableJoinTool = new TableJoinTool();
